/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

export enum TranslationType {
  Youdao = "Youdao Translate",
  Baidu = "Baidu Translate",
  Tencent = "Tencent Translate",
  Caiyun = "Caiyun Translate",
  Apple = "Apple Translate",
  DeepL = "DeepL Translate",
  DeepLX = "DeepLX Translate",
  Google = "Google Translate",
  Bing = "Bing Translate",
  Volcano = "Volcano Translate",
  OpenAI = "OpenAI Translate",
  Gemini = "Gemini Translate",
}

export enum DictionaryType {
  Youdao = "Youdao Dictionary",
  Eudic = "Eudic Dictionary",
  Linguee = "Linguee Dictionary",
}

export enum LanguageDetectType {
  Simple = "Simple Detect",
  Franc = "Franc Detect",
  Apple = "Apple Detect",
  Tencent = "Tencent Detect",
  Baidu = "Baidu Detect",
  Google = "Google Detect",
  Bing = "Bing Detect",
  Volcano = "Volcano Detect",
}

export type RequestType = TranslationType | DictionaryType | LanguageDetectType;

/**
 * Check type is Dictionary type.
 */
const dictionaryTypeValues = new Set<string>(Object.values(DictionaryType));
export function checkIsDictionaryType(type: string): boolean {
  return dictionaryTypeValues.has(type);
}

/**
 * Check type is Translation type.
 */
const translationTypeValues = new Set<string>(Object.values(TranslationType));
export function checkIsTranslationType(type: string): type is TranslationType {
  return translationTypeValues.has(type);
}

export interface TranslationItem {
  type: TranslationType;
  text: string;
}
