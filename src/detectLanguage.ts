/*
 * @author: tisfeng
 * @createTime: 2022-06-24 17:07
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-27 11:23
 * @fileName: detectLanguage.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { getPreferenceValues } from "@raycast/api";
import { tencentLanguageDetect } from "./request";
import { appleLanguageDetect } from "./scripts";
import { LanguageItem, MyPreferences } from "./types";
import {
  defaultLanguage1,
  defaultLanguage2,
  getLanguageItemFromAppleChineseTitle,
  getLanguageItemFromTencentId,
  myPreferences,
  preferredLanguages,
} from "./utils";

export enum LanguageDetectType {
  Local = "Local",
  Apple = "Apple",
  Tencent = "Tencent",
}

export interface LanguageDetectTypeResult {
  type: LanguageDetectType;
  youdaoLanguageId: string;
}

/**
 * * for a better user experience, a maximum of 2 seconds is set to request language detect API, and the local language check is used for timeout.
 *
 * If Apple language detection is enabled, both Apple language test and Tencent language test will be initiated, and which first-out result will be used.
 * If the language of the asynchronous check is the preferred language, use it directly. If not, continue to invoke local language detection.
 */
const delayDetectLanguageInterval = 2000;
let isDetectedLanguage = false;
let delayLocalDetectLanguageTimer: NodeJS.Timeout;

/**
 * record the detected language id, if has detected two identical language id, use it.
 *
 * * NOTE: the initial value is "auto", because the API detect language may be undefined!
 */
let detectedLanguageId = "auto";

/**
 * detect language with the given text, callback with detectTypeResult and confirmed
 */
export function detectLanguage(
  text: string,
  callback: (detectTypeResult: LanguageDetectTypeResult, confirmed: boolean) => void
): void {
  // covert the input text to lowercase, because tencentLanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
  const lowerCaseText = text.toLowerCase();
  console.log("queryText:", text);
  console.log("lowerCaseText:", lowerCaseText);

  // new a action map, key is LanguageDetectType, value is Promise<LanguageDetectTypeResult>
  const detectActionMap = new Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>();
  detectActionMap.set(LanguageDetectType.Tencent, tencentLanguageDetect(lowerCaseText));
  if (myPreferences.enableAppleLanguageDetect) {
    detectActionMap.set(LanguageDetectType.Apple, appleLanguageDetect(lowerCaseText));
  }

  // priority API language detect
  raceDetectTextLanguage(detectActionMap, (detectTypeResult, confirmed) => {
    callback(detectTypeResult, confirmed);
  });

  // start a delay local language detect timer, use it only if API detect over time and local detect language is preferred.
  clearTimeout(delayLocalDetectLanguageTimer);
  delayLocalDetectLanguageTimer = setTimeout(() => {
    const localDetectLanguageId = localDetectTextLanguageId(lowerCaseText);
    if (isPreferredLanguage(localDetectLanguageId)) {
      isDetectedLanguage = true;
      console.log(`use local detect language --->: ${localDetectLanguageId}`);
      const localDetectTypeResult = {
        type: LanguageDetectType.Local,
        youdaoLanguageId: localDetectLanguageId,
      };
      callback(localDetectTypeResult, false);
    }
  }, delayDetectLanguageInterval);
}

/**
 * promise race to detect language, if success, callback API detect language, else local detect language
 */
function raceDetectTextLanguage(
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  callback: (detectTypeResult: LanguageDetectTypeResult, confirmed: boolean) => void
) {
  console.log(`start raceDetectTextLanguage: ${[...detectLanguageActionMap.keys()]}`);
  isDetectedLanguage = false;
  const detectLanguageActionList = detectLanguageActionMap.values();
  Promise.race(detectLanguageActionList)
    .then((typeResult) => {
      if (isDetectedLanguage) {
        console.warn(`promise race detect over time: ${JSON.stringify(typeResult, null, 4)}`);
        return;
      }

      isDetectedLanguage = true;
      clearTimeout(delayLocalDetectLanguageTimer);

      if (typeResult.type === LanguageDetectType.Apple) {
        const appleLanguageId = typeResult.youdaoLanguageId as string;
        const languageItem = getLanguageItemFromAppleChineseTitle(appleLanguageId);
        console.log(`apple detect language: ${appleLanguageId}, youdao: ${languageItem.youdaoLanguageId}`);
        handleDetectedLanguage(typeResult.type, languageItem, detectLanguageActionMap, callback);
      }

      if (typeResult.type === LanguageDetectType.Tencent) {
        const tencentLanguageId = typeResult.youdaoLanguageId || "";
        const languageItem = getLanguageItemFromTencentId(tencentLanguageId);
        console.log(`tencent detect language: ${tencentLanguageId}, youdao: ${languageItem.youdaoLanguageId}`);
        handleDetectedLanguage(typeResult.type, languageItem, detectLanguageActionMap, callback);
      }
    })
    .catch((error) => {
      console.error(`detect language error: ${error}`);
      callback({ type: LanguageDetectType.Local, youdaoLanguageId: "auto" }, false);
    });
}

/**
 * check if the language is preferred language, or has two identical language id, or has no continue detect action
 */
