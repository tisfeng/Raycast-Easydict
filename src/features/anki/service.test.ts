import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DictionaryType } from "@/core/results/kinds";

import { AnkiClient, endpoint } from "./client";
import { imageToken } from "./context";
import { buildFields, defaultProfile, emptyDraft, normalizedTerm, seedFromRow, switchDraftProfile } from "./model";
import { findDuplicates, imageExtension, saveCapture } from "./service";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ ofetch: rpc }));
const profile = { ...defaultProfile(), deck: "English", model: "Vocabulary" };
const draft = { ...emptyDraft("charge"), meaning: "收费", context: "They charged us $20.\n\nSource: Lesson 1" };
const client = new AnkiClient({ url: "http://127.0.0.1:8765", apiKey: "test-only" });
const fields = ["English", "Chinese", "Example", "Context", "Extra"];
const existing = {
  noteId: 17,
  modelName: profile.model,
  fields: {
    English: { value: "charge", order: 0 },
    Chinese: { value: "旧释义", order: 1 },
    Context: { value: '<img src="old.png">Original context', order: 3 },
  },
};
let ids: number[];
let temporary: string | undefined;
function actions() {
  return rpc.mock.calls.map(([, options]) => options.body.action);
}
function params(action: string) {
  return rpc.mock.calls.find(([, options]) => options.body.action === action)?.[1].body.params;
}
beforeEach(() => {
  rpc.mockReset();
  ids = [];
  rpc.mockImplementation(async (_url, options) => {
    const { action } = options.body;
    const results: Record<string, unknown> = {
      modelFieldNames: fields,
      deckNames: [profile.deck],
      findCards: ids,
      cardsInfo: [{ note: 17, deckName: profile.deck }],
      notesInfo: [existing],
      canAddNotesWithErrorDetail: [{ canAdd: true }],
      addNote: 42,
      updateNoteFields: null,
      storeMediaFile: "stored.png",
    };
    if (!(action in results)) throw new Error(`Unexpected ${action}`);
    return { result: results[action], error: null };
  });
});
afterEach(async () => {
  if (temporary) {
    await rm(temporary, { recursive: true, force: true });
    temporary = undefined;
  }
});
describe("Anki capture contract", () => {
  it("sends configured credentials, disables retries, and escapes plain text fields", async () => {
    await saveCapture(client, profile, { ...draft, meaning: '<script>alert("x")</script>\n中文' });
    const note = params("addNote").note;
    expect(note.fields.Chinese).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>中文");
    expect(note.fields.Context).toBe("They charged us $20.<br><br>Source: Lesson 1");
    expect(note.options.allowDuplicate).toBe(false);
    expect(note.tags).toEqual(["easydict", "inbox"]);
    for (const [, options] of rpc.mock.calls) {
      expect(options).toMatchObject({ retry: 0, timeout: 15000, body: { version: 6, key: "test-only" } });
    }
  });
  it("returns every exact duplicate before any write or media upload", async () => {
    ids = [17];
    const result = await saveCapture(client, profile, draft);
    expect(result).toEqual({ kind: "duplicates", notes: [existing] });
    expect(actions()).not.toContain("addNote");
    expect(actions()).not.toContain("storeMediaFile");
  });
  it("treats punctuation and wildcards as literal term text", async () => {
    ids = [17];
    expect(await findDuplicates(client, profile, 'charge*" OR deck:*')).toEqual([]);
    expect(params("findCards").query).toBe('"deck:English" "note:Vocabulary"');
    expect(normalizedTerm("<b>CHARGE</b>&nbsp;")).toBe("charge");
  });
  it("allows a new sense only when explicitly requested", async () => {
    ids = [17];
    expect(await saveCapture(client, profile, draft, { kind: "new-sense" })).toEqual({ kind: "added", noteId: 42 });
    expect(params("addNote").note.options.allowDuplicate).toBe(true);
  });
  it("re-reads the chosen note and appends only Context, preserving old media and fields", async () => {
    ids = [17];
    await saveCapture(client, profile, draft, { kind: "append", noteId: 17 });
    expect(actions().filter((action) => action === "notesInfo")).toHaveLength(2);
    expect(params("updateNoteFields")).toEqual({
      note: {
        id: 17,
        fields: {
          Context: '<img src="old.png">Original context<br><br>They charged us $20.<br><br>Source: Lesson 1',
        },
      },
    });
    expect(actions()).not.toContain("addNote");
  });
  it("rejects an unselected or stale duplicate ID without writing", async () => {
    ids = [17];
    await expect(saveCapture(client, profile, draft, { kind: "append", noteId: 999 })).rejects.toThrow(
      "changed or moved",
    );
    expect(actions()).not.toContain("updateNoteFields");
  });
  it("checks note validity before uploading media and uses Anki's returned filename", async () => {
    temporary = await mkdtemp(join(tmpdir(), "easydict-test-"));
    const path = join(temporary, "screenshot.png");
    await writeFile(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
    await saveCapture(client, profile, {
      ...draft,
      context: `${draft.context}\n\n${imageToken(path)}`,
      images: [path],
    });
    expect(params("storeMediaFile").filename).toMatch(/^easydict-[a-f0-9]{64}\.png$/);
    expect(params("storeMediaFile").data).toBeTruthy();
    expect(params("addNote").note.fields.Context).toContain('<img src="stored.png">');
    expect(actions().indexOf("canAddNotesWithErrorDetail")).toBeLessThan(actions().indexOf("storeMediaFile"));
  });
  it("does not create a note when media upload fails", async () => {
    temporary = await mkdtemp(join(tmpdir(), "easydict-test-"));
    const path = join(temporary, "image.png");
    await writeFile(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const normal = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (url, options) =>
      options.body.action === "storeMediaFile" ? { result: null, error: "disk full" } : normal(url, options),
    );
    await expect(
      saveCapture(client, profile, { ...draft, context: `${draft.context}\n\n${imageToken(path)}`, images: [path] }),
    ).rejects.toThrow("disk full");
    expect(actions()).not.toContain("addNote");
  });
  it("reports Anki validation errors without writing", async () => {
    const normal = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (url, options) =>
      options.body.action === "canAddNotesWithErrorDetail"
        ? { result: [{ canAdd: false, error: "first field is empty" }], error: null }
        : normal(url, options),
    );
    await expect(saveCapture(client, profile, draft)).rejects.toThrow("first field is empty");
    expect(actions()).not.toContain("addNote");
  });
  it("reports uncertain writes distinctly and never retries", async () => {
    rpc.mockRejectedValue(new Error("timeout"));
    await expect(client.call("addNote", {}, true)).rejects.toThrow("Check Anki before retrying");
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(client.call("modelNames")).rejects.toThrow("timed out");
  });
  it("does not modify an existing four-field note type", async () => {
    rpc.mockResolvedValue({ result: ["Easydict Capture"], error: null });
    await expect(client.createTemplate()).rejects.toThrow("already exists");
    expect(actions()).toEqual(["modelNames"]);
  });
});
describe("capture mapping", () => {
  it("maps to arbitrary fields and preserves manually entered cloze syntax", () => {
    const custom = { ...profile, mapping: { term: "Text", meaning: "Back Extra", example: "", context: "" } };
    const mapped = buildFields(custom, { ...emptyDraft("{{c1::charge}}"), meaning: "收费", extra: { Hint: "verb" } }, [
      "Text",
      "Back Extra",
      "Hint",
    ]);
    expect(mapped).toEqual({ Text: "{{c1::charge}}", "Back Extra": "收费", Hint: "verb" });
  });
  it("rejects missing or colliding mappings and prevents dropping context", () => {
    expect(() => buildFields(profile, draft, ["English"])).toThrow("no longer exist");
    expect(() =>
      buildFields({ ...profile, mapping: { ...profile.mapping, meaning: "English" } }, draft, fields),
    ).toThrow("different Anki field");
    expect(() => buildFields({ ...profile, mapping: { ...profile.mapping, context: "" } }, draft, fields)).toThrow(
      "Map Context",
    );
  });
  it("keeps semantic values and images when switching profiles, but clears arbitrary fields", () => {
    expect(switchDraftProfile({ ...draft, extra: { oldField: "old" } }, "ja")).toEqual({
      ...draft,
      extra: {},
      profileId: "ja",
    });
  });
  it("prefills the selected definition and a target placeholder without AI", () => {
    const result = seedFromRow({
      kind: "definition",
      title: "charge",
      copyText: "收费",
      service: {
        kind: "dictionary",
        query: { word: "charge", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true },
        serviceId: "youdao",
        serviceLabel: "Youdao",
        type: DictionaryType.Youdao,
        serviceIcon: { kind: "initials" },
      },
      renderBody: () => "",
    });
    expect(result).toMatchObject({
      term: "charge",
      meaning: "收费",
      example: '<b class="target">charge</b>',
      context: "",
    });
  });
  it("validates endpoints and rejects active-content files", () => {
    expect(endpoint("localhost:8765")).toBe("http://localhost:8765/");
    expect(() => endpoint("file:///tmp/anki")).toThrow("HTTP(S)");
    expect(() => imageExtension(Buffer.from("<svg onload='bad'>"))).toThrow("PNG");
  });
});
