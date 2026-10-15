import { createHash } from "node:crypto";

import { LocalStorage } from "@raycast/api";

import { myPreferences } from "@/consts";

import { imageToken } from "./context";
import { type AnkiProfile, type AnkiSettings, type CaptureDraft, defaultProfile, slots } from "./model";

const SETTINGS_KEY = "anki-capture-settings-v1";
const RECENT_DRAFT_KEY = "anki-capture-recent-draft-v1";
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isProfile(p: unknown): p is AnkiProfile {
  if (!record(p) || !record(p.mapping)) return false;
  const mapping = p.mapping;
  return (
    ["id", "name", "fromLanguage", "toLanguage", "deck", "model"].every((key) => typeof p[key] === "string") &&
    slots.every((slot) => typeof mapping[slot] === "string") &&
    strings(p.tags) &&
    (p.idField === undefined || typeof p.idField === "string")
  );
}
function isDraft(value: unknown): value is CaptureDraft {
  return (
    record(value) &&
    ["profileId", ...slots].every((key) => typeof value[key] === "string") &&
    strings(value.images) &&
    record(value.extra) &&
    Object.values(value.extra).every((v) => typeof v === "string")
  );
}
export function decodeSettings(raw: string): AnkiSettings {
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.url !== "string" ||
    typeof value.apiKey !== "string" ||
    typeof value.activeProfileId !== "string" ||
    !Array.isArray(value.profiles) ||
    !value.profiles.length
  ) {
    throw new Error("Cannot read Anki settings. Original data is preserved; use a compatible extension version.");
  }
  if (!value.profiles.every(isProfile)) throw new Error("Invalid Anki profile. Original settings are preserved.");
  const settings: AnkiSettings = {
    version: 1,
    url: value.url,
    apiKey: value.apiKey,
    activeProfileId: value.activeProfileId,
    profiles: value.profiles,
  };
  if (
    new Set(settings.profiles.map((p) => p.id)).size !== settings.profiles.length ||
    !settings.profiles.some((p) => p.id === settings.activeProfileId)
  )
    throw new Error("Invalid Anki profile IDs.");
  return settings;
}
export async function loadSettings(): Promise<AnkiSettings> {
  const raw = await LocalStorage.getItem<string>(SETTINGS_KEY);
  if (raw !== undefined) return decodeSettings(raw);
  return {
    version: 1,
    url: myPreferences.ankiConnectUrl || "http://127.0.0.1:8765",
    apiKey: "",
    activeProfileId: "en-zh",
    profiles: [defaultProfile()],
  };
}
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>) {
  const next = queue.then(operation, operation);
  queue = next.catch(() => undefined);
  return next;
}
export function saveSettings(settings: AnkiSettings) {
  decodeSettings(JSON.stringify(settings));
  return serialize(() => LocalStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)));
}
export function draftKey(term: string, direction: string) {
  return `anki-capture-draft-v1:${createHash("sha256")
    .update(JSON.stringify([term, direction]))
    .digest("hex")}`;
}
export function decodeDraft(raw: string): CaptureDraft {
  const value: unknown = JSON.parse(raw);
  if (record(value) && "version" in value) {
    if (value.version !== 2 || !isDraft(value.draft))
      throw new Error("Cannot read saved capture draft. Original draft is preserved.");
    return value.draft;
  }
  if (!isDraft(value) || !("source" in value) || typeof value.source !== "string")
    throw new Error("Cannot read saved capture draft. Original draft is preserved.");
  const context = [
    value.context,
    value.source.trim() ? `Source: ${value.source.trim()}` : "",
    ...value.images.filter((path) => !value.context.includes(imageToken(path))).map(imageToken),
  ]
    .filter(Boolean)
    .join("\n\n");
  const { profileId, term, meaning, example, images, extra } = value;
  return { profileId, term, meaning, example, context, images, extra };
}
export async function loadDraft(key: string) {
  const raw = await LocalStorage.getItem<string>(key);
  return raw === undefined ? undefined : decodeDraft(raw);
}
export function saveDraft(key: string, draft: CaptureDraft) {
  return serialize(async () => {
    await LocalStorage.setItem(key, JSON.stringify({ version: 2, draft }));
    const hasContent =
      [draft.term, draft.meaning, draft.example, draft.context, ...Object.values(draft.extra)].some((value) =>
        value.trim(),
      ) || draft.images.length > 0;
    if (hasContent) await LocalStorage.setItem(RECENT_DRAFT_KEY, key);
    else if ((await LocalStorage.getItem<string>(RECENT_DRAFT_KEY)) === key)
      await LocalStorage.removeItem(RECENT_DRAFT_KEY);
  });
}
export function clearDraft(key: string) {
  return serialize(async () => {
    await LocalStorage.removeItem(key);
    if ((await LocalStorage.getItem<string>(RECENT_DRAFT_KEY)) === key) await LocalStorage.removeItem(RECENT_DRAFT_KEY);
  });
}

export async function loadRecentDraft(): Promise<{ key: string; draft: CaptureDraft } | undefined> {
  const key = await LocalStorage.getItem<string>(RECENT_DRAFT_KEY);
  if (key === undefined) return undefined;
  if (typeof key !== "string" || !/^anki-capture-draft-v1:[a-f0-9]{64}$/.test(key)) {
    throw new Error("Cannot read the recent draft reference. Original data is preserved.");
  }
  const draft = await loadDraft(key);
  return draft ? { key, draft } : undefined;
}
