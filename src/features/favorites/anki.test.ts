/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComposedService } from "@/core/content/compose";
import type { DictionaryContent } from "@/core/content/types";
import { DictionaryType, TranslationType } from "@/core/results/kinds";
import type { QueryWordInfo } from "@/core/results/types";

import { addFavoritesToAnki, buildAnkiNote, normalizeAnkiUrl, resolveAnkiDeckName } from "./anki";
import { buildFavoriteWord, type FavoriteWord } from "./model";

type AnkiRequestBody =
  | { action: "createDeck"; params: { deck: string } }
  | { action: "modelNames" }
  | { action: "canAddNotesWithErrorDetail" | "addNotes"; params: { notes: ReturnType<typeof buildAnkiNote>[] } };

const timedFetch = vi.hoisted(() => vi.fn());

vi.mock("@/shared/http", () => ({ timedFetch }));
// Saved content resolves SVG text colors against Raycast's appearance.
vi.mock("@raycast/api", () => ({ environment: { appearance: "light" } }));

const query: QueryWordInfo = { word: "ephemeral", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };

function translationService(paragraphs: string[], speechUrl?: string): ComposedService {
  return {
    type: TranslationType.Youdao,
    content: { kind: "translation", query: speechUrl ? { ...query, speechUrl } : query, paragraphs },
    serviceId: "youdao-translate",
    serviceLabel: "Youdao Translate",
    serviceOrder: 0,
  };
}

function dictionaryService(sections: DictionaryContent["sections"]): ComposedService {
  return {
    type: DictionaryType.Youdao,
    content: { kind: "dictionary", query, sections },
    serviceId: "youdao-dictionary",
    serviceLabel: "Youdao Dictionary",
    serviceOrder: 1,
  };
}

describe("normalizeAnkiUrl", () => {
  it("assumes plain http for an address typed without a scheme", () => {
    expect(normalizeAnkiUrl("127.0.0.1:8766")).toBe("http://127.0.0.1:8766");
  });

  it("keeps an explicit address and drops a trailing slash", () => {
    expect(normalizeAnkiUrl("http://anki.local:8766/")).toBe("http://anki.local:8766");
  });

  it("falls back to the default address when the preference is empty", () => {
    expect(normalizeAnkiUrl("")).toBe("http://127.0.0.1:8765");
  });
});

describe("resolveAnkiDeckName", () => {
  it("falls back to the default deck when the preference is empty", () => {
    expect(resolveAnkiDeckName("  ")).toBe("Easydict");
  });

  it("keeps a custom deck name without surrounding whitespace", () => {
    expect(resolveAnkiDeckName(" Japanese ")).toBe("Japanese");
  });
});

describe("buildAnkiNote", () => {
  it("puts the saved phonetic, translations, and dictionary explanations on the card", () => {
    const favorite = buildFavoriteWord(query, [
      translationService(["短暂的", "转瞬即逝的"]),
      dictionaryService([
        { kind: "translation", text: "短暂的", pronunciation: "/ɪˈfem(ə)rəl/" },
        {
          kind: "definitions",
          entries: [
            { kind: "plain", text: "adj. 短暂的" },
            { kind: "plain", text: "n. 短命的植物" },
          ],
        },
      ]),
    ]);

    const note = buildAnkiNote(favorite, "Easydict");

    expect(note.fields).toEqual({
      Word: "ephemeral",
      Phonetic: "/ɪˈfem(ə)rəl/",
      Translation: "短暂的<br>转瞬即逝的",
      Explanation: "adj. 短暂的<br>n. 短命的植物",
      Audio: "",
    });
    expect(note.deckName).toBe("Easydict");
    expect(note.options).toEqual({ allowDuplicate: false, duplicateScope: "deck" });
  });

  it("asks AnkiConnect to download the saved pronunciation into the Audio field", () => {
    const url = "https://dict.youdao.com/dictvoice?audio=ephemeral";
    const favorite = buildFavoriteWord({ ...query, speechUrl: url }, [
      dictionaryService([{ kind: "translation", text: "短暂的" }]),
    ]);
    const note = buildAnkiNote(favorite, "Easydict");

    expect(note.audio).toEqual([{ url, filename: "easydict-en-ephemeral.mp3", fields: ["Audio"] }]);
    expect(buildAnkiNote(buildFavoriteWord(query, [translationService(["短暂的"])]), "Easydict").audio).toBeUndefined();
  });

  it("falls back to a later saved result when the saved word has an empty audio URL", () => {
    const url = "https://www.linguee.com/mp3/EN_US_ephemeral.mp3";
    const favorite = buildFavoriteWord({ ...query, speechUrl: "" }, [
      dictionaryService([{ kind: "translation", text: "短暂的" }]),
      translationService(["短暂的"], url),
    ]);

    const note = buildAnkiNote(favorite, "Easydict");

    expect(note.audio).toEqual([{ url, filename: "easydict-en-ephemeral.mp3", fields: ["Audio"] }]);
  });

  it("escapes HTML because Anki renders fields as HTML", () => {
    const favorite = buildFavoriteWord({ ...query, word: "<b>&" }, [translationService(['"x" < y'])]);
    const note = buildAnkiNote(favorite, "Easydict");

    expect(note.fields.Word).toBe("&lt;b&gt;&amp;");
    expect(note.fields.Translation).toBe("&quot;x&quot; &lt; y");
  });
});

describe("addFavoritesToAnki", () => {
  const url = "127.0.0.1:8765";
  const favorite = (word: string): FavoriteWord =>
    buildFavoriteWord({ ...query, word }, [translationService(["短暂的"])]);
  let failedWord: string | undefined;

  beforeEach(() => {
    failedWord = undefined;
    timedFetch.mockReset();
    timedFetch.mockImplementation(async (_url: string, { body }: { body: AnkiRequestBody }) => {
      switch (body.action) {
        case "createDeck":
          return { result: null, error: null };
        case "modelNames":
          return { result: ["Easydict"], error: null };
        case "canAddNotesWithErrorDetail":
          return { result: body.params.notes.map(() => ({ canAdd: true })), error: null };
        case "addNotes":
          return {
            result: body.params.notes.map((note, index) => (note.fields.Word === failedWord ? null : index + 1)),
            error: null,
          };
      }
      throw new Error("Unexpected AnkiConnect action");
    });
  });

  it("reports every note AnkiConnect created as added", async () => {
    await expect(
      addFavoritesToAnki([favorite("one"), favorite("two")], { deckName: "Easydict", url }),
    ).resolves.toEqual({ added: 2, skipped: 0, failed: 0 });
  });

  it("reports a note that AnkiConnect fails to add as failed, not skipped", async () => {
    failedWord = "two";
    await expect(
      addFavoritesToAnki([favorite("one"), favorite("two")], { deckName: "Easydict", url }),
    ).resolves.toEqual({ added: 1, skipped: 0, failed: 1 });
  });

  it("submits one note to the default endpoint and deck and reports one addition", async () => {
    await expect(addFavoritesToAnki([favorite("one")], { deckName: "", url: "" })).resolves.toEqual({
      added: 1,
      skipped: 0,
      failed: 0,
    });

    const endpoint = "http://127.0.0.1:8765";
    expect(timedFetch).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: expect.objectContaining({ action: "createDeck", params: { deck: "Easydict" } }),
      }),
    );
    expect(timedFetch).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        body: expect.objectContaining({
          action: "addNotes",
          params: {
            notes: [
              expect.objectContaining({
                deckName: "Easydict",
                fields: expect.objectContaining({ Word: "one", Translation: "短暂的" }),
              }),
            ],
          },
        }),
      }),
    );
  });
});
