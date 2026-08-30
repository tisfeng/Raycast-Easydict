import { describe, expect, it } from "vitest";

import { TranslationType } from "@/types/api";
import type { ListDisplayItem } from "@/types/display";

import { extractUniqueHanzi, getStrokeOrderCharacters } from "./characters";

function makeDisplayItem({
  copyText,
  fromLanguage,
  toLanguage,
  word,
}: {
  copyText: string;
  fromLanguage: string;
  toLanguage: string;
  word: string;
}): ListDisplayItem {
  return {
    copyText,
    key: "test",
    queryType: TranslationType.Google,
    queryWordInfo: { fromLanguage, toLanguage, word },
    title: copyText,
  };
}

describe("extractUniqueHanzi", () => {
  it("preserves order and removes duplicates and punctuation", () => {
    expect(extractUniqueHanzi("你好，你好！学习。", 10)).toEqual(["你", "好", "学", "习"]);
  });

  it("applies the requested limit", () => {
    expect(extractUniqueHanzi("一二三四", 2)).toEqual(["一", "二"]);
    expect(extractUniqueHanzi("一二三四", 0)).toEqual([]);
  });
});

describe("getStrokeOrderCharacters", () => {
  it("uses the translated text when translating to Chinese", () => {
    const item = makeDisplayItem({ copyText: "你好", fromLanguage: "en", toLanguage: "zh-CHS", word: "hello" });
    expect(getStrokeOrderCharacters(item)).toEqual(["你", "好"]);
  });

  it("uses the original query when translating from Chinese", () => {
    const item = makeDisplayItem({ copyText: "study", fromLanguage: "zh-CHT", toLanguage: "en", word: "學習" });
    expect(getStrokeOrderCharacters(item)).toEqual(["學", "習"]);
  });

  it("does not treat Japanese Kanji as a Chinese translation", () => {
    const item = makeDisplayItem({ copyText: "study", fromLanguage: "ja", toLanguage: "en", word: "勉強" });
    expect(getStrokeOrderCharacters(item)).toEqual([]);
  });
});
