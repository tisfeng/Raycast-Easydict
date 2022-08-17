/*
 * @author: tisfeng
 * @createTime: 2022-08-17 17:41
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-17 17:43
 * @fileName: utils.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { maxLineLengthOfChineseTextDisplay, maxLineLengthOfEnglishTextDisplay } from "../language/languages";
import { myPreferences } from "../preferences";
import { DicionaryType, RequestErrorInfo, TranslationType } from "../types";

/**
 * Get services sort order. If user set the order manually, prioritize the order.
 *
 * * Note: currently only can manually sort transaltion order.
 *
 * @return [linguee dictionary, youdao dictionary, deepl...], all lowercase.
 */
export function getSortOrder(): string[] {
  const defaultDictionaryOrder = [DicionaryType.Linguee, DicionaryType.Youdao];
  const defaultTranslationOrder = [
    TranslationType.DeepL,
    TranslationType.Google,
    TranslationType.Apple,
    TranslationType.Baidu,
    TranslationType.Tencent,
    TranslationType.Youdao,
    TranslationType.Caiyun,
  ];

  const defaultTranslations = defaultTranslationOrder.map((type) => type.toString().toLowerCase());

  const userOrder: string[] = [];
  // * NOTE: user manually set the sort order may not be complete, or even tpye wrong name.
  const manualOrder = myPreferences.translationOrder.split(","); // "Baidu,DeepL,Tencent"
  // console.log("---> manualOrder:", manualOrder);
  if (manualOrder.length > 0) {
    for (let translationName of manualOrder) {
      translationName = `${translationName.trim()} Translate`.toLowerCase();
      // if the type name is in the default order, add it to user order, and remove it from defaultNameOrder.
      if (defaultTranslations.includes(translationName)) {
        userOrder.push(translationName);
        defaultTranslations.splice(defaultTranslations.indexOf(translationName), 1);
      }
    }
  }

  const finalOrder = [...defaultDictionaryOrder, ...userOrder, ...defaultTranslations].map((title) =>
    title.toLowerCase()
  );
  // console.log("defaultNameOrder:", defaultTranslations);
  // console.log("userOrder:", userOrder);
  // console.log("finalOrder:", finalOrder);
  return finalOrder;
}

/**
 * Determine whether the title of the result exceeds the maximum value of one line.
 */
export function isTranslationTooLong(translation: string, toLanguage: string): boolean {
  const isChineseTextResult = toLanguage === "zh-CHS";
  const isEnglishTextResult = toLanguage === "en";
  let isTooLong = false;
  const textLength = translation.length;
  if (isChineseTextResult) {
    if (textLength > maxLineLengthOfChineseTextDisplay) {
      isTooLong = true;
    }
  } else if (isEnglishTextResult) {
    if (textLength > maxLineLengthOfEnglishTextDisplay) {
      isTooLong = true;
    }
  } else if (textLength > maxLineLengthOfEnglishTextDisplay) {
    isTooLong = true;
  }
  console.log(`---> check is too long: ${isTooLong}, length: ${translation.length}`);
  return isTooLong;
}

/**
 * Show error toast according to errorInfo.
 */
export function showErrorInfoToast(errorInfo: RequestErrorInfo) {
  showToast({
    style: Toast.Style.Failure,
    title: `${errorInfo.type} Error: ${errorInfo.code || ""}`,
    message: errorInfo.message,
  });
}
