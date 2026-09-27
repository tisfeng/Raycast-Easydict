import { describe, expect, it, vi } from "vitest";

import { YoudaoDictionaryListItemType } from "@/providers/dictionary/youdao/types";
import { DictionaryType, TranslationType } from "@/types/api";
import type { DisplaySection } from "@/types/display";
import type { FavoriteWord } from "@/types/favorite";

import { buildAnkiNote } from "./anki";

// anki.ts reaches @/consts through the shared HTTP client; only the timeout is read.
vi.mock("@/consts", () => ({ networkTimeout: 1000 }));

function makeFavorite(overrides: Partial<FavoriteWord> = {}): FavoriteWord {
  return {
    word: "ephemeral",
    fromLanguage: "en",
    toLanguage: "zh-CHS",
    isWord: true,
    translations: ["短暂的", "转瞬即逝的"],
    displaySections: [],
    createdAt: 1722864000000,
    ...overrides,
  };
}

function sectionWithPhonetic(phonetic: string): DisplaySection {
  return {
    type: TranslationType.Youdao,
    items: [
      {
        queryType: TranslationType.Youdao,
        queryWordInfo: { word: "ephemeral", fromLanguage: "en", toLanguage: "zh-CHS" },
        key: "youdao",
        title: "短暂的",
        copyText: "短暂的",
        accessoryItem: { phonetic },
      },
    ],
  };
}

function youdaoExplanationSection(explanations: string[], speechUrl: string): DisplaySection {
  return {
    type: YoudaoDictionaryListItemType.Explanation,
    items: explanations.map((text) => ({
      queryType: DictionaryType.Youdao,
      displayType: YoudaoDictionaryListItemType.Explanation,
      queryWordInfo: { word: "ephemeral", fromLanguage: "en", toLanguage: "zh-CHS", speechUrl },
      key: text,
      title: text,
      copyText: text,
    })),
  };
}

describe("buildAnkiNote", () => {
  it("puts the saved phonetic, translations, and dictionary explanations on the card", () => {
    const note = buildAnkiNote(
      makeFavorite({
        displaySections: [
          sectionWithPhonetic("/ɪˈfem(ə)rəl/"),
          youdaoExplanationSection(
            ["adj. 短暂的", "n. 短命的植物"],
            "https://dict.youdao.com/dictvoice?audio=ephemeral",
          ),
        ],
      }),
      "Easydict",
    );

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
    const note = buildAnkiNote(
      makeFavorite({ displaySections: [youdaoExplanationSection(["adj. 短暂的"], url)] }),
      "Easydict",
    );

    expect(note.audio).toEqual([{ url, filename: "easydict-en-ephemeral.mp3", fields: ["Audio"] }]);
    expect(buildAnkiNote(makeFavorite(), "Easydict").audio).toBeUndefined();
  });

  it("escapes HTML because Anki renders fields as HTML", () => {
    const note = buildAnkiNote(makeFavorite({ word: "<b>&", translations: ['"x" < y'] }), "Easydict");

    expect(note.fields.Word).toBe("&lt;b&gt;&amp;");
    expect(note.fields.Translation).toBe("&quot;x&quot; &lt; y");
  });
});
