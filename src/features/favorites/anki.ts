/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { timedFetch } from "@/shared/http";

import { type FavoriteWord, resolveFavoriteTranslations } from "./model";
import { getFavoriteView } from "./view";

/**
 * AnkiConnect add-on endpoint (https://ankiweb.net/shared/info/2055492159).
 * It listens on localhost only, on both macOS and Windows.
 */
const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

/** Note type created on first use; users may restyle its templates in Anki. */
export const ANKI_MODEL_NAME = "Easydict";
const ANKI_MODEL_FIELDS = ["Word", "Phonetic", "Translation", "Explanation", "Audio"] as const;
const ANKI_TEMPLATE_NAME = "Recognition";

const ANKI_MODEL_CSS = `.card { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 20px; text-align: center; }
.word { font-size: 36px; font-weight: 600; }
.phonetic { margin-top: 4px; opacity: 0.6; }
.translation { margin-top: 16px; line-height: 1.6; }
.explanation { margin-top: 12px; font-size: 16px; line-height: 1.6; opacity: 0.8; }`;

const ANKI_FRONT_TEMPLATE = `<div class="word">{{Word}}</div>
{{#Phonetic}}<div class="phonetic">{{Phonetic}}</div>{{/Phonetic}}
{{Audio}}`;

const ANKI_BACK_TEMPLATE = `{{FrontSide}}
<hr id="answer">
<div class="translation">{{Translation}}</div>
{{#Explanation}}<div class="explanation">{{Explanation}}</div>{{/Explanation}}`;

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<(typeof ANKI_MODEL_FIELDS)[number], string>;
  /** AnkiConnect downloads the file into Anki's media folder and appends `[sound:…]` to the listed fields. */
  audio?: { url: string; filename: string; fields: ["Audio"] }[];
  tags: string[];
  options: { allowDuplicate: false; duplicateScope: "deck" };
}

export interface AddToAnkiResult {
  added: number;
  /** Words already in the deck, or repeated within the same batch. */
  skipped: number;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function invokeAnki<T>(action: string, params: object = {}): Promise<T> {
  let response: { result: T; error: string | null };
  try {
    response = await timedFetch(ANKI_CONNECT_URL, {
      method: "POST",
      body: { action, version: 6, params },
      parseResponse: JSON.parse,
    });
  } catch {
    throw new Error("Could not connect to Anki. Open Anki and make sure the AnkiConnect add-on is installed.");
  }
  if (response.error) throw new Error(`AnkiConnect: ${response.error}`);
  return response.result;
}

async function ensureDeckAndModel(deckName: string) {
  await invokeAnki("createDeck", { deck: deckName });
  const modelNames = await invokeAnki<string[]>("modelNames");
  if (!modelNames.includes(ANKI_MODEL_NAME)) {
    await invokeAnki("createModel", {
      modelName: ANKI_MODEL_NAME,
      inOrderFields: ANKI_MODEL_FIELDS,
      css: ANKI_MODEL_CSS,
      isCloze: false,
      cardTemplates: [{ Name: ANKI_TEMPLATE_NAME, Front: ANKI_FRONT_TEMPLATE, Back: ANKI_BACK_TEMPLATE }],
    });
    return;
  }

  // Note types created by an earlier version lack newer fields; add them and refresh the templates to show them.
  const fieldNames = await invokeAnki<string[]>("modelFieldNames", { modelName: ANKI_MODEL_NAME });
  const missingFields = ANKI_MODEL_FIELDS.filter((field) => !fieldNames.includes(field));
  if (!missingFields.length) return;
  for (const fieldName of missingFields) {
    await invokeAnki("modelFieldAdd", { modelName: ANKI_MODEL_NAME, fieldName });
  }
  await invokeAnki("updateModelTemplates", {
    model: {
      name: ANKI_MODEL_NAME,
      templates: { [ANKI_TEMPLATE_NAME]: { Front: ANKI_FRONT_TEMPLATE, Back: ANKI_BACK_TEMPLATE } },
    },
  });
  await invokeAnki("updateModelStyling", { model: { name: ANKI_MODEL_NAME, css: ANKI_MODEL_CSS } });
}

/**
 * Map a saved favorite to an AnkiConnect note: word, phonetic and pronunciation on the front;
 * translations and dictionary explanations (Youdao explanations, AI definitions) on the back.
 */
export function buildAnkiNote(favorite: FavoriteWord, deckName: string): AnkiNote {
  const rows = getFavoriteView(favorite).flatMap((section) => section.items);
  const phonetic = rows.find((row) => row.accessory?.phonetic)?.accessory?.phonetic ?? favorite.query.phonetic ?? "";
  const translations = resolveFavoriteTranslations(favorite) ?? [];
  const explanations = rows.filter((row) => row.kind === "definition").map((row) => row.copyText);
  const speechUrl =
    favorite.query.speechUrl ?? rows.find((row) => row.service.query.speechUrl)?.service.query.speechUrl;
  const audioName = favorite.query.word.replace(/[^\p{L}\p{N}]+/gu, "_");
  return {
    deckName,
    modelName: ANKI_MODEL_NAME,
    fields: {
      Word: escapeHtml(favorite.query.word),
      Phonetic: escapeHtml(phonetic),
      Translation: translations.map(escapeHtml).join("<br>"),
      Explanation: explanations.map(escapeHtml).join("<br>"),
      Audio: "",
    },
    audio: speechUrl
      ? [{ url: speechUrl, filename: `easydict-${favorite.query.fromLanguage}-${audioName}.mp3`, fields: ["Audio"] }]
      : undefined,
    tags: ["easydict"],
    options: { allowDuplicate: false, duplicateScope: "deck" },
  };
}

/**
 * Add favorites to an Anki deck, creating the deck and the Easydict note type
 * when missing. Words already in the deck are skipped instead of failing the batch.
 */
export async function addFavoritesToAnki(
  favorites: readonly FavoriteWord[],
  deckName: string,
): Promise<AddToAnkiResult> {
  await ensureDeckAndModel(deckName);

  // The same word saved in several language directions maps to one Anki note.
  const seen = new Set<string>();
  const notes = favorites
    .map((favorite) => buildAnkiNote(favorite, deckName))
    .filter((note) => !seen.has(note.fields.Word) && seen.add(note.fields.Word));

  const checks = await invokeAnki<{ canAdd: boolean; error?: string }[]>("canAddNotesWithErrorDetail", { notes });
  const failure = checks.find((check) => !check.canAdd && !check.error?.includes("duplicate"));
  if (failure) throw new Error(`AnkiConnect: ${failure.error}`);

  const addable = notes.filter((_, index) => checks[index].canAdd);
  if (addable.length) await invokeAnki("addNotes", { notes: addable });
  return { added: addable.length, skipped: favorites.length - addable.length };
}
