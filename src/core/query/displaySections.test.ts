import { describe, expect, it, vi } from "vitest";

import {
  DictionaryType,
  LingueeListItemType,
  TranslationType,
  YoudaoDictionaryListItemType,
} from "@/core/results/kinds";
import type { DictionaryQueryResult, TranslationQueryResult } from "@/core/results/types";

import { projectQueryResults } from "./displaySections";

vi.mock("@/core/results/appearance", () => ({ isDarkAppearance: () => false }));

const preferences = {
  enableDeepLTranslate: false,
  enableYoudaoDictionary: true,
  enableYoudaoTranslate: false,
  flagsAreNotLanguages: false,
};
const queryWordInfo = { word: "word", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };

function translation(type: TranslationType, text = "translated"): TranslationQueryResult {
  return {
    type,
    serviceId: `static:${type}`,
    serviceLabel: type,
    serviceOrder: 0,
    queryWordInfo,
    translations: [text],
  };
}

function linguee(displayType = LingueeListItemType.Translation): DictionaryQueryResult {
  return {
    type: DictionaryType.Linguee,
    serviceId: "static:linguee",
    serviceLabel: "Linguee",
    serviceOrder: 1,
    serviceIcon: { kind: "initials" },
    fromCache: true,
    queryWordInfo,
    displaySections: [0, 1].map((index) => ({
      type: displayType,
      sectionTitle: `section ${index}`,
      items: [0, 1].map((itemIndex) => ({
        queryType: DictionaryType.Linguee,
        displayType,
        queryWordInfo,
        key: `${index}:${itemIndex}`,
        title: `original ${index}:${itemIndex}`,
        copyText: `original ${index}:${itemIndex}`,
        subtitle: "existing subtitle",
        accessoryItem: { phonetic: "own phonetic", examTypes: ["own exam"], example: "preserved" },
      })),
    })),
  };
}

