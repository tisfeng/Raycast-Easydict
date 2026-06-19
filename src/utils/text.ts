/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { DictionaryType, TranslationType } from "@/types/api";
import type { QueryWordInfo } from "@/types/query";
import { QueryType } from "@/types/query";

/**
 * Max length for word to query dictionary.
 */
const maxWordLength = 20;

/**
 * Trim the text to the max length, default 1830.
 *
 * * Note: google web translate max length is 1830.
 */
export function trimTextLength(text: string, length = 1830) {
  text = text.trim();
  if (text.length > length) {
    return text.substring(0, length) + "...";
  }
  return text.substring(0, length);
}

/**
 * Check is word, only word.length < 20 is valid.
 */
export function checkIsWordLength(word: string) {
  return word.trim().length < maxWordLength;
}

/**
 * Check queryWordInfo is word, not accurate, just a rough judgment.
 *
 * * Use queryWordInfo `isWord` when need accurate judgment.
 */
export function checkIsWord(queryWordInfo: QueryWordInfo) {
  if (queryWordInfo.isWord !== undefined) {
    return queryWordInfo.isWord;
  }
  return checkIsWordLength(queryWordInfo.word);
}

/**
 * Check type is Dictionary type.
 */
export function checkIsDictionaryType(type: QueryType): boolean {
  if (Object.values(DictionaryType).includes(type as DictionaryType)) {
    return true;
  }
  return false;
}

/**
 * Check type is Translation type.
 */
const translationTypeValues = new Set<string>(Object.values(TranslationType));
export function checkIsTranslationType(type: string): type is TranslationType {
  return translationTypeValues.has(type);
}
