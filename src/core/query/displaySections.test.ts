import { describe, expect, it, vi } from "vitest";

import type { DictionarySection } from "@/core/content/types";
import { DictionaryType, LingueeListItemType, TranslationType } from "@/core/results/kinds";
import type { DictionaryResult, QueryResult, QueryWordInfo, TranslationResult } from "@/core/results/types";

import { projectQueryResults } from "./displaySections";

vi.mock("@/core/results/appearance", () => ({ isDarkAppearance: () => false }));

const preferences = {
  enableDeepLTranslate: false,
  enableYoudaoDictionary: true,
  enableYoudaoTranslate: false,
  flagsAreNotLanguages: true,
};
const query = { word: "word", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };

function translation(type: TranslationType, paragraphs = ["translated"]): QueryResult & TranslationResult {
  return {
    type,
    serviceId: `static:${type}`,
    serviceLabel: type,
    serviceOrder: 0,
    content: { kind: "translation", query, paragraphs },
  };
}

function dictionary(
  type: DictionaryType,
  sections: readonly DictionarySection[],
  info: QueryWordInfo = query,
): QueryResult & DictionaryResult {
  return {
    type,
    serviceId: `static:${type}`,
    serviceLabel: type,
    serviceOrder: 1,
    serviceIcon: { kind: "initials" },
    fromCache: true,
    content: { kind: "dictionary", query: info, sections },
  };
}

