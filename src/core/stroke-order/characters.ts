/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { ListDisplayItem } from "@/types/display";

export const MAX_STROKE_ORDER_CHARACTERS = 8;

const chineseLanguageCodes = new Set(["zh-CHS", "zh-CHT"]);
const unifiedIdeographPattern = /^\p{Unified_Ideograph}$/u;

interface TranslationTexts {
  readonly fromLanguage: string;
  readonly toLanguage: string;
  readonly sourceText: string;
  readonly translatedText: string;
}

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
 * Select Han characters from a translation's source and result according to
 * its language direction.
 */
export function getStrokeOrderCharactersForTranslation(
  { fromLanguage, toLanguage, sourceText, translatedText }: TranslationTexts,
  limit = MAX_STROKE_ORDER_CHARACTERS,
): string[] {
  const texts: string[] = [];

  if (chineseLanguageCodes.has(fromLanguage)) texts.push(sourceText);
  if (chineseLanguageCodes.has(toLanguage)) texts.push(translatedText);

  return extractUniqueHanzi(texts.join(""), limit);
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
  return getStrokeOrderCharactersForTranslation(
    {
      fromLanguage,
      toLanguage,
      sourceText: word,
      translatedText: displayItem.copyText,
    },
    limit,
  );
}
