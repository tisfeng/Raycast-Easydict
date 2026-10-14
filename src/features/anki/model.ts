import { parse } from "node-html-parser";

import { escapeHtml } from "@/core/content/markdown";
import type { ViewRow } from "@/core/content/viewTypes";

import { referencedImages, renderContext } from "./context";
import { exampleHtml, textHtml } from "./html";

export { textHtml } from "./html";

export const slots = ["term", "meaning", "example", "context"] as const;
export type Slot = (typeof slots)[number];
export interface AnkiProfile {
  id: string;
  name: string;
  fromLanguage: string;
  toLanguage: string;
  deck: string;
  model: string;
  mapping: Record<Slot, string>;
  tags: string[];
}
export interface AnkiSettings {
  version: 1;
  url: string;
  apiKey: string;
  activeProfileId: string;
  profiles: AnkiProfile[];
}
export interface CaptureDraft {
  profileId: string;
  term: string;
  meaning: string;
  example: string;
  context: string;
  images: string[];
  extra: Record<string, string>;
}
export function defaultProfile(): AnkiProfile {
  return {
    id: "en-zh",
    name: "English → Chinese",
    fromLanguage: "en",
    toLanguage: "zh-CHS",
    deck: "",
    model: "",
    mapping: { term: "English", meaning: "Chinese", example: "Example", context: "Context" },
    tags: ["easydict", "inbox"],
  };
}
export function emptyDraft(term = ""): CaptureDraft {
  return { profileId: "en-zh", term, meaning: "", example: "", context: "", images: [], extra: {} };
}
export function seedFromRow(row: ViewRow, example = ""): CaptureDraft {
  return {
    ...emptyDraft(row.service.query.word),
    meaning: row.kind === "example" ? "" : row.copyText,
    example: row.exampleSentence ?? (row.kind === "example" ? row.title : example),
  };
}
export function validateProfile(profile: AnkiProfile, fields: string[]) {
  if (!profile.name.trim() || !profile.deck.trim() || !profile.model.trim()) {
    throw new Error("Choose a profile name, deck, and note type in Anki Settings.");
  }
  if (!profile.fromLanguage.trim() || !profile.toLanguage.trim()) throw new Error("Set both profile languages.");
  if (!profile.mapping.term) throw new Error("Map the Term field.");
  const mapped = slots.map((slot) => profile.mapping[slot]).filter(Boolean);
  if (new Set(mapped).size !== mapped.length) throw new Error("Each source must map to a different Anki field.");
  const missing = mapped.filter((field) => !fields.includes(field));
  if (missing.length) throw new Error(`Fields no longer exist: ${missing.join(", ")}. Update Anki Settings.`);
}
export function contextHtml(draft: CaptureDraft, filenames: string[]): string {
  return renderContext(draft.context.trim(), referencedImages(draft), (_, index) =>
    filenames[index] ? `<img src="${escapeHtml(filenames[index])}">` : "[Context image]",
  );
}
export function buildFields(profile: AnkiProfile, draft: CaptureDraft, fields: string[], filenames: string[] = []) {
  validateProfile(profile, fields);
  if (!draft.term.trim()) throw new Error("Enter a word or phrase.");
  if (!profile.mapping.context && (draft.context.trim() || referencedImages(draft).length)) {
    throw new Error("Map Context before adding context, sources, or images.");
  }
  const result: Record<string, string> = Object.fromEntries(
    fields.map((field) => [field, textHtml((draft.extra[field] ?? "").trim())]),
  );
  for (const slot of slots) {
    const field = profile.mapping[slot];
    if (field)
      result[field] =
        slot === "context"
          ? contextHtml(draft, filenames)
          : slot === "example"
            ? exampleHtml(draft.example, draft.term)
            : textHtml(draft[slot].trim());
  }
  return result;
}
export function normalizedTerm(html: string): string {
  return parse(html).textContent.normalize("NFC").trim().toLocaleLowerCase("en-US");
}
export function switchDraftProfile(draft: CaptureDraft, profileId: string): CaptureDraft {
  // Semantic content survives; arbitrary fields belong to the previous note type.
  return { ...draft, profileId, extra: {} };
}
