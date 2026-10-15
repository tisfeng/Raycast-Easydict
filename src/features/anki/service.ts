import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import type { AnkiClient } from "./client";
import { referencedImages } from "./context";
import { generateIdentifier, resolveIdField } from "./identifier";
import { type AnkiProfile, buildFields, type CaptureDraft, contextHtml, normalizedTerm, textHtml } from "./model";

export interface ExistingNote {
  noteId: number;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
}
export type SaveChoice = { kind: "add" } | { kind: "new-sense" } | { kind: "append"; noteId: number };
export type SaveResult =
  { kind: "duplicates"; notes: ExistingNote[] } | { kind: "added" | "appended"; noteId: number; generatedId?: string };
function quoted(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function findDuplicates(client: AnkiClient, profile: AnkiProfile, term: string): Promise<ExistingNote[]> {
  // Search only the deck/model, then compare decoded field values exactly. This avoids treating
  // punctuation, wildcards, or HTML inside arbitrary mapped fields as Anki search syntax.
  const cardIds = await client.call<number[]>("findCards", {
    query: `${quoted(`deck:${profile.deck}`)} ${quoted(`note:${profile.model}`)}`,
  });
  const noteIds = new Set<number>();
  for (let i = 0; i < cardIds.length; i += 100) {
    const cards = await client.call<{ note: number; deckName: string }[]>("cardsInfo", {
      cards: cardIds.slice(i, i + 100),
    });
    // Anki deck searches include subdecks; only notes with a card in this exact deck qualify.
    for (const card of cards) if (card.deckName === profile.deck) noteIds.add(card.note);
  }
  const ids = [...noteIds];
  const matches: ExistingNote[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const notes = await client.call<ExistingNote[]>("notesInfo", { notes: ids.slice(i, i + 100) });
    matches.push(
      ...notes.filter(
        (note) =>
          note.modelName === profile.model &&
          normalizedTerm(note.fields[profile.mapping.term]?.value ?? "") === normalizedTerm(textHtml(term)),
      ),
    );
  }
  return matches;
}
export function imageExtension(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new Error("Choose PNG, JPEG, GIF, or WebP images. Convert other formats first.");
}
export async function loadImages(paths: string[]) {
  if (paths.length > 10) throw new Error("Attach at most 10 images per note.");
  return Promise.all(
    [...new Set(paths)].map(async (path) => {
      const info = await stat(path);
      if (!info.isFile() || info.size > 10 * 1024 * 1024)
        throw new Error("Each image must be a file of at most 10 MB.");
      const bytes = await readFile(path);
      const ext = imageExtension(bytes);
      return {
        filename: `easydict-${createHash("sha256").update(bytes).digest("hex")}.${ext}`,
        data: bytes.toString("base64"),
      };
    }),
  );
}
export async function saveCapture(
  client: AnkiClient,
  profile: AnkiProfile,
  draft: CaptureDraft,
  choice: SaveChoice = { kind: "add" },
): Promise<SaveResult> {
  const fields = await client.fields(profile.model);
  buildFields(profile, draft, fields);
  const decks = await client.call<string[]>("deckNames");
  if (!decks.includes(profile.deck)) throw new Error("The selected deck no longer exists. Update Anki Settings.");
  const duplicates = await findDuplicates(client, profile, draft.term);
  if (choice.kind === "add" && duplicates.length) return { kind: "duplicates", notes: duplicates };
  if (choice.kind === "append" && !duplicates.some((note) => note.noteId === choice.noteId)) {
    throw new Error("The selected note changed or moved. Check for duplicates again.");
  }
  if (
    choice.kind === "append" &&
    (!profile.mapping.context || (!draft.context.trim() && !referencedImages(draft).length))
  ) {
    throw new Error("Enter context or attach an image, and map Context before appending.");
  }
  const images = await loadImages(referencedImages(draft));
  const note = {
    deckName: profile.deck,
    modelName: profile.model,
    fields: buildFields(
      profile,
      draft,
      fields,
      images.map((image) => image.filename),
    ),
    tags: profile.tags,
    options: { allowDuplicate: choice.kind === "new-sense", duplicateScope: "deck" },
  };
  const idField = resolveIdField(profile, fields);
  let generatedId: string | undefined;
  if (choice.kind !== "append" && idField) {
    generatedId = await generateIdentifier(client, profile, draft.term, idField);
    note.fields[idField] = generatedId;
  }
  if (choice.kind !== "append") {
    const checks = await client.call<{ canAdd: boolean; error?: string }[]>("canAddNotesWithErrorDetail", {
      notes: [note],
    });
    if (!checks[0]?.canAdd)
      throw new Error(checks[0]?.error ?? "Anki rejected this note. Check required fields and cloze syntax.");
  }
  const filenames: string[] = [];
  for (const image of images) {
    const filename = await client.call<string>("storeMediaFile", image, true);
    if (typeof filename !== "string" || !filename || /[\\/]/.test(filename))
      throw new Error("Anki returned an invalid media filename.");
    filenames.push(filename);
  }
  if (choice.kind === "append") {
    // Read again after media uploads so a stale preview cannot overwrite an intervening edit.
    const [latest] = await client.call<ExistingNote[]>("notesInfo", { notes: [choice.noteId] });
    const field = profile.mapping.context;
    if (
      !latest ||
      latest.noteId !== choice.noteId ||
      latest.modelName !== profile.model ||
      !latest.fields[field] ||
      normalizedTerm(latest.fields[profile.mapping.term]?.value ?? "") !== normalizedTerm(textHtml(draft.term))
    ) {
      throw new Error("The selected note changed. Reload duplicates before appending.");
    }
    const addition = contextHtml(draft, filenames);
    const previous = latest.fields[field].value;
    await client.call(
      "updateNoteFields",
      { note: { id: choice.noteId, fields: { [field]: previous ? `${previous}<br><br>${addition}` : addition } } },
      true,
    );
    return { kind: "appended", noteId: choice.noteId };
  }
  note.fields = buildFields(profile, draft, fields, filenames);
  if (idField && generatedId) {
    // Media writes may take time; refresh against current notes before adding.
    if (images.length) generatedId = await generateIdentifier(client, profile, draft.term, idField);
    note.fields[idField] = generatedId;
  }
  const noteId = await client.call<number>("addNote", { note }, true);
  if (!Number.isSafeInteger(noteId) || noteId <= 0)
    throw new Error("Anki did not return a note ID. Check Anki before retrying.");
  return { kind: "added", noteId, ...(generatedId ? { generatedId } : {}) };
}
