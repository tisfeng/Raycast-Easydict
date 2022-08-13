/*
 * @author: tisfeng
 * @createTime: 2022-08-05 10:54
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-13 12:58
 * @fileName: languages.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { youdaoErrorList } from "../consts";
import { francDetectTextLangauge } from "../detectLanauge/franc";
import { QueryWordInfo } from "../dict/youdao/types";
import { RequestErrorInfo } from "../types";
import { preferrdLanguages } from "./../preferences";
import { languageItemList } from "./consts";

export interface LanguageItem {
  youdaoLanguageId: string;
  appleDetectChineseLanguageTitle: string; // such as 中文，英语. ⚠️: Apple detect more languages than apple translate.
  appleLanguageId?: string; // used to translate, Apple translate support 12 languages?
  deepLSourceLanguageId?: string; // deepL source language id
  deepLTargetLanguageId?: string; // most are same as source language, some are different, such as "EN-GB" "EN-US" and so on. "EN" = "EN-US"
  francLanguageId: string; // the languages represented by ISO 639-3
  aliyunLanguageId: string;
  tencentDetectLanguageId?: string; // tencent detect language id, [Japanese is "jp", Korean is "kr"] different from tencentLanguageId
  tencentLanguageId?: string;
  baiduLanguageId: string;
  caiyunLanguageId?: string;
  languageTitle: string; // * when system language is English, Apple detect language is equal to languageTitle.
  voiceList?: string[];
  googleLanguageId?: string;
  youdaoWebLanguageId?: string;
  eudicWebLanguageId?: string;
  emoji: string;
}

export const maxLineLengthOfChineseTextDisplay = 45;
export const maxLineLengthOfEnglishTextDisplay = 95;

export function getLanguageItemFromYoudaoId(youdaoLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.youdaoLanguageId === youdaoLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

/**
 * get language item from tencent language id, if not found, return auto language item
 */
