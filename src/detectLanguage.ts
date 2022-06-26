/*
 * @author: tisfeng
 * @createTime: 2022-06-24 17:07
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-26 18:19
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
} from "./utils";

export enum LanguageDetectType {
  Local = "Local",
  Apple = "Apple",
  Tencent = "Tencent",
}

export interface LanguageDetectTypeResult {
  type: LanguageDetectType;
  languageId: string;
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
 * detect language with the given text, callback with language detect type and language id
 */
export function detectLanguage(text: string, callback: (result: LanguageDetectTypeResult) => void): void {
  // covert the input text to lowercase, because tencentLanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
  const lowerCaseText = text.toLowerCase();
  console.log("queryText:", text);
  console.log("lowerCaseText:", lowerCaseText);

  // new a action map, key is LanguageDetectType, value is Promise<LanguageDetectTypeResult>
  const actionMap = new Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>();
  actionMap.set(LanguageDetectType.Tencent, tencentLanguageDetect(lowerCaseText));
  if (myPreferences.enableAppleLanguageDetect) {
    actionMap.set(LanguageDetectType.Apple, appleLanguageDetect(lowerCaseText));
  }

  // priority API language detect
  raceDetectTextLanguage(lowerCaseText, actionMap, (detectTypeResult) => {
    console.warn(`raceDetectTextLanguage: ${JSON.stringify(detectTypeResult, null, 4)}`);
    callback(detectTypeResult);
  });

  // start a delay local language detect timer, use it only if API detect over time and local detect language is preferred.
  clearTimeout(delayLocalDetectLanguageTimer);
  delayLocalDetectLanguageTimer = setTimeout(() => {
    const localDetectLanguageId = localDetectTextLanguageId(lowerCaseText);
    if (isPreferredLanguage(localDetectLanguageId)) {
      isDetectedLanguage = true;
      console.log(`use local detect language --->: ${localDetectLanguageId}`);
      callback({ type: LanguageDetectType.Local, languageId: localDetectLanguageId });
    }
  }, delayDetectLanguageInterval);
}

/**
 *  get final detected language according to the text and detect language,
 *  if the detect language is the preferred language, or local detect language is "auto", use it directly.
 *  else use local language detect.
 */
export function getFinalDetectedLanguage(text: string, detectTypeResult: LanguageDetectTypeResult): string {
  const [type, detectLanguageId] = [detectTypeResult.type, detectTypeResult.languageId];
  const isLocalDetectedAutoLanguage = type === LanguageDetectType.Local && detectLanguageId === "auto";
  if (isPreferredLanguage(detectLanguageId) || isLocalDetectedAutoLanguage) {
    return detectLanguageId;
  }
  return localDetectTextLanguageId(text);
}

/**
 * promise race to detect language, if success, callback API detect language, else local detect language
 * @param text
 * @param detectLanguageActionMap
 * @param callback LanguageDetectTypeResult => {}
 */
function raceDetectTextLanguage(
  text: string,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  callback: (detectTypeResult: LanguageDetectTypeResult) => void
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
        const appleLanguageId = typeResult.languageId as string;
        const languageItem = getLanguageItemFromAppleChineseTitle(appleLanguageId);
        console.warn(`apple detect language: ${appleLanguageId}, youdao: ${languageItem?.youdaoLanguageId}`);

        const checkIsPreferredLanguage = checkDetectedLanguageIsPreferred(
          LanguageDetectType.Apple,
          languageItem,
          detectLanguageActionMap
        );
        if (checkIsPreferredLanguage || detectLanguageActionMap.size === 0) {
          callback(typeResult);
        } else {
          raceDetectTextLanguage(text, detectLanguageActionMap, callback);
        }
      }

      if (typeResult.type === LanguageDetectType.Tencent) {
        const tencentLanguageId = typeResult.languageId || "";
        const languageItem = getLanguageItemFromTencentId(tencentLanguageId);
        console.warn(`tencent detect language: ${tencentLanguageId}, youdao: ${languageItem?.youdaoLanguageId}`);

        const checkIsPreferredLanguage = checkDetectedLanguageIsPreferred(
          LanguageDetectType.Tencent,
          languageItem,
          detectLanguageActionMap
        );
        if (checkIsPreferredLanguage || detectLanguageActionMap.size === 0) {
          callback(typeResult);
        } else {
          raceDetectTextLanguage(text, detectLanguageActionMap, callback);
        }
      }
    })
    .catch((error) => {
      console.error(`detect language error: ${error}`);
      callback({ type: LanguageDetectType.Local, languageId: localDetectTextLanguageId(text) });
    });
}

/**
 * check if the language is preferred language, if not, remove it from the action map
 */
function checkDetectedLanguageIsPreferred(
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
 * get local detect language id according to inputText, priority to use English and Chinese, and then auto
 */
export function localDetectTextLanguageId(inputText: string): string {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(inputText) && isPreferredLanguagesContainedEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isContainChinese(inputText) && isPreferredLanguagesContainedChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.log("local detect fromLanguage -->:", fromYoudaoLanguageId);
  return fromYoudaoLanguageId;
}

/**
 * check if the language is preferred language
 */
export function isPreferredLanguage(languageId: string): boolean {
  return languageId === defaultLanguage1.youdaoLanguageId || languageId === defaultLanguage2.youdaoLanguageId;
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
 * check if text isEnglish or isNumber
 */
export function isEnglishOrNumber(text: string) {
  const pureText = removePunctuation(removeBlankSpace(text));
  console.log("pureText: " + pureText);
  return /^[a-zA-Z0-9]+$/.test(pureText);
}
