/*
 * @author: tisfeng
 * @createTime: 2022-06-24 17:07
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-30 01:10
 * @fileName: detectLanguage.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { getPreferenceValues } from "@raycast/api";
import { francAll } from "franc";
import { languageItemList } from "./consts";
import { tencentLanguageDetect } from "./request";
import { appleLanguageDetect } from "./scripts";
import { MyPreferences, RequestErrorInfo } from "./types";
import {
  defaultLanguage1,
  defaultLanguage2,
  getLanguageItemFromAppleChineseTitle,
  getLanguageItemFromFrancId,
  getLanguageItemFromTencentId,
  myPreferences,
  preferredLanguages,
} from "./utils";

/**
 * * Only franc detect language confidence > 0.5 && is preferred language, the language can be confirmed.
 */
const francDetectConfirmedConfidence = 0.4;

export enum LanguageDetectType {
  Simple = "Simple",
  Franc = "Franc",
  Apple = "Apple",
  Tencent = "Tencent",
}

export interface LanguageDetectTypeResult {
  type: LanguageDetectType;
  youdaoLanguageId: string;
  confirmed: boolean;
  detectedLanguageArray?: [string, number][]; // [['ita', 1], ['fra', 0.6]]
}

/**
 * * For a better user experience, a maximum of 2 seconds is set to request language detect API, and the local language check is used for timeout.
 *
 * If Apple language detection is enabled, both Apple language test and Tencent language test will be initiated, and which first-out result will be used.
 * If the language of the asynchronous check is the preferred language, use it directly. If not, continue to invoke local language detection.
 */
const delayDetectLanguageInterval = 2000;
let isDetectedLanguage = false;
let delayLocalDetectLanguageTimer: NodeJS.Timeout;

/**
 * Record all API detected language id, if has detected two identical language id, use it.
 */
const detectedLanguageTypeResultList: LanguageDetectTypeResult[] = [];

/**
 * Detect language with the given text, callback with LanguageDetectTypeResult.
 *
 * Prioritize the local language detection, then the language detection API.
 */
export function detectLanguage(text: string, callback: (detectTypeResult: LanguageDetectTypeResult) => void): void {
  const localDetectLangTypeResult = localDetectTextLanguage(text);
  if (localDetectLangTypeResult.confirmed) {
    console.log(
      "use local detect confirmed:",
      localDetectLangTypeResult.type,
      localDetectLangTypeResult.youdaoLanguageId
    );
    clearTimeout(delayLocalDetectLanguageTimer);
    callback(localDetectLangTypeResult);
    return;
  }

  // Start a delay timer to detect local language, use it only if API detect over time and local detect language is preferred.
  clearTimeout(delayLocalDetectLanguageTimer);
  delayLocalDetectLanguageTimer = setTimeout(() => {
    if (isPreferredLanguage(localDetectLangTypeResult.youdaoLanguageId)) {
      isDetectedLanguage = true;
      console.log(`use local detect language --->: ${localDetectLangTypeResult}`);
      callback(localDetectLangTypeResult);
    }
  }, delayDetectLanguageInterval);

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

  // if local detect language is not confirmed, use API language detect
  try {
    raceDetectTextLanguage(detectActionMap, localDetectLangTypeResult, (detectTypeResult) => {
      const finalLanguageTypeResult = getFinalLanguageDetectTypeResult(
        text,
        detectTypeResult,
        localDetectLangTypeResult
      );
      callback(finalLanguageTypeResult);
    });
  } catch (error) {
    // ? Never to enter here
    // if API detect error, use local detect language
    console.error(`detect language error: ${error}`);
    callback(localDetectLangTypeResult);
  }
}

/**
 * Promise race to detect language, if success, callback API detect language, else local detect language
 */
function raceDetectTextLanguage(
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  localLanguageDetectTypeResult: LanguageDetectTypeResult,
  callback?: (detectTypeResult: LanguageDetectTypeResult) => void
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

        const detectTypeResult = {
          type: typeResult.type,
          youdaoLanguageId: languageItem.youdaoLanguageId,
          confirmed: false, // default is false, need to confirm whether preferred language.
        };
        handleDetectedLanguageTypeResult(
          detectTypeResult,
          localLanguageDetectTypeResult,
          detectLanguageActionMap,
          callback
        );
      }

      if (typeResult.type === LanguageDetectType.Tencent) {
        const tencentLanguageId = typeResult.youdaoLanguageId || "";
        const languageItem = getLanguageItemFromTencentId(tencentLanguageId);
        console.log(`tencent detect language: ${tencentLanguageId}, youdao: ${languageItem.youdaoLanguageId}`);
        const detectTypeResult = {
          type: typeResult.type,
          youdaoLanguageId: languageItem.youdaoLanguageId,
          confirmed: false, // default is false
        };
        handleDetectedLanguageTypeResult(
          detectTypeResult,
          localLanguageDetectTypeResult,
          detectLanguageActionMap,
          callback
        );
      }
    })
    .catch((error) => {
      // If current API detect error, remove it from the detectActionMap, and try next detect API.
      console.error(`race detect language error: ${JSON.stringify(error, null, 4)}`);

      const errorInfo = error as RequestErrorInfo;
      const detectTypeResult = {
        type: errorInfo.type as LanguageDetectType,
        youdaoLanguageId: "",
        confirmed: false,
      };
      handleDetectedLanguageTypeResult(
        detectTypeResult,
        localLanguageDetectTypeResult,
        detectLanguageActionMap,
        callback
      );
    });
}

