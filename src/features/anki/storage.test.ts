import { beforeEach, describe, expect, it, vi } from "vitest";

import { imageToken } from "./context";
import { defaultProfile, emptyDraft } from "./model";
import {
  clearDraft,
  decodeDraft,
  decodeSettings,
  draftKey,
  loadDraft,
  loadRecentDraft,
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

it("migrates legacy source and image paths into Context without modifying storage on read", async () => {
  const key = draftKey("grouper", "");
  const legacy = {
    ...emptyDraft("grouper"),
    source: "PADI lesson",
    context: "Original sentence",
    images: ["/old.png"],
  };
  const raw = JSON.stringify(legacy);
  data.set(key, raw);
  const result = await loadDraft(key);
  expect(result?.context).toBe(`Original sentence\n\nSource: PADI lesson\n\n${imageToken("/old.png")}`);
  expect(result).not.toHaveProperty("source");
  expect(data.get(key)).toBe(raw);
  await saveDraft(key, result!);
  expect(await loadDraft(key)).toEqual(result);
});
it("rejects future draft envelopes without discarding their content", () => {
  expect(() => decodeDraft(JSON.stringify({ version: 3, draft: emptyDraft() }))).toThrow("preserved");
});

it("finds the most recent unsent card without needing its original term or language", async () => {
  const key = draftKey("bearing", "en:zh-CHS");
  const draft = { ...emptyDraft("grouper"), context: "Copied after renaming the term" };
  await saveDraft(key, draft);
  expect(await loadRecentDraft()).toEqual({ key, draft });
  await clearDraft(key);
  expect(await loadRecentDraft()).toBeUndefined();
});
it("does not clear a newer draft when a different card is submitted", async () => {
  const first = draftKey("first", ""),
    second = draftKey("second", "");
  await saveDraft(first, emptyDraft("first"));
  await saveDraft(second, emptyDraft("second"));
  await clearDraft(first);
  expect((await loadRecentDraft())?.key).toBe(second);
  await saveDraft(draftKey("", ""), emptyDraft());
  expect((await loadRecentDraft())?.key).toBe(second);
});
it("preserves damaged recent draft data and reports it instead of opening a blank card", async () => {
  const key = draftKey("bearing", "");
  await saveDraft(key, emptyDraft("bearing"));
  data.set(key, '{"version":99,"untouched":true}');
  await expect(loadRecentDraft()).rejects.toThrow("preserved");
  expect(data.get(key)).toBe('{"version":99,"untouched":true}');
});
