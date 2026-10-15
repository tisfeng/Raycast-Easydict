import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnkiClient } from "./client";
import { generateIdentifier, nextIdentifier, resolveIdField } from "./identifier";
import { defaultProfile, emptyDraft, validateProfile } from "./model";
import { saveCapture } from "./service";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ ofetch: rpc }));
const profile = { ...defaultProfile(), deck: "Study", model: "Vocabulary" };
const fields = ["ID", "English", "Chinese", "Example", "Context"];
const client = new AnkiClient({ url: "http://localhost:8765", apiKey: "" });
let stored: string[];
let added: Record<string, string>[];
beforeEach(() => {
  stored = ["en.bearing.01", "en.bearing.02", "en.other.99"];
  added = [];
  rpc.mockReset();
  rpc.mockImplementation(async (_url, options) => {
    const { action, params } = options.body;
    switch (action) {
      case "modelFieldNames":
        return { result: fields, error: null };
      case "deckNames":
        return { result: ["Study"], error: null };
      case "findCards":
        return { result: [], error: null };
      case "findNotes":
        return { result: stored.map((_, i) => i + 1), error: null };
      case "notesInfo":
        return {
          result: params.notes.map((id: number) => ({
            modelName: profile.model,
            fields: { ID: { value: stored[id - 1] } },
          })),
          error: null,
        };
      case "canAddNotesWithErrorDetail":
        return { result: [{ canAdd: !!params.notes[0].fields.ID }], error: null };
      case "addNote":
        added.push({ ...params.note.fields });
        stored.push(params.note.fields.ID);
        return { result: 42 + added.length, error: null };
      default:
        throw new Error(`Unexpected ${action}`);
    }
  });
});
describe("automatic user-facing IDs", () => {
  it("continues the highest suffix and does not reuse gaps", () => {
    expect(nextIdentifier("en", "bearing", ["en.bearing.01", "en.bearing.03"])).toBe("en.bearing.04");
    expect(nextIdentifier("en", "bearing", ["en.bearing.99"])).toBe("en.bearing.100");
    expect(nextIdentifier("en", "bearing", ["en.bearing.0009"])).toBe("en.bearing.0010");
  });
  it("starts at 01, normalizes terms, and ignores unrelated or malformed IDs", () => {
    expect(nextIdentifier("en", "Bearing", ["en.other.99", "fr.bearing.10", "en.bearing.bad"])).toBe("en.bearing.01");
    expect(nextIdentifier("en", "neutral buoyancy", [])).toBe("en.neutral-buoyancy.01");
    expect(nextIdentifier("en", "bearing", ["<b>EN.BEARING.02</b>"])).toBe("en.bearing.03");
  });
  it("detects ID case-insensitively and supports custom mapping or disabling", () => {
    expect(resolveIdField(profile, ["Id", "English"])).toBe("Id");
    expect(resolveIdField(profile, ["English"])).toBeUndefined();
    expect(resolveIdField({ ...profile, idField: "" }, fields)).toBeUndefined();
    expect(resolveIdField({ ...profile, idField: "Identifier" }, ["Identifier"])).toBe("Identifier");
    expect(() => validateProfile({ ...profile, idField: "English" }, fields)).toThrow("another mapping");
    expect(() => validateProfile({ ...profile, idField: "Gone" }, fields)).toThrow("ID field no longer exists");
  });
  it("reads the whole note type across decks before creating a new ID", async () => {
    expect(await generateIdentifier(client, profile, "bearing", "ID")).toBe("en.bearing.03");
    const query = rpc.mock.calls.find(([, options]) => options.body.action === "findNotes")?.[1].body.params.query;
    expect(query).toBe('"note:Vocabulary"');
  });
  it("adds the next ID before Anki validation, and increments it again for a new sense", async () => {
    const result = await saveCapture(client, profile, emptyDraft("bearing"));
    expect(result).toEqual({ kind: "added", noteId: 43, generatedId: "en.bearing.03" });
    expect(added[0].ID).toBe("en.bearing.03");
    expect(added[0].Example).toBe('<b class="target">bearing</b>');
    await saveCapture(client, profile, emptyDraft("bearing"), { kind: "new-sense" });
    expect(added[1].ID).toBe("en.bearing.04");
  });
  it("does not silently fall back to 01 if existing IDs cannot be read", async () => {
    const normal = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (url, options) =>
      options.body.action === "findNotes" ? { result: null, error: "collection unavailable" } : normal(url, options),
    );
    await expect(saveCapture(client, profile, emptyDraft("bearing"))).rejects.toThrow("collection unavailable");
    expect(added).toHaveLength(0);
  });
  it("does not assign an ID when merely appending Context", async () => {
    const normal = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (url, options) => {
      switch (options.body.action) {
        case "findCards":
          return { result: [7], error: null };
        case "cardsInfo":
          return { result: [{ note: 7, deckName: "Study" }], error: null };
        case "notesInfo":
          return {
            result: [
              {
                noteId: 7,
                modelName: profile.model,
                fields: { ID: { value: "en.bearing.02" }, English: { value: "bearing" }, Context: { value: "old" } },
              },
            ],
            error: null,
          };
        case "updateNoteFields":
          return { result: null, error: null };
        default:
          return normal(url, options);
      }
    });
    await saveCapture(client, profile, { ...emptyDraft("bearing"), context: "new" }, { kind: "append", noteId: 7 });
    expect(rpc.mock.calls.some(([, options]) => options.body.action === "findNotes")).toBe(false);
    const update = rpc.mock.calls.find(([, options]) => options.body.action === "updateNoteFields")?.[1].body.params
      .note.fields;
    expect(Object.keys(update)).toEqual(["Context"]);
  });
});
