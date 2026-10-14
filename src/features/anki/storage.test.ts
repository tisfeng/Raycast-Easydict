import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultProfile, emptyDraft } from "./model";
import {
  clearDraft,
  decodeDraft,
  decodeSettings,
  draftKey,
  loadDraft,
  loadSettings,
  saveDraft,
  saveSettings,
} from "./storage";

const data = vi.hoisted(() => new Map<string, string>());
vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: async (key: string) => data.get(key),
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  },
}));
vi.mock("@/consts", () => ({ myPreferences: { ankiConnectUrl: "http://localhost:8765" } }));
beforeEach(() => data.clear());
describe("isolated capture persistence", () => {
  it("starts with an unconfigured English-Chinese profile and saves configured profiles", async () => {
    const settings = await loadSettings();
    expect(settings.profiles).toEqual([defaultProfile()]);
    const next = {
      ...settings,
      apiKey: "local-only",
      profiles: [{ ...defaultProfile(), model: "Basic", deck: "Default" }],
    };
    await saveSettings(next);
    expect(await loadSettings()).toEqual(next);
  });
  it("restores unsent text, images and custom fields without touching legacy favorites", async () => {
    data.set("favorite-content-v1", "existing favorite data");
    const key = draftKey("charge", "en:zh-CHS");
    const draft = {
      ...emptyDraft("charge"),
      context: "Original source",
      images: ["/example.png"],
      extra: { Custom: "value" },
    };
    await saveDraft(key, draft);
    expect(await loadDraft(key)).toEqual(draft);
    await clearDraft(key);
    expect(await loadDraft(key)).toBeUndefined();
    expect(data.get("favorite-content-v1")).toBe("existing favorite data");
  });
  it("keeps language directions separate and serializes writes before clearing a successful draft", async () => {
    expect(draftKey("charge", "en:zh-CHS")).not.toBe(draftKey("charge", "fr:en"));
    const key = draftKey("x", "");
    await Promise.all([saveDraft(key, emptyDraft("first")), saveDraft(key, emptyDraft("last")), clearDraft(key)]);
    expect(await loadDraft(key)).toBeUndefined();
  });
  it("rejects malformed or future configuration without overwriting original data", async () => {
    const raw = JSON.stringify({ version: 9 });
    data.set("anki-capture-settings-v1", raw);
    await expect(loadSettings()).rejects.toThrow("preserved");
    expect(data.get("anki-capture-settings-v1")).toBe(raw);
    expect(() => decodeDraft(JSON.stringify({ ...emptyDraft(), extra: { bad: 123 } }))).toThrow("preserved");
    expect(() => decodeSettings(JSON.stringify({ version: 1, profiles: [] }))).toThrow();
  });
});
