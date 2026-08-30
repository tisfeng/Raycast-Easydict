/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { ListDisplayItem } from "@/types/display";

export const MAX_STROKE_ORDER_CHARACTERS = 8;

const chineseLanguageCodes = new Set(["zh-CHS", "zh-CHT"]);
const unifiedIdeographPattern = /^\p{Unified_Ideograph}$/u;

/**
 * Extract unique Han characters while preserving their first-seen order.
 */
export function extractUniqueHanzi(text: string, limit = MAX_STROKE_ORDER_CHARACTERS): string[] {
  if (limit <= 0) return [];

  const characters: string[] = [];
  const seen = new Set<string>();

  for (const character of text.normalize("NFC")) {
    if (!unifiedIdeographPattern.test(character) || seen.has(character)) continue;

    seen.add(character);
    characters.push(character);
    if (characters.length === limit) break;
  }

  return characters;
}

/**
 * Select the Chinese text relevant to a translation result.
 *
 * Chinese input uses the original query. Chinese output uses the selected
 * provider's translated text. Results for other language pairs intentionally
 * return no characters, even if (for example) Japanese text contains Kanji.
 */
export function getStrokeOrderCharacters(displayItem: ListDisplayItem, limit = MAX_STROKE_ORDER_CHARACTERS): string[] {
  const { fromLanguage, toLanguage, word } = displayItem.queryWordInfo;
  const texts: string[] = [];

  if (chineseLanguageCodes.has(fromLanguage)) texts.push(word);
  if (chineseLanguageCodes.has(toLanguage)) texts.push(displayItem.copyText);

  return extractUniqueHanzi(texts.join(""), limit);
}