function handleDetectedLanguage(
  detectType: LanguageDetectType,
  languageItem: LanguageItem | undefined,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  callback: (detectTypeResult: LanguageDetectTypeResult, confirmed: boolean) => void
) {
  const detectTypeResult = {
    type: detectType,
    youdaoLanguageId: languageItem?.youdaoLanguageId as string,
  };

  // first check if the language is preferred language, if true, use it directly, else remove it from the action map
  const checkIsPreferredLanguage = checkIfDetectedPreferredLanguage(detectType, languageItem, detectLanguageActionMap);
  if (checkIsPreferredLanguage) {
    callback(detectTypeResult, true);
    return;
  }

  // second check if has detected two identical language id, if true, use it
  const hasDetectedTwoIdenticalLanguage =
    detectedLanguageId === languageItem?.youdaoLanguageId && detectedLanguageId !== "auto";
  if (hasDetectedTwoIdenticalLanguage) {
    console.warn(`detect two identical language: ${detectedLanguageId}`);
    callback(detectTypeResult, true);
    return;
  }

  // finally, if this is the last language detect action, have to use it, but not confirmed
  if (detectLanguageActionMap.size === 0) {
    callback(detectTypeResult, false);
    return;
  }

  detectedLanguageId = languageItem?.youdaoLanguageId || "";
  // if current action detect language has no result, continue to detect next action
  raceDetectTextLanguage(detectLanguageActionMap, callback);
}

/**
 * check if the language is preferred language, if not, remove it from the action map
 */
function checkIfDetectedPreferredLanguage(
  detectType: LanguageDetectType,
  languageItem: LanguageItem | undefined,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>
) {
  if (!languageItem || !isPreferredLanguage(languageItem.youdaoLanguageId)) {
    for (const [type] of detectLanguageActionMap) {
      if (type === detectType) {
        detectLanguageActionMap.delete(type);
      }
    }
    console.warn(`${detectType} check not preferred language: ${languageItem?.youdaoLanguageId}`);
    return false;
  }
  return true;
}

/**
 *  get final confirmed language according to the text and detect language,
 *  if the detect language is the preferred language, or local detect language is "auto", use it directly.
 *  else use local language detect.
 */
export function getFinalConfirmedLanguage(text: string, youdaoLanguageId: string): string {
  if (isPreferredLanguage(youdaoLanguageId)) {
    return youdaoLanguageId;
  }
  const localDetectLanguageId = localDetectTextLanguageId(text);
  const isLocalDetectedAutoLanguage = localDetectLanguageId === "auto";
  if (isLocalDetectedAutoLanguage) {
    return youdaoLanguageId;
  }
  return localDetectLanguageId;
}

/**
 * get local detect language id according to inputText, priority to use English and Chinese, and then auto
 */
export function localDetectTextLanguageId(inputText: string): string {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(inputText) && isPreferredLanguagesContainedEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isChinese(inputText) && isPreferredLanguagesContainedChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.log("local detect fromLanguage -->:", fromYoudaoLanguageId);
  return fromYoudaoLanguageId;
}

/**
 * check if the language is preferred language
 */
export function isPreferredLanguage(languageId: string): boolean {
  return preferredLanguages.map((item) => item.youdaoLanguageId).includes(languageId);
}

/**
 * check if preferred languages contains English language
 */
export function isPreferredLanguagesContainedEnglish(): boolean {
  return defaultLanguage1.youdaoLanguageId === "en" || defaultLanguage2.youdaoLanguageId === "en";
}

/**
 * check if preferred languages contains Chinese language
 */
export function isPreferredLanguagesContainedChinese(): boolean {
  const lanuguageIdPrefix = "zh";
  const preferences: MyPreferences = getPreferenceValues();
  if (preferences.language1.startsWith(lanuguageIdPrefix) || preferences.language2.startsWith(lanuguageIdPrefix)) {
    return true;
  }
  return false;
}

/**
 * return remove all punctuation from the text
 */
export function removeEnglishPunctuation(text: string) {
  return text.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~·]/g, "");
}

/**
 * return remove all Chinese punctuation and blank space from the text
 */
export function removeChinesePunctuation(text: string) {
  return text.replace(
    /[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g,
    ""
  );
}

/**
 * return remove remove all punctuation from the text
 */
export function removePunctuation(text: string) {
  return removeEnglishPunctuation(removeChinesePunctuation(text));
}

/**
 * return remove all blank space from the text
 */
export function removeBlankSpace(text: string) {
  return text.replace(/\s/g, "");
}

/**
 * check if the text contains Chinese characters
 */
export function isContainChinese(text: string) {
  return /[\u4e00-\u9fa5]/g.test(text);
}

/**
 * check text is chinese
 */
export function isChinese(text: string) {
  return /^[\u4e00-\u9fa5]+$/.test(text);
}

/**
 * check if text isEnglish or isNumber
 */
export function isEnglishOrNumber(text: string) {
  const pureText = removePunctuation(removeBlankSpace(text));
  console.log("pureText: " + pureText);
  return /^[a-zA-Z0-9]+$/.test(pureText);
}
