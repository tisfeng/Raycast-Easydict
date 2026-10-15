import type { AnkiClient } from "./client";
import type { AnkiProfile } from "./model";
import { normalizedTerm } from "./model";

export function resolveIdField(profile: AnkiProfile, fields: string[]): string | undefined {
  if (profile.idField !== undefined) return profile.idField || undefined;
  return fields.find((field) => field.toLowerCase() === "id" && !Object.values(profile.mapping).includes(field));
}
export function identifierPrefix(language: string, term: string): string {
  const word = term
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const lang = language
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!word || !lang) throw new Error("Enter a word and profile source language to generate an ID.");
  return `${lang}.${word}`;
}
export function nextIdentifier(language: string, term: string, existing: string[]): string {
  const prefix = `${identifierPrefix(language, term)}.`;
  let maximum = 0n;
  let width = 2;
  for (const value of existing) {
    const id = normalizedTerm(value);
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const number = BigInt(suffix);
    width = Math.max(width, suffix.length);
    if (number > maximum) maximum = number;
  }
  return `${prefix}${(maximum + 1n).toString().padStart(width, "0")}`;
}
export async function generateIdentifier(
  client: AnkiClient,
  profile: AnkiProfile,
  term: string,
  field: string,
): Promise<string> {
  const model = profile.model.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  // Include all decks: moving a card must not reset the sequence for this note type.
  const ids = await client.call<number[]>("findNotes", { query: `"note:${model}"` });
  const values: string[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const notes = await client.call<{ modelName: string; fields: Record<string, { value: string }> }[]>("notesInfo", {
      notes: ids.slice(index, index + 100),
    });
    for (const note of notes)
      if (note.modelName === profile.model && note.fields[field]) values.push(note.fields[field].value);
  }
  return nextIdentifier(profile.fromLanguage, term, values);
}
