import { describe, expect, it } from "vitest";

import { LingueeListItemType } from "@/providers/dictionary/linguee/types";
import { DictionaryType, TranslationType } from "@/types/api";
import type { ListDisplayItem } from "@/types/display";
import type { QueryResult, QueryWordInfo } from "@/types/query";

import { applyMetadataToLinguee, applyTranslationToDisplay } from "./couplingRules";

function createTranslationResult(text = "translated"): QueryResult {
  const queryWordInfo = createQueryWordInfo();
  const item: ListDisplayItem = {
    displayCategory: "translation",
    displayType: TranslationType.DeepL,
    queryType: TranslationType.DeepL,
    queryWordInfo,
    key: "deepl",
    title: text,
    copyText: text,
  };

  return {
    type: TranslationType.DeepL,
    sourceResult: {
      type: TranslationType.DeepL,
      queryWordInfo,
      result: {},
      translations: [text],
    },
    displaySections: [{ type: TranslationType.DeepL, items: [item] }],
  };
}

function createLingueeResult(sectionCount = 1): QueryResult {
  const queryWordInfo = createQueryWordInfo();
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const item: ListDisplayItem = {
      displayCategory: "dictionary",
      displayType: LingueeListItemType.Translation,
      queryType: DictionaryType.Linguee,
      queryWordInfo,
      key: `linguee-${index}`,
      title: `original-${index}`,
      subtitle: "existing subtitle",
      copyText: `original-${index}`,
      accessoryItem: { example: "preserved" },
    };
    return { type: LingueeListItemType.Translation, items: [item] };
  });

  return {
    type: DictionaryType.Linguee,
    sourceResult: {
      type: DictionaryType.Linguee,
      queryWordInfo,
      result: {},
      translations: [],
    },
    displaySections: sections,
  };
}

function createQueryWordInfo(): QueryWordInfo {
  return { word: "test", fromLanguage: "en", toLanguage: "zh-CHS" };
}

describe("applyTranslationToDisplay", () => {
  it("updates only the target's first item without mutating the input", () => {
    const source = createTranslationResult();
    const target = createLingueeResult(2);
    const originalSections = target.displaySections;

    const updated = applyTranslationToDisplay(
      [source, target],
      TranslationType.DeepL,
      DictionaryType.Linguee,
      (result) => result.sourceResult.translations.join(", "),
    );

    const updatedTarget = updated.find((result) => result.type === DictionaryType.Linguee);
    expect(updatedTarget?.displaySections?.[0].items[0]).toMatchObject({
      title: "translated",
      copyText: "translated",
      detailsMarkdown: "translated existing subtitle",
    });
    expect(updatedTarget?.displaySections?.[1].items[0].title).toBe("original-1");
    expect(target.displaySections).toBe(originalSections);
    expect(target.displaySections?.[0].items[0].title).toBe("original-0");
  });

  it("returns the original array when minSections is not met", () => {
    const results = [createTranslationResult(), createLingueeResult()];
    const target = results[1];
    const updated = applyTranslationToDisplay(
      results,
      TranslationType.DeepL,
      DictionaryType.Linguee,
      (result) => result.sourceResult.translations.join(", "),
      { minSections: 2 },
    );

    expect(updated).toEqual(results);
    expect(updated[1]).toBe(target);
    expect(updated[1].displaySections?.[0].items[0].title).toBe("original-0");
  });
});

describe("applyMetadataToLinguee", () => {
  it("merges metadata while preserving existing accessory fields", () => {
    const linguee = createLingueeResult();
    const youdao = createLingueeResult();
    youdao.type = DictionaryType.Youdao;
    youdao.sourceResult.type = DictionaryType.Youdao;
    youdao.sourceResult.queryWordInfo.phonetic = "test-phonetic";
    youdao.sourceResult.queryWordInfo.examTypes = ["CET4"];

    const updated = applyMetadataToLinguee([linguee, youdao], youdao);

    expect(updated[0].displaySections?.[0].items[0].accessoryItem).toEqual({
      example: "preserved",
      phonetic: "test-phonetic",
      examTypes: ["CET4"],
    });
    expect(linguee.displaySections?.[0].items[0].accessoryItem).toEqual({ example: "preserved" });
  });
});