function handleDetectedLanguageTypeResult(
  detectedlanguageTypeResult: LanguageDetectTypeResult,
  localLanguageDetectTypeResult: LanguageDetectTypeResult,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  callback?: (detectTypeResult: LanguageDetectTypeResult) => void
) {
  // First, check if the language is preferred language, if true, use it directly, else remove it from the action map.
  const checkIsPreferredLanguage = checkDetectedLanguageTypeResultIsPreferredAndIfNeedRemove(
    detectedlanguageTypeResult,
    detectLanguageActionMap
  );
  if (checkIsPreferredLanguage) {
    detectedlanguageTypeResult.confirmed = true;
    callback && callback(detectedlanguageTypeResult);
    return;
  }

  // Second, iterate detectedLanguageTypeList, check if has detected two identical language id, if true, use it.
  for (const languageTypeReuslt of detectedLanguageTypeResultList as LanguageDetectTypeResult[]) {
    if (
      languageTypeReuslt.youdaoLanguageId === detectedlanguageTypeResult.youdaoLanguageId &&
      detectedlanguageTypeResult.youdaoLanguageId.length > 0
    ) {
      languageTypeReuslt.confirmed = true;
      console.warn(`---> API detected identical language: ${JSON.stringify(languageTypeReuslt, null, 4)}`);
      callback && callback(languageTypeReuslt); // use the first detected language type, the speed of response is important.
      return;
    }
  }

  /**
   * Finally, if this is the last language detect action, compare with local detect language list.
   * If matched, mark it as confirmed, else use it directly, but not confirmed.
   */
  if (detectLanguageActionMap.size === 0) {
    const detectedLanguageArray = localLanguageDetectTypeResult.detectedLanguageArray;
    // console.log("local detected language array:", detectedLanguageArray);
    console.log(`detected language id: ${detectedlanguageTypeResult.youdaoLanguageId}`);
    if (detectedLanguageArray) {
      for (const [languageId, confidence] of detectedLanguageArray) {
        if (languageId === detectedlanguageTypeResult.youdaoLanguageId && confidence > 0) {
          detectedlanguageTypeResult.confirmed = true;
          callback && callback(detectedlanguageTypeResult);
          return;
        }
      }
    }

    detectedlanguageTypeResult.confirmed = false;
    callback && callback(detectedlanguageTypeResult);
    return;
  }

  // unshift the API detect language to local detect language list
  // const detectedLanguageIdList = localLanguageDetectTypeResult.detectedLanguageIdList as string[];
  // detectedLanguageIdList.unshift(detectedlanguageTypeResult.youdaoLanguageId);
  // console.log(`local detected language id list: ${detectedLanguageIdList}`);

  detectedLanguageTypeResultList.push(detectedlanguageTypeResult);
  // if current action detect language has no result, continue to detect next action
  raceDetectTextLanguage(detectLanguageActionMap, localLanguageDetectTypeResult, callback);
}

/**
 * Check if the detected language type result is preferred language, if not, remove it from the action map.
 */
function checkDetectedLanguageTypeResultIsPreferredAndIfNeedRemove(
  detectTypeResult: LanguageDetectTypeResult,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>
) {
  const youdaoLanguageId = detectTypeResult.youdaoLanguageId;
  if (youdaoLanguageId.length || !isPreferredLanguage(youdaoLanguageId)) {
    for (const [type] of detectLanguageActionMap) {
      if (type === detectTypeResult.type) {
        detectLanguageActionMap.delete(type);
      }
    }
    console.warn(`${detectTypeResult.type} check not preferred language: ${youdaoLanguageId}`);
    return false;
  }
  return true;
}

/**
 *  Get the final confirmed language type result, for handling some special case.
 *
 *  First, if detectTypeResult is confirmed, or is preferred language, use it directly.
 *  Second, if simple detect language is preferred language, use it.
 *  Finally, if franc detect language isn't "und", use it, else use "auto".
 *
 *  This function only work when franc detect language is not confirmed, and API detect language catch error.
 */
