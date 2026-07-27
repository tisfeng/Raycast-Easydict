/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { config } from "@/core/config";
import { chineseLanguageItem, englishLanguageItem } from "@/core/language/consts";
import type { LanguageItem } from "@/core/language/types";
import {
  getLanguageItem,
  maxLineLengthOfChineseTextDisplay,
  maxLineLengthOfEnglishTextDisplay,
} from "@/core/language/utils";
import { DictionaryType, TranslationType } from "@/types/api";
import type { ListDisplayItem } from "@/types/display";
import type { QueryResult, TranslationResult } from "@/types/query";
import { logTrace } from "@/utils/logger";

/**
 * Sort query results by designated order.
 *
 * * NOTE: this function will be called many times, because request results are async, so we need to sort every time.
 */
export function sortedQueryResults(queryResults: QueryResult[]) {
  const typeOrder = getSortOrder();
  return queryResults
    .map((result, index) => ({ result, index }))
    .sort((left, right) => {
      const leftTypeOrder = typeOrder.indexOf(left.result.type.toString().toLowerCase());
      const rightTypeOrder = typeOrder.indexOf(right.result.type.toString().toLowerCase());
      const normalizedLeftOrder = leftTypeOrder === -1 ? Number.MAX_SAFE_INTEGER : leftTypeOrder;
      const normalizedRightOrder = rightTypeOrder === -1 ? Number.MAX_SAFE_INTEGER : rightTypeOrder;
      return (
        normalizedLeftOrder - normalizedRightOrder ||
        left.result.serviceOrder - right.result.serviceOrder ||
        left.index - right.index
      );
    })
    .map(({ result }) => result);
}

/**
 * Get services sort order. If user set the order manually, prioritize the order.
 *
 * @return [linguee dictionary, youdao dictionary, deepl...], all lowercase.
 */
function getSortOrder(): string[] {
  const defaultOrderList = [
    DictionaryType.Youdao,
    DictionaryType.Linguee,
    DictionaryType.AI,

    TranslationType.OpenAI,
    TranslationType.Gemini,
    TranslationType.DeepL,
    TranslationType.DeepLX,
    TranslationType.Google,
    TranslationType.Bing,
    TranslationType.Apple,
    TranslationType.Baidu,
    TranslationType.Tencent,
    TranslationType.Volcano,
    TranslationType.Youdao,
    TranslationType.Caiyun,
  ];

  const userOrder: string[] = [];
  const defaultOrders = defaultOrderList.map((type) => type.toString().toLowerCase());

  // User-provided sort order may be incomplete or misspelled.
  const manualOrder = config.servicesOrder;

  const formatManualOrder = manualOrder.map((order) => order.trim().toLowerCase());

  // eg: [Youdao dictionary, DeepL, Tencent, linguee dictionary, Baidu, Google, Apple, Youdao]
  for (const order of formatManualOrder) {
    // 1. handle dictionary type.
    const dictionaryName = order;
    if (dictionaryName.endsWith("dictionary")) {
      if (defaultOrders.includes(dictionaryName)) {
        userOrder.push(dictionaryName);
        defaultOrders.splice(defaultOrders.indexOf(dictionaryName), 1);
      }
    } else {
      // 2. handle translation type.
      const translationName = `${order} translate`;
      // if the type name is in the default order, add it to user order, and remove it from defaultOrders.
      if (defaultOrders.includes(translationName)) {
        userOrder.push(translationName);
        defaultOrders.splice(defaultOrders.indexOf(translationName), 1);
      }
    }
  }

  const finalOrder = [...userOrder, ...defaultOrders].map((title) => title.toLowerCase());
  return finalOrder;
}

/**
 * Determine whether the title of the result exceeds the maximum value of one line.
 */
function isTextOneLineTooLong(text: string, textLanguage: string): boolean {
  const isChineseText = textLanguage === chineseLanguageItem.youdaoLangCode;
  const isEnglishText = textLanguage === englishLanguageItem.youdaoLangCode;

  let isTooLong = false;
  const textLength = text.length;
  if (isChineseText) {
    if (textLength > maxLineLengthOfChineseTextDisplay) {
      isTooLong = true;
    }
  } else if (isEnglishText) {
    if (textLength > maxLineLengthOfEnglishTextDisplay) {
      isTooLong = true;
    }
  } else if (textLength > maxLineLengthOfEnglishTextDisplay) {
    isTooLong = true;
  }
  return isTooLong;
}

