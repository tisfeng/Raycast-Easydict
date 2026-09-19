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
  AI = "AI Dictionary",
}

export enum LanguageDetectType {
  Simple = "Simple Detect",
  Franc = "Franc Detect",
  Tencent = "Tencent Detect",
  Baidu = "Baidu Detect",
  Bing = "Bing Detect",
  Volcano = "Volcano Detect",
}

export type RequestType = TranslationType | DictionaryType | LanguageDetectType;

export enum AIDictionaryListItemType {
  Translation = "Translation",
  Definition = "Definition",
  Forms = "Forms",
}

export enum LingueeListItemType {
  AlmostAlwaysUsed = "Almost Always Used", // also featured, eg. true
  OftenUsed = "Often Used", // also featured, eg. good
  Common = "Common", // also featured
  LessCommon = "Less Common", // unfeatured

  SpecialForms = "Forms", // special forms, like often used, but we currently don't handle it. eg. good  English-French

  Unfeatured = "Unfeatured",
  Example = "Example",
  RelatedWord = "Related word", // eg. 优雅, 美丽
  Wikipedia = "Wikipedia", // eg. sql

  Translation = "Translation", // just used for linguee section title item
}

export enum YoudaoDictionaryListItemType {
  Translation = "Translation",
  Explanation = "Explanation",
  ModernChineseDict = "Modern Chinese Dict",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
  Baike = "Baike",
  Wikipedia = "Wikipedia",
}
