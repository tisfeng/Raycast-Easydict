/*
 * @author: tisfeng
 * @createTime: 2022-08-05 10:54
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-12 17:56
 * @fileName: languages.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { youdaoErrorList } from "../consts";
import { QueryWordInfo } from "../dict/youdao/types";
import { RequestErrorInfo } from "../types";
import { preferrdLanguage1, preferrdLanguage2 } from "./../preferences";
import { languageItemList } from "./consts";

export interface LanguageItem {
  youdaoLanguageId: string;
  appleDetectChineseLanguageTitle: string; // such as 中文，英语. ⚠️: Apple detect more languages than apple translate.
  appleLanguageId?: string; // used to translate, Apple translate support 12 languages?
  deepLSourceLanguageId?: string; // deepL source language id
  deepLTargetLanguageId?: string; // most are same as source language, some are different, such as "EN-GB" "EN-US" and so on.
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
export function getLanguageItemFromAppleId(appleLanguageId: string): LanguageItem {
  const chineseLanguageItem = getLanguageItemFromAppleChineseTitle(appleLanguageId);
  if (chineseLanguageItem) {
    return chineseLanguageItem;
  }

  const englishLanguageItem = getLanguageItemFromAppleEnglishTitle(appleLanguageId);
  if (englishLanguageItem) {
    return englishLanguageItem;
  }

  return languageItemList[0];
}

/**
 * Get language item from apple Chinese title, such as "中文" --> LanguageItem
 */
export function getLanguageItemFromAppleChineseTitle(chineseTitle: string): LanguageItem | undefined {
  for (const langItem of languageItemList) {
    if (langItem.appleDetectChineseLanguageTitle === chineseTitle) {
      return langItem;
    }
  }
}

/**
 * Get language item from apple English title, such as "English" --> LanguageItem
 */
export function getLanguageItemFromAppleEnglishTitle(englishTitle: string): LanguageItem | undefined {
  for (const langItem of languageItemList) {
    if (langItem.languageTitle === englishTitle) {
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

export function getGoogleWebTranslateURL(queryTextInfo: QueryWordInfo): string | undefined {
  const text = encodeURIComponent(queryTextInfo.word);
  const fromLanguageItem = getLanguageItemFromYoudaoId(queryTextInfo.fromLanguage);
  const toLanguageItem = getLanguageItemFromYoudaoId(queryTextInfo.toLanguage);
  const fromLanguageId = fromLanguageItem.googleLanguageId || fromLanguageItem.youdaoLanguageId;
  const toLanguageId = toLanguageItem.googleLanguageId || toLanguageItem.youdaoLanguageId;
  if (fromLanguageId && toLanguageId) {
    return `https://translate.google.cn/?sl=${fromLanguageId}&tl=${toLanguageId}&text=${text}&op=translate`;
  }
}

/**
 * Get DeepL web translate url
 * https://www.deepl.com/translator#en/zh/look
 */
export function getDeepLWebTranslateURL(queryTextInfo: QueryWordInfo): string | undefined {
  const fromLanguageItem = getLanguageItemFromYoudaoId(queryTextInfo.fromLanguage);
  const toLanguageItem = getLanguageItemFromYoudaoId(queryTextInfo.toLanguage);
  const fromLanguageId = fromLanguageItem.deepLSourceLanguageId;
  const toLanguageId = toLanguageItem.deepLSourceLanguageId;
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
 * return and update the autoSelectedTargetLanguage according to the languageId
 */
export function getAutoSelectedTargetLanguageId(accordingLanguageId: string): string {
  let targetLanguageId = "auto";
  if (accordingLanguageId === preferrdLanguage1.youdaoLanguageId) {
    targetLanguageId = preferrdLanguage2.youdaoLanguageId;
  } else if (accordingLanguageId === preferrdLanguage2.youdaoLanguageId) {
    targetLanguageId = preferrdLanguage1.youdaoLanguageId;
  }

  const targetLanguage = getLanguageItemFromYoudaoId(targetLanguageId);

  console.log(`languageId: ${accordingLanguageId}, auto selected target: ${targetLanguage.youdaoLanguageId}`);
  return targetLanguage.youdaoLanguageId;
}
