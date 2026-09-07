import { LocalStorage } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAIProviderConfiguration } from "./configuration";
import { AI_PROVIDER_STORAGE_KEY, saveAIProviderState } from "./repository";

const { storage, legacy } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  legacy: {
    openai: {
      enabled: true,
      apiKey: "placeholder",
      endpoint: "https://api.openai.com/v1",
      model: "model",
      forceMaxCompletionTokens: false,
    },
    gemini: { enabled: false, apiKey: "", endpoint: "https://generativelanguage.googleapis.com", model: "model" },
  },
}));

vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key))),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
  },
}));
vi.mock("@/consts", () => ({ myPreferences: { servicesOrder: "google,openai" } }));
vi.mock("@/providers/registry", () => ({
  builtinProviderServices: [
    { providerKey: "builtin:translation:Google Translate", type: "Google Translate", order: 0 },
  ],
}));
vi.mock("./legacyConfiguration", () => ({ getLegacyAIProviderConfiguration: () => legacy }));
vi.mock("@/utils/logger", () => ({ createTimer: () => ({ done: vi.fn(), fail: vi.fn() }) }));

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

describe("AI provider configuration loading", () => {
  it("persists one migration before exposing profiles and does not import again after deletion", async () => {
    const first = await loadAIProviderConfiguration();
    expect(first.kind).toBe("ready");
    if (first.kind !== "ready") throw new Error("Expected migrated configuration");
    expect(first.state.profiles).toHaveLength(1);
    expect(JSON.parse(storage.get(AI_PROVIDER_STORAGE_KEY)!)).toEqual(first.state);
    await saveAIProviderState({ ...first.state, profiles: [] });
    const deleted = await loadAIProviderConfiguration();
    expect(deleted).toMatchObject({ kind: "ready", state: { profiles: [], migratedLegacyProviders: ["openai"] } });
  });

  it("leaves old data untouched when migration cannot be saved, then retries successfully", async () => {
    const raw = JSON.stringify({ version: 1, profiles: [] });
    storage.set(AI_PROVIDER_STORAGE_KEY, raw);
    vi.mocked(LocalStorage.setItem).mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await loadAIProviderConfiguration()).toMatchObject({
      kind: "error",
      error: { message: "Storage unavailable" },
    });
    expect(storage.get(AI_PROVIDER_STORAGE_KEY)).toBe(raw);
    const retried = await loadAIProviderConfiguration();
    expect(retried).toMatchObject({ kind: "ready", state: { version: 2, migratedLegacyProviders: ["openai"] } });
    expect(await loadAIProviderConfiguration()).toEqual(retried);
  });

  it("shares a pending migration and exposes no profile until storage confirms the write", async () => {
    let finishWrite!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      vi.mocked(LocalStorage.setItem).mockImplementationOnce(
        (key, value) =>
          new Promise<void>((finish) => {
            finishWrite = () => {
              storage.set(key, String(value));
              finish();
            };
            resolve();
          }),
      );
    });
    const first = loadAIProviderConfiguration();
    const second = loadAIProviderConfiguration();
    const exposed = vi.fn();
    void first.then(exposed);
    await writeStarted;
    expect(exposed).not.toHaveBeenCalled();
    finishWrite();
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(LocalStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["{broken", "invalid"],
    [JSON.stringify({ version: 99, profiles: [] }), "unsupported"],
    [JSON.stringify({ version: 1, profiles: [{ id: "incomplete" }] }), "invalid"],
  ])("preserves unreadable stored configuration %s without importing preferences", async (raw, kind) => {
    storage.set(AI_PROVIDER_STORAGE_KEY, raw);
    expect(await loadAIProviderConfiguration()).toMatchObject({ kind, rawValue: raw });
    expect(LocalStorage.setItem).not.toHaveBeenCalled();
    expect(storage.get(AI_PROVIDER_STORAGE_KEY)).toBe(raw);
  });
});