export function getLanguageItemFromTencentId(tencentLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    const tencentDetectLanguageId = langItem.tencentDetectLanguageId || langItem.tencentLanguageId;
    if (tencentDetectLanguageId === tencentLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

/**
 * get language item from baidu language id.
 */
export function getLanguageItemFromBaiduId(baiduLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.baiduLanguageId === baiduLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

/**
 * Get language item from apple detect language id, this value is depend on the system language.
 *
 * Example: if system language is English, then the value is "English", if system language is Chinese, then the value is "中文".
 *
 * Todo: currently only support Chinese and English, later support other languages.
 *
 * Todo: use franc to detect language, then use franc language id to get language item.
 */
export function getLanguageItemFromAppleId(appleLanguageTitle: string): LanguageItem {
  const francTypeResult = francDetectTextLangauge(appleLanguageTitle);
  const youdaoLanguageId = francTypeResult.youdaoLanguageId;
  const languageItem = getLanguageItemFromYoudaoId(youdaoLanguageId);
  console.log(`---> getLanguageItemFromAppleId: ${appleLanguageTitle}, franc detect youdaoId: ${youdaoLanguageId}`);

  const chineseLanguageItem = getLanguageItemFromAppleChineseTitle(appleLanguageTitle);
  if (chineseLanguageItem) {
    return chineseLanguageItem;
  }

  const englishLanguageItem = getLanguageItemFromAppleEnglishTitle(appleLanguageTitle);
  if (englishLanguageItem) {
    return englishLanguageItem;
  }

  return languageItem;
}

/**
 * Get language item from apple Chinese title, such as "中文" --> LanguageItem
 *
 * * Note: There are two kinds of Chinese, 简体中文 and 繁体中文, but Apple only has one kind of 中文.
 */
export function getLanguageItemFromAppleChineseTitle(chineseTitle: string): LanguageItem | undefined {
  for (const langItem of languageItemList) {
    if (langItem.appleDetectChineseLanguageTitle.includes(chineseTitle)) {
      return langItem;
    }
  }
}

/**
 * Get language item from apple English title, such as "English" --> LanguageItem
 *
 * * Note: There are two kinds of Chinese, Chinese-Simplified and Chinese-Traditional, but Apple only has one kind of Chinese.
 */
export function getLanguageItemFromAppleEnglishTitle(englishTitle: string): LanguageItem | undefined {
  for (const langItem of languageItemList) {
    if (langItem.languageTitle.includes(englishTitle)) {
      return langItem;
    }
  }
}

/**
 * Return language item from deepL language id, if not found, return auto language item
 */
export function getLanguageItemFromDeepLSourceId(deepLLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.deepLSourceLanguageId === deepLLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

/**
 * Get deepL language id from youdao language id.
 */
export function getDeepLLanguageId(youdaoLanguageId: string): string | undefined {
  const languageItem = getLanguageItemFromYoudaoId(youdaoLanguageId);
  return languageItem.deepLSourceLanguageId;
}

/**
 * Get language item from franc language id
 */
export function getLanguageItemFromFrancId(francLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.francLanguageId === francLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

/**
 * Check language id is valid, except 'auto', ''
 */
export function isValidLanguageId(languageId: string): boolean {
  if (languageId === "auto" || languageId.length === 0) {
    return false;
  }
  return true;
}

export function getEudicWebDictionaryURL(queryTextInfo: QueryWordInfo): string | undefined {
  const languageId = getLanguageOfTwoExceptChinese([queryTextInfo.fromLanguage, queryTextInfo.toLanguage]);
  if (!languageId) {
    return;
  }

  const eudicWebLanguageId = getLanguageItemFromYoudaoId(languageId).eudicWebLanguageId;
  if (eudicWebLanguageId) {
    return `https://dict.eudic.net/dicts/${eudicWebLanguageId}/${encodeURIComponent(queryTextInfo.word)}`;
  }
}

export function getYoudaoWebDictionaryURL(queryTextInfo: QueryWordInfo): string | undefined {
  const languageId = getLanguageOfTwoExceptChinese([queryTextInfo.fromLanguage, queryTextInfo.toLanguage]);
  if (!languageId) {
    return;
  }

  const youdaoWebLanguageId = getLanguageItemFromYoudaoId(languageId).youdaoWebLanguageId;
  if (youdaoWebLanguageId) {
    return `https://www.youdao.com/w/${youdaoWebLanguageId}/${encodeURIComponent(queryTextInfo.word)}`;
  }
}

/**
 * Get another language item expcept chinese from language item array
 */
export function getLanguageOfTwoExceptChinese(youdaoLanguageIds: [string, string]): string | undefined {
  if (youdaoLanguageIds.includes("zh-CHS")) {
    return youdaoLanguageIds[0] === "zh-CHS" ? youdaoLanguageIds[1] : youdaoLanguageIds[0];
  }
}

/**
 * Get google language id from youdao language id.
 */
export function getGoogleLanguageId(youdaoLanguageId: string): string | undefined {
  const languageItem = getLanguageItemFromYoudaoId(youdaoLanguageId);
  return languageItem.googleLanguageId || languageItem.youdaoLanguageId;
}

export function getGoogleWebTranslateURL(queryTextInfo: QueryWordInfo): string | undefined {
  const text = encodeURIComponent(queryTextInfo.word);
  const fromLanguageId = getGoogleLanguageId(queryTextInfo.fromLanguage);
  const toLanguageId = getGoogleLanguageId(queryTextInfo.toLanguage);
  const tld = queryTextInfo.tld || "cn";
  return `https://translate.google.${tld}/?sl=${fromLanguageId}&tl=${toLanguageId}&text=${text}&op=translate`;
}

/**
 * Get DeepL web translate url
 * https://www.deepl.com/translator#en/zh/look
 */
export function getDeepLWebTranslateURL(queryTextInfo: QueryWordInfo): string | undefined {
  const fromLanguageId = getDeepLLanguageId(queryTextInfo.fromLanguage);
  const toLanguageId = getDeepLLanguageId(queryTextInfo.toLanguage);
  if (fromLanguageId && toLanguageId) {
    return `https://www.deepl.com/translator#${fromLanguageId}/${toLanguageId}/${encodeURIComponent(
      queryTextInfo.word
    )}`;
  }
}

export function getYoudaoErrorInfo(errorCode: string): RequestErrorInfo {
  return (
    youdaoErrorList.find((item) => item.code === errorCode) || {
      code: errorCode,
      message: "",
    }
  );
}

/**
 * Get auto select target language according to the languageId.
 */
export function getAutoSelectedTargetLanguageItem(fromLanguageId: string): LanguageItem {
  const targetLanguageItem = preferrdLanguages.find(
    (languageItem) => languageItem.youdaoLanguageId !== fromLanguageId
  ) as LanguageItem;
  console.log(`fromLanguageId: ${fromLanguageId}, auto selected target: ${targetLanguageItem.youdaoLanguageId}`);
  return targetLanguageItem;
}