/**
 * Check if show translation detail.
 *
 * Iterate QueryResult, if dictionary is not empty, and translation is too long, show translation detail.
 */
export function checkIfShowTranslationDetail(queryResults: QueryResult[]): boolean {
  const hasDictionaryResult = queryResults.some((queryResult) => !("translations" in queryResult));
  if (hasDictionaryResult) return false;

  for (const queryResult of queryResults) {
    if ("translations" in queryResult) {
      const oneLineTranslation = queryResult.translations.join(", ");
      if (isTextOneLineTooLong(oneLineTranslation, queryResult.queryWordInfo.toLanguage)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get fromTo language title according from and to language id.  eg. zh-CHS --> en, return: Chinese-Simplified🇨🇳 --> English🇬🇧
 *
 * * Since language title is too long for detail page, so we use short emoji instead.  eg. zh-CHS --> en, return: 🇨🇳 --> 🇬🇧
 */
export function getFromToLanguageTitle(from: string, to: string, onlyEmoji = false) {
  const fromLanguageItem = getLanguageItem(from);
  const toLanguageItem = getLanguageItem(to);

  if (myPreferences.flagsAreNotLanguages) {
    // If onlyEmoji is requested but flags are disabled, we could use short names or langEnglishName.
    // Using langEnglishName since there are no short abbreviations available.
    const fromToLanguageName = `${fromLanguageItem.langEnglishName} --> ${toLanguageItem.langEnglishName}`;
    return fromToLanguageName;
  }

  const fromToEmoji = `${fromLanguageItem.emoji} --> ${toLanguageItem.emoji}`;
  const fromToLanguageNameAndEmoji = `${fromLanguageItem.langEnglishName}${fromLanguageItem.emoji} --> ${toLanguageItem.langEnglishName}${toLanguageItem.emoji}`;
  return onlyEmoji ? fromToEmoji : fromToLanguageNameAndEmoji;
}

export function getTranslationShowMoreDetailsMarkdown(displayItem: ListDisplayItem): string {
  const { queryType, serviceLabel, copyText } = displayItem;
  const { word, fromLanguage, toLanguage } = displayItem.queryWordInfo;

  const type = serviceLabel ?? queryType.toString();
  const fromToLang = getFromToLanguageTitle(fromLanguage, toLanguage);
  const fromToTitle = `${type}  (${fromToLang})`;

  let markdown = "";
  markdown += `## ${fromToTitle} \n`;
  // * Note: word may contain wrap character, so we need to handle it.
  word.split("\n").forEach((line) => {
    markdown += `### ${line} \n`;
  });
  markdown += `----\n`;
  copyText.split("\n").forEach((line) => {
    markdown += `${line} \n\n`;
  });
  return markdown;
}

export function getDictionaryShowMoreDetailsMarkdown(displayItem: ListDisplayItem): string {
  const { queryType, serviceLabel, title, detailsMarkdown } = displayItem;
  const { word, fromLanguage, toLanguage } = displayItem.queryWordInfo;
  const fromToLang = getFromToLanguageTitle(fromLanguage, toLanguage);
  const fromToTitle = `${serviceLabel ?? queryType}  (${fromToLang})`;
  const explanation = detailsMarkdown || title;

  return `
## ${fromToTitle} 
### ${word}
----
${explanation}
`;
}

/**
 * Get translation markdown.
 */
export function getTranslationMarkdown(queryResult: TranslationResult, label = queryResult.type.toString()) {
  const { translations, queryWordInfo: wordInfo } = queryResult;
  const oneLineTranslation = translations.join("\n");
  if (oneLineTranslation.trim().length === 0) {
    return "";
  }

  const text = oneLineTranslation.replace(/\n/g, "\n\n");
  const fromTo = getFromToLanguageTitle(wordInfo.fromLanguage, wordInfo.toLanguage, true);

  const markdown = `
## ${label}   (${fromTo})
----  
${text}
`;
  return markdown;
}

/**
 * Get auto select target language according to the LangCode.
 */
export function getAutoSelectedTargetLanguageItem(fromLangCode: string): LanguageItem {
  const targetLanguageItem = config.preferredLanguages.find(
    (languageItem) => languageItem.youdaoLangCode !== fromLangCode,
  ) as LanguageItem;
  logTrace("QueryUtils", `fromLangCode: ${fromLangCode}, auto selected target: ${targetLanguageItem.youdaoLangCode}`);
  return targetLanguageItem;
}