describe("projectQueryResults", () => {
  it("applies the composed supplement only to the first dictionary row and retains service metadata", () => {
    const linguee = dictionary(DictionaryType.Linguee, [
      { kind: "translation", text: "original", lemma: "word" },
      {
        kind: "equivalents",
        headword: { word: "word", partOfSpeech: "noun" },
        entries: [
          { text: "term", prominent: true, frequency: "common" },
          { text: "expression", prominent: true, frequency: "common" },
        ],
      },
    ]);
    const youdao = dictionary(DictionaryType.Youdao, [{ kind: "translation", text: "词" }], {
      ...query,
      phonetic: "[word]",
      examTypes: ["CET4"],
    });
    const projected = projectQueryResults([translation(TranslationType.DeepL), linguee, youdao], preferences);
    const sections = projected.displaySections.filter((section) => section.serviceId === linguee.serviceId);
    expect(sections[0].items[0]).toMatchObject({
      title: "translated",
      subtitle: "word",
      copyText: "translated",
      detailsMarkdown: "**translated**",
      accessoryItem: { phonetic: "[word]", examTypes: ["CET4"] },
      serviceId: linguee.serviceId,
      serviceLabel: DictionaryType.Linguee,
      serviceIcon: { kind: "initials" },
      fromCache: true,
    });
    expect(sections[1].items.map(({ title, copyText }) => ({ title, copyText }))).toEqual([
      { title: "term", copyText: "term        " },
      { title: "expression", copyText: "expression        " },
    ]);
    expect(sections[1].sectionTitle).toBe("word.noun");
    expect(projected.displaySections.some((section) => section.type === TranslationType.DeepL)).toBe(false);
    expect(projected.hasVisibleItems).toBe(true);
    expect(projected.isShowDetail).toBe(false);
  });

  it("does not move supplements past an empty first dictionary section", () => {
    const linguee = dictionary(DictionaryType.Linguee, [
      { kind: "equivalents", headword: { word: "word" }, entries: [] },
      { kind: "examples", entries: [{ sentence: "original sentence", translation: "原句" }] },
    ]);
    const { displaySections } = projectQueryResults([translation(TranslationType.DeepL), linguee], preferences);
    expect(displaySections[0].items).toEqual([]);
    expect(displaySections[1].items[0]).toMatchObject({
      title: "original sentence",
      subtitle: "—  原句",
      copyText: "original sentence —  原句",
      detailsMarkdown: "- **original sentence**  \n  —  原句",
    });
  });

  it.each([
    ["translated", "translated n.       例句"],
    ["n", "n.       例句"],
  ])("preserves the first non-translation row's fallback body when supplemented with %s", (text, expected) => {
    const linguee = dictionary(DictionaryType.Linguee, [
      {
        kind: "equivalents",
        headword: { word: "word" },
        entries: [
          { text: "term", partOfSpeech: "n", prominent: true, frequency: "common", firstExampleTranslation: "例句" },
          { text: "another term", prominent: true, frequency: "common" },
        ],
      },
    ]);
    const { displaySections } = projectQueryResults([translation(TranslationType.DeepL, [text]), linguee], preferences);
    expect(displaySections[0].items[0]).toMatchObject({
      displayType: LingueeListItemType.Common,
      title: text,
      subtitle: "n.       例句",
      copyText: text,
      detailsMarkdown: expected,
    });
    expect(displaySections[0].items[1]).toMatchObject({
      title: "another term",
      copyText: "another term        ",
      detailsMarkdown: "another term        ",
    });
  });

  it("uses the supplemental translation alone when the first dictionary row has an empty subtitle", () => {
    const linguee = dictionary(DictionaryType.Linguee, [
      { kind: "summary", source: "wikipedia", entries: [{ subject: "word", text: "original article" }] },
    ]);
    expect(
      projectQueryResults([translation(TranslationType.DeepL), linguee], preferences).displaySections[0].items[0],
    ).toMatchObject({ title: "translated", subtitle: "", copyText: "translated", detailsMarkdown: "translated" });
  });

  it("keeps profile identities distinct and puts the current profile first in its comparison", () => {
    const first = { ...translation(TranslationType.OpenAI, ["first"]), serviceId: "profile:one", serviceLabel: "One" };
    const second = {
      ...translation(TranslationType.OpenAI, ["second"]),
      serviceId: "profile:two",
      serviceLabel: "Two",
    };
    const projected = projectQueryResults([first, second], preferences);
    expect(projected.displaySections.map((section) => section.serviceId)).toEqual(["profile:one", "profile:two"]);
    expect(projected.displaySections.map((section) => section.sectionTitle)).toEqual([
      "One   (English --> Chinese-Simplified)",
      "Two",
    ]);
    const preview = projected.displaySections[1].items[0].detailsMarkdown!;
    expect(preview).toContain("first");
    expect(preview).toContain("second");
    expect(preview.indexOf("Two")).toBeLessThan(preview.indexOf("One"));
  });

  it("keeps translation paragraph titles and copy text while excluding hidden comparison sources", () => {
    const source = translation(TranslationType.Google, ["first", "", "second"]);
    const { displaySections } = projectQueryResults([translation(TranslationType.DeepL), source], preferences);
    expect(displaySections).toHaveLength(1);
    expect(displaySections[0].items[0]).toMatchObject({
      title: "first, , second",
      copyText: "first\n\nsecond",
      detailsMarkdown: "**Google Translate**\n\nfirst\n\nsecond",
    });
  });

  it.each([false, true])(
    "resets translation direction headings only when the dictionary has a section (%s)",
    (hasSection) => {
      const empty = dictionary(DictionaryType.Linguee, hasSection ? [{ kind: "examples", entries: [] }] : []);
      const { displaySections } = projectQueryResults(
        [translation(TranslationType.Google), empty, translation(TranslationType.Bing)],
        preferences,
      );
      expect(displaySections.at(-1)?.sectionTitle).toBe(
        hasSection ? "Bing Translate   (English --> Chinese-Simplified)" : "Bing Translate",
      );
    },
  );

  it("keeps empty dictionary sections without reporting visible items", () => {
    const empty = dictionary(DictionaryType.Linguee, [{ kind: "examples", entries: [] }]);
    expect(projectQueryResults([empty], preferences)).toMatchObject({
      displaySections: [{ items: [] }],
      isShowDetail: false,
      hasVisibleItems: false,
    });
    expect(projectQueryResults([], preferences)).toEqual({
      displaySections: [],
      isShowDetail: false,
      hasVisibleItems: false,
    });
  });
});