function youdao(sectionCount: number): DictionaryQueryResult {
  return {
    type: DictionaryType.Youdao,
    serviceId: "static:youdao",
    serviceLabel: "Youdao",
    serviceOrder: 2,
    queryWordInfo: { ...queryWordInfo, phonetic: "supplement", examTypes: ["CET4"] },
    displaySections: Array.from({ length: sectionCount }, (_, index) => ({
      type: YoudaoDictionaryListItemType.Translation,
      items: [
        {
          queryType: DictionaryType.Youdao,
          displayType: YoudaoDictionaryListItemType.Translation,
          queryWordInfo,
          key: `youdao:${index}`,
          title: `Youdao ${index}`,
          copyText: `Youdao ${index}`,
        },
      ],
    })),
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("projectQueryResults", () => {
  it.each(["source first", "dictionary first"])(
    "supplements only Linguee's first item without changing provider data (%s)",
    (order) => {
      const dictionary = linguee();
      const source = translation(TranslationType.DeepL);
      const metadata = youdao(1);
      const results = freeze(
        order === "source first" ? [source, metadata, dictionary] : [dictionary, metadata, source],
      );
      const original = structuredClone(results);

      const projected = projectQueryResults(results, preferences);
      const sections = projected.displaySections.filter((section) => section.serviceId === dictionary.serviceId);
      expect(sections[0].items[0]).toMatchObject({
        title: "translated",
        copyText: "translated",
        detailsMarkdown: "**translated**",
        accessoryItem: { phonetic: "supplement", examTypes: ["CET4"], example: "preserved" },
        serviceId: dictionary.serviceId,
        serviceLabel: "Linguee",
        serviceIcon: { kind: "initials" },
        fromCache: true,
      });
      expect(sections[0].items[1].title).toBe("original 0:1");
      expect(sections[1].items[0].title).toBe("original 1:0");
      expect(sections[1].sectionTitle).toBe("section 1");
      expect(projected.displaySections.some((section) => section.type === TranslationType.DeepL)).toBe(false);
      expect(projected.hasVisibleItems).toBe(true);
      expect(projected.isShowDetail).toBe(false);
      expect(results).toEqual(original);
    },
  );

  it.each([1, 2])(
    "requires at least two actual Youdao dictionary sections before replacing its title (%s sections)",
    (count) => {
      const projected = projectQueryResults([translation(TranslationType.Youdao), youdao(count)], preferences);
      expect(projected.displaySections).toHaveLength(count);
      expect(projected.displaySections[0].items[0]).toMatchObject({
        title: count >= 2 ? "translated" : "Youdao 0",
        copyText: count >= 2 ? "translated" : "Youdao 0",
        detailsMarkdown: count >= 2 ? "**translated**" : "**Youdao 0**",
      });
      if (count >= 2) expect(projected.displaySections[1].items[0].title).toBe("Youdao 1");
    },
  );

  it("does not move supplements past an empty first dictionary section", () => {
    const dictionary = linguee();
    dictionary.displaySections[0].items = [];
    const projected = projectQueryResults([translation(TranslationType.DeepL), youdao(1), dictionary], preferences);
    const sections = projected.displaySections.filter((section) => section.serviceId === dictionary.serviceId);
    expect(sections[0].items).toEqual([]);
    expect(sections[1].items[0]).toMatchObject({ title: "original 1:0", accessoryItem: { phonetic: "own phonetic" } });
  });

  it.each([
    [undefined, "translated"],
    ["existing subtitle", "translated existing subtitle"],
    ["translated subtitle", "translated subtitle"],
  ])("preserves fallback dictionary bodies when the first entry has subtitle %s", (subtitle, expected) => {
    const dictionary = linguee(LingueeListItemType.Common);
    dictionary.displaySections[0].items[0].subtitle = subtitle;
    const projected = projectQueryResults([translation(TranslationType.DeepL), dictionary], preferences);
    expect(projected.displaySections[0].items[0]).toMatchObject({
      title: "translated",
      copyText: "translated",
      detailsMarkdown: expected,
    });
  });

  it.each([
    { phonetic: "only phonetic", examTypes: undefined },
    { phonetic: undefined, examTypes: ["only exams"] },
  ])("replaces both supplemented metadata fields while retaining unrelated accessories (%j)", (metadata) => {
    const source = youdao(1);
    source.queryWordInfo = { ...queryWordInfo, ...metadata };
    const projected = projectQueryResults([linguee(), source], preferences);
    expect(projected.displaySections[0].items[0].accessoryItem).toEqual({ ...metadata, example: "preserved" });
  });

  it.each([
    ["zh-CHS", 45, false],
    ["zh-CHS", 46, true],
    ["en", 90, false],
    ["en", 91, true],
    ["fr", 91, true],
  ])(
    "uses the existing detail threshold for %s at length %i, including hidden translations",
    (toLanguage, length, expected) => {
      const source = translation(TranslationType.DeepL, "x".repeat(length));
      source.queryWordInfo = { ...queryWordInfo, toLanguage };
      const projected = projectQueryResults([source], preferences);
      expect(projected).toEqual({ displaySections: [], hasVisibleItems: false, isShowDetail: expected });
    },
  );

  it("keeps empty dictionary sections, suppresses translation detail, and reports no visible items", () => {
    const dictionary = linguee();
    dictionary.displaySections.forEach((section) => {
      section.items = [];
    });
    const projected = projectQueryResults(
      [translation(TranslationType.DeepL, "x".repeat(100)), dictionary],
      preferences,
    );
    expect(projected.displaySections).toHaveLength(2);
    expect(projected.hasVisibleItems).toBe(false);
    expect(projected.isShowDetail).toBe(false);
  });

  it("hides only the configured translations and excludes them from visible comparisons", () => {
    const sources = [
      translation(TranslationType.DeepL),
      translation(TranslationType.Youdao),
      translation(TranslationType.Google, "visible"),
    ];
    const projected = projectQueryResults(sources, preferences);
    expect(projected.displaySections).toHaveLength(1);
    expect(projected.displaySections[0].items[0].detailsMarkdown).toBe("**Google Translate**\n\nvisible");
    expect(
      projectQueryResults(sources, { ...preferences, enableYoudaoDictionary: false }).displaySections,
    ).toHaveLength(2);
    expect(projectQueryResults(sources, { ...preferences, enableYoudaoTranslate: true }).displaySections).toHaveLength(
      2,
    );
    expect(projectQueryResults(sources, { ...preferences, enableDeepLTranslate: true }).displaySections).toHaveLength(
      2,
    );
  });

  it("keeps profile identities distinct and puts the current profile first in its comparison", () => {
    const first = { ...translation(TranslationType.OpenAI, "first"), serviceId: "profile:one", serviceLabel: "One" };
    const second = { ...translation(TranslationType.OpenAI, "second"), serviceId: "profile:two", serviceLabel: "Two" };
    const projected = projectQueryResults([first, second], { ...preferences, flagsAreNotLanguages: true });
    expect(projected.displaySections.map((section) => section.items[0].key)).toEqual(["profile:one", "profile:two"]);
    expect(projected.displaySections.map((section) => section.sectionTitle)).toEqual([
      "One   (English --> Chinese-Simplified)",
      "Two",
    ]);
    const preview = projected.displaySections[1].items[0].detailsMarkdown!;
    expect(preview.indexOf("Two")).toBeLessThan(preview.indexOf("One"));
    expect(
      projectQueryResults([{ ...first, translations: ["first chunk"] }], preferences).displaySections[0].items[0].key,
    ).toBe("profile:one");
  });

  it("keeps ordinary translation titles, copy text, and serialized keys aligned", () => {
    const source = translation(TranslationType.Google);
    source.translations = ["first", "second"];
    const { displaySections } = projectQueryResults([source], preferences);
    expect(displaySections[0].items[0]).toMatchObject({
      title: "first, second",
      copyText: "first\nsecond",
      key: `${source.serviceId}:first, second`,
    });
    expect(projectQueryResults([], preferences)).toEqual({
      displaySections: [],
      isShowDetail: false,
      hasVisibleItems: false,
    });
  });
});
