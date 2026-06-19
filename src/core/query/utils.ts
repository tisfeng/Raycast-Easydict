/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { chineseLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { LanguageItem } from "@/core/language/types";
import {
  getLanguageItem,
  maxLineLengthOfChineseTextDisplay,
  maxLineLengthOfEnglishTextDisplay,
} from "@/core/language/utils";
import { myPreferences, preferredLanguages } from "@/preferences";
import { YoudaoDictionaryListItemType } from "@/providers/dictionary/youdao/types";
import { DictionaryType, TranslationType } from "@/types/api";
import type { ListDisplayItem } from "@/types/display";
import { QueryResult, QueryTypeResult } from "@/types/query";
import { logTrace } from "@/utils/logger";
import { checkIsDictionaryType, checkIsTranslationType } from "@/utils/text";
import { checkIsLingueeListItem, checkIsYoudaoDictionaryListItem } from "@/utils/typeGuards";

/**
 * Sort query results by designated order.
 *
 * * NOTE: this function will be called many times, because request results are async, so we need to sort every time.
 */
export function sortedQueryResults(queryResults: QueryResult[]) {
  const sortedQueryResults: QueryResult[] = [];
  for (const queryResult of queryResults) {
    const typeString = queryResult.type.toString().toLowerCase();
    const index = getSortOrder().indexOf(typeString);
    sortedQueryResults[index] = queryResult;
  }
  // filter undefined, or result is undefined.
  return sortedQueryResults.filter((queryResult) => {
    if (queryResult?.sourceResult.result) {
      return true;
    }
  });
}

/**
 * Get services sort order. If user set the order manually, prioritize the order.
 *
 * @return [linguee dictionary, youdao dictionary, deepl...], all lowercase.
 */
export function getSortOrder(): string[] {
  const defaultOrderList = [
    DictionaryType.Youdao,
    DictionaryType.Linguee,

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

  // * NOTE: user manually set the sort order may not be complete, or even tpye wrong name.
  // TEPORARY FIX, servicesOrder should be string here, but actually string | undefined.
  const manualOrder = myPreferences.servicesOrder ? myPreferences.servicesOrder.split(",") : [];

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
export function isTextOneLineTooLong(text: string, textLanguage: string): boolean {
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
  let isShowDetail = false;
  for (const queryResult of queryResults) {
    const sourceResult = queryResult.sourceResult;
    const wordInfo = sourceResult.queryWordInfo;
    const isDictionaryType = checkIsDictionaryType(queryResult.type);
    if (isDictionaryType) {
      if (wordInfo.hasDictionaryEntries) {
        isShowDetail = false;
        break;
      }
    } else {
      // check if translation is too long
      const oneLineTranslation = sourceResult?.oneLineTranslation || "";
      const isTooLong = isTextOneLineTooLong(oneLineTranslation, wordInfo.toLanguage);
      if (isTooLong) {
        isShowDetail = true;
        break;
      }
    }
  }
  return isShowDetail;
}

/**
 * Get fromTo language title according from and to language id.  eg. zh-CHS --> en, return: Chinese-Simplified🇨🇳 --> English🇬🇧
 *
 * * Since language title is too long for detail page, so we use short emoji instead.  eg. zh-CHS --> en, return: 🇨🇳 --> 🇬🇧
 */
export function getFromToLanguageTitle(from: string, to: string, onlyEmoji = false) {
  const fromLanguageItem = getLanguageItem(from);
  const toLanguageItem = getLanguageItem(to);
  const fromToEmoji = `${fromLanguageItem.emoji} --> ${toLanguageItem.emoji}`;
  const fromToLanguageNameAndEmoji = `${fromLanguageItem.langEnglishName}${fromLanguageItem.emoji} --> ${toLanguageItem.langEnglishName}${toLanguageItem.emoji}`;
  return onlyEmoji ? fromToEmoji : fromToLanguageNameAndEmoji;
}

/**
 * Get show more detail markdown.
 */
export function getShowMoreDetailMarkdown(displayItem: ListDisplayItem) {
  const { queryType, displayType, title, subtitle, copyText, detailsMarkdown } = displayItem;
  const { word, fromLanguage, toLanguage } = displayItem.queryWordInfo;

  const type = queryType.toString();
  const fromToLang = getFromToLanguageTitle(fromLanguage, toLanguage);
  const fromToTitle = `${type}  (${fromToLang})`;

  let markdown = "";

  // Translate type
  if (checkIsTranslationType(queryType)) {
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

  let queryWord = word;
  let explanation = title;

  // Linguee dictionary
  if (checkIsLingueeListItem(displayItem)) {
    queryWord = word;
    explanation = displayItem.copyText;
  }

  // Youdao dictionary
  if (checkIsYoudaoDictionaryListItem(displayItem)) {
    queryWord = word;
    explanation = subtitle ? `${title} ${subtitle}` : title;
    if (subtitle?.startsWith(title)) {
      explanation = subtitle;
    }
    // if subtitle starts with "title", use subtitle
    if (subtitle) {
      const reg = /"(.*)"/;
      const match = reg.exec(subtitle);
      if (match) {
        const startWord = match[1];
        if (startWord === title) {
          explanation = subtitle;
        }
      }
    }
    if (displayType === YoudaoDictionaryListItemType.ModernChineseDict) {
      explanation = detailsMarkdown || copyText;
    }
  }

  markdown = `
## ${fromToTitle} 
### ${queryWord}
----
${explanation}
`;

  return markdown;
}

/**
 * Get translation markdown.
 */
export function getTranslationMarkdown(sourceResult: QueryTypeResult) {
  const { type, translations, queryWordInfo: wordInfo } = sourceResult;
  const oneLineTranslation = translations.join("\n");
  if (oneLineTranslation.trim().length === 0) {
    return "";
  }

  const text = oneLineTranslation.replace(/\n/g, "\n\n");
  const fromTo = getFromToLanguageTitle(wordInfo.fromLanguage, wordInfo.toLanguage, true);

  const markdown = `
## ${type}   (${fromTo})
----  
${text}
`;
  return markdown;
}

/**
 * Get auto select target language according to the LangCode.
 */
export function getAutoSelectedTargetLanguageItem(fromLangCode: string): LanguageItem {
  const targetLanguageItem = preferredLanguages.find(
    (languageItem) => languageItem.youdaoLangCode !== fromLangCode,
  ) as LanguageItem;
  logTrace("language", `fromLangCode: ${fromLangCode}, auto selected target: ${targetLanguageItem.youdaoLangCode}`);
  return targetLanguageItem;
}