function getFinalLanguageDetectTypeResult(
  text: string,
  detectTypeResult: LanguageDetectTypeResult,
  localLanguageDetectTypeResult: LanguageDetectTypeResult
): LanguageDetectTypeResult {
  console.log(`try get final detect language: ${JSON.stringify(detectTypeResult, null, 4)}`);

  if (detectTypeResult.confirmed || isPreferredLanguage(detectTypeResult.youdaoLanguageId)) {
    return detectTypeResult;
  }

  // if local detect language list is not empty, and detect language confidence > 0.2 && is preferred language, use it?
  const detectedLanguageArray = localLanguageDetectTypeResult.detectedLanguageArray;
  if (detectedLanguageArray) {
    for (const [languageId, confidence] of detectedLanguageArray) {
      if (confidence > 0.2 && isPreferredLanguage(languageId)) {
        console.log(
          `final use local preferred language confidence > 0.2: ${localLanguageDetectTypeResult.youdaoLanguageId}`
        );
        return localLanguageDetectTypeResult;
      }
    }
  }

  // if simple detect is preferred language, use simple detect language('en', 'zh').
  const simpleDetectLangTypeResult = simpleDetectTextLanguage(text);
  if (isPreferredLanguage(simpleDetectLangTypeResult.youdaoLanguageId)) {
    console.log(`final use simple: ${JSON.stringify(simpleDetectLangTypeResult, null, 4)}`);
    return simpleDetectLangTypeResult;
  }

  // finally, if franc detect language is not "und", use it, such as 'fr', 'it'. else use "auto".
  const youdaoLanguageId = localLanguageDetectTypeResult.youdaoLanguageId;
  if (youdaoLanguageId === "und" || youdaoLanguageId.length === 0) {
    localLanguageDetectTypeResult.youdaoLanguageId = "auto";
    console.log(`final use auto`);
  }

  console.log(`final use local: ${JSON.stringify(localLanguageDetectTypeResult, null, 4)}`);
  return localLanguageDetectTypeResult;
}

/**
 * Get local detect language, priority is franc detect language.
 *
 * if franc detect language is confirmed, use it.
 * if franc detect language is undetermined, use simple detect language, mark it as confirmed = false.
 */
export function localDetectTextLanguage(text: string): LanguageDetectTypeResult {
  const francDetectTypeResult = francDetectTextLangauge(text);
  const francDetectLanguageId = francDetectTypeResult.youdaoLanguageId;
  if (francDetectTypeResult.confirmed) {
    console.log(`local detect, franc confirmed language: ${francDetectLanguageId}`);
    return francDetectTypeResult;
  }

  console.log(`franc detect unconfirmed language: ${francDetectTypeResult.youdaoLanguageId}`);

  const francUndetermined = francDetectLanguageId === "und";
  if (francUndetermined) {
    const simpleDetectTypeResult = simpleDetectTextLanguage(text);
    console.log(`local detect, simple unconfirmed language: ${simpleDetectTypeResult.youdaoLanguageId}`);

    const detectTypeResult = {
      type: LanguageDetectType.Simple,
      youdaoLanguageId: simpleDetectTypeResult.youdaoLanguageId,
      confirmed: false,
    };
    return detectTypeResult;
  }

  return francDetectTypeResult;
}

/**
 * Use franc to detect text language.
 * if franc detect language list contains preferred language && confidence > 0.5, use it and mark it as confirmed = true.
 * else use the first language in franc detect language list, and mark it as confirmed = false.
 *
 * ? the detectedLanguageId may be 'undefined'?
 */
function francDetectTextLangauge(text: string): LanguageDetectTypeResult {
  let detectedLanguageId = "und"; // 'und', language code that stands for undetermined
  let confirmed = false;

  // get all franc language id from languageItemList
  const onlyFrancLanguageIdList = languageItemList.map((item) => item.francLanguageId);
  const francDetectLanguageList = francAll(text, { minLength: 2, only: onlyFrancLanguageIdList });

  const detectedLanguageArray: [string, number][] = francDetectLanguageList.map((languageTuple) => {
    const [francLanguageId, confidence] = languageTuple;
    const youdaoLanguageId = getLanguageItemFromFrancId(francLanguageId).youdaoLanguageId;
    return [youdaoLanguageId, confidence];
  });
  console.log("detected language array:", detectedLanguageArray);

  // iterate francDetectLanguageList, if confidence > 0.5 and language is preferred language, use it
  for (const [languageId, confidence] of detectedLanguageArray) {
    if (confidence > francDetectConfirmedConfidence && isPreferredLanguage(languageId)) {
      console.log(`---> franc detect confirmed language: ${languageId}, confidence: ${confidence}`);
      detectedLanguageId = languageId; // ? may be 'und'?
      confirmed = true;
      break;
    }
  }

  // if no preferred language detected, use the first language in the detectLanguageIdList
  if (!confirmed) {
    [detectedLanguageId] = detectedLanguageArray[0];
  }

  const detectTypeResult: LanguageDetectTypeResult = {
    type: LanguageDetectType.Franc,
    youdaoLanguageId: detectedLanguageId,
    confirmed: confirmed,
    detectedLanguageArray: detectedLanguageArray,
  };

  return detectTypeResult;
}

/**
 * Get simple detect language id according to text, priority to use English and Chinese, and then auto.
 *
 * * NOTE: simple detect language, always set confirmed to false.
 */
export function simpleDetectTextLanguage(text: string): LanguageDetectTypeResult {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(text) && isPreferredLanguagesContainedEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isChinese(text) && isPreferredLanguagesContainedChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.log("simple detect language -->:", fromYoudaoLanguageId);
  const detectTypeResult = {
    type: LanguageDetectType.Simple,
    youdaoLanguageId: fromYoudaoLanguageId,
    confirmed: false,
  };
  return detectTypeResult;
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
