/*
 * @author: tisfeng
 * @createTime: 2022-06-24 17:07
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-09-14 17:33
 * @fileName: detect.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import { isValidLanguageId } from "../language/languages";
import { myPreferences } from "../preferences";
import { appleLanguageDetect } from "../scripts";
import { baiduWebLanguageDetect } from "../translation/baidu";
import { googleLanguageDetect } from "../translation/google";
import { tencentLanguageDetect } from "../translation/tencent";
import { RequestErrorInfo } from "../types";
import { francLangaugeDetect } from "./franc";
import { LanguageDetectType, LanguageDetectTypeResult } from "./types";
import {
  checkIfPreferredLanguagesContainChinese,
  checkIfPreferredLanguagesContainEnglish,
  isChinese,
  isEnglishOrNumber,
  isPreferredLanguage,
} from "./utils";

/**
 * Record all API detected language, if has detected two identical language id, use it.
 */
let apiDetectedLanguageList: LanguageDetectTypeResult[];

const defaultConfirmedConfidence = 0.8;

/**
 * Detect language with the given text, callback with LanguageDetectTypeResult.
 *
 * Prioritize the API language detection, if over time, try to use local language detection.
 *
 * Todo: use class to rewrite.
 */
export function detectLanguage(text: string): Promise<LanguageDetectTypeResult> {
  console.log(`start detectLanguage`);

  const localDetectResult = getLocalTextLanguageDetectResult(text, defaultConfirmedConfidence);
  apiDetectedLanguageList = [];

  return new Promise((resolve) => {
    // Covert text to lowercase, because Tencent LanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
    const lowerCaseText = text.toLowerCase();
    console.log("api detect queryText:", text);
    console.log("detect lowerCaseText:", lowerCaseText);

    // Action map: key is LanguageDetectType, value is Promise<LanguageDetectTypeResult>
    const detectActionMap = new Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>();
    // detectActionMap.set(LanguageDetectType.Baidu, baiduLanguageDetect(lowerCaseText));
    detectActionMap.set(LanguageDetectType.Baidu, baiduWebLanguageDetect(lowerCaseText));
    detectActionMap.set(LanguageDetectType.Tencent, tencentLanguageDetect(lowerCaseText));
    detectActionMap.set(LanguageDetectType.Google, googleLanguageDetect(lowerCaseText, axios.defaults.signal));

    if (myPreferences.enableAppleLanguageDetect) {
      detectActionMap.set(LanguageDetectType.Apple, appleLanguageDetect(lowerCaseText));
    }

    const detectActionList = [...detectActionMap.values()];

    raceDetectTextLanguage(detectActionList, localDetectResult).then((detectTypeResult) => {
      if (!detectTypeResult) {
        console.error(`use localDetectResult`);
        resolve(localDetectResult);
      } else {
        const finalLanguageTypeResult = getFinalDetectedLanguage(text, detectTypeResult, defaultConfirmedConfidence);
        resolve(finalLanguageTypeResult);
      }
    });
  });
}

/**
 * Promise race to detect language, if success, callback API detect language, else local detect language
 *
 * Todo: may be don't need to use promise race, callback is ok.
 */
function raceDetectTextLanguage(
  detectActionList: Promise<LanguageDetectTypeResult>[],
  localDetectResult: LanguageDetectTypeResult
): Promise<LanguageDetectTypeResult | undefined> {
  // console.log("race local detect language: ", localLanguageDetectTypeResult);

  return new Promise((resolve) => {
    for (const detectAction of detectActionList) {
      detectAction
        .then((detectTypeResult) => {
          if (!detectTypeResult) {
            console.error(`use localDetectResult`);
            resolve(localDetectResult);
            return;
          }

          handleDetectedLanguage(detectTypeResult).then((result) => {
            if (result) {
              resolve(result);
              return;
            }
          });
        })

        .catch((error) => {
          // If current API detect error, remove it from the detectActionMap, and try next detect API.
          const errorInfo = error as RequestErrorInfo | undefined;
          if (errorInfo) {
            console.error(`race detect language error: ${JSON.stringify(error, null, 4)}`); // error: {} ??
          }
        });
    }
  });
}

function handleDetectedLanguage(
  apiDetectedLanguage: LanguageDetectTypeResult
): Promise<LanguageDetectTypeResult | undefined> {
  console.log(`handleDetectedLanguageTypeResult: ${JSON.stringify(apiDetectedLanguage, null, 4)}`);

  const detectedLanguageId = apiDetectedLanguage.youdaoLanguageId;

  /**
   * 1. Preferred to use Google language detect, mark it as confirmed.
   *
   * Generally speaking, Google language detect is the most accurate, but it is too slow, it takes more than 1s.
   * So we have to try to use other types of language detection first.
   */
  if (apiDetectedLanguage.type === LanguageDetectType.Google && apiDetectedLanguage.sourceLanguageId.length > 0) {
    console.warn(`use Google detect language: ${apiDetectedLanguage.sourceLanguageId}`);
    apiDetectedLanguage.confirmed = true;
    return Promise.resolve(apiDetectedLanguage);
  }

  const baiduType = LanguageDetectType.Baidu;
  if (myPreferences.enableLanguageDetectionSpeedFirst) {
    if (
      apiDetectedLanguage.type === baiduType &&
      apiDetectedLanguage.confirmed &&
      isPreferredLanguage(detectedLanguageId)
    ) {
      console.warn(`---> Speed First, Baidu detected preferred and confirmed language`);
      console.warn(`detected language: ${JSON.stringify(apiDetectedLanguage, null, 4)}`);
      return Promise.resolve(apiDetectedLanguage);
    }
  }

  // 2. Iterate API detected language List, check if has detected >= `two` identical valid language, if true, use it.
  let count = 1;
  for (const language of apiDetectedLanguageList) {
    if (language.youdaoLanguageId === detectedLanguageId && isValidLanguageId(detectedLanguageId)) {
      count += 1;
    }

    // if detected two languages contain Baidu type && `preferred` language, use it.
    if (count === 2) {
      const containBaiduDetect = apiDetectedLanguage.type === baiduType || apiDetectedListContainsType(baiduType);
      if (containBaiduDetect && isPreferredLanguage(detectedLanguageId)) {
        apiDetectedLanguage.confirmed = true;
        console.warn(`---> two API contains Baidu language detected identical preferred language`);
        console.warn(`detected language: ${JSON.stringify(apiDetectedLanguage, null, 4)}`);
        return Promise.resolve(apiDetectedLanguage);
      }
    }

    if (count === 3) {
      language.confirmed = true;
      console.warn(`---> API detected three identical language`);
      console.warn(`detected language: ${JSON.stringify(language, null, 4)}`);
      return Promise.resolve(language);
    }
  }

  // If this API detected language is not confirmed, record it in the apiDetectedLanguage.
  apiDetectedLanguageList.push(apiDetectedLanguage);

  return Promise.resolve(undefined);
}

/**
 *  Get the final confirmed language type result, for handling some special case.
 *
 *  If detectTypeResult is confirmed, or is preferred language, use it directly, else use low confidence language.
 *
 *  This function is used when high confidence franc detect language is not confirmed, and API detect language catch error.
 */
function getFinalDetectedLanguage(
  text: string,
  detectedTypeResult: LanguageDetectTypeResult,
  confirmedConfidence: number
): LanguageDetectTypeResult {
  console.log(`start try get final detect language: ${JSON.stringify(detectedTypeResult, null, 4)}`);
  if (detectedTypeResult.confirmed || isPreferredLanguage(detectedTypeResult.youdaoLanguageId)) {
    return detectedTypeResult;
  }
  return getLocalTextLanguageDetectResult(text, confirmedConfidence);
}

/**
 *  Get local detect language result.
 *
 *  @confirmedConfidence if local detect preferred language confidence > confirmedConfidence, give priority to use it.
 *  * NOTE: Only preferred language confidence > confirmedConfidence will mark as confirmed.
 *
 *  First, if franc detect language is confirmed, use it directly.
 *  Second, if detect preferred language confidence > lowConfidence, use it, but not confirmed.
 *  Third, if franc detect language is valid, use it, but not confirmed.
 *  Finally, if simple detect language is preferred language, use it. else use "auto".
 *
 * * Todo: need to optimize.
 */
function getLocalTextLanguageDetectResult(
  text: string,
  confirmedConfidence: number,
  lowConfidence = 0.2
): LanguageDetectTypeResult {
  console.log(`start local detect language, confirmed confidence (>${confirmedConfidence})`);

  // if detect preferred language confidence > confirmedConfidence.
  const francDetectResult = francLangaugeDetect(text, confirmedConfidence);
  if (francDetectResult.confirmed) {
    return francDetectResult;
  }

  // if detect preferred language confidence > lowConfidence, use it, mark it as unconfirmed.
  const detectedLanguageArray = francDetectResult.detectedLanguageArray;
  if (detectedLanguageArray) {
    for (const [languageId, confidence] of detectedLanguageArray) {
      if (confidence > lowConfidence && isPreferredLanguage(languageId)) {
        console.log(
          `franc detect preferred but unconfirmed language: ${languageId}, confidence: ${confidence} (>${lowConfidence})`
        );
        const lowConfidenceDetectTypeResult: LanguageDetectTypeResult = {
          type: francDetectResult.type,
          sourceLanguageId: francDetectResult.sourceLanguageId,
          youdaoLanguageId: languageId,
          confirmed: false,
          detectedLanguageArray: francDetectResult.detectedLanguageArray,
        };
        return lowConfidenceDetectTypeResult;
      }
    }
  }

  // if franc detect language is valid, use it, such as 'fr', 'it'.
  const youdaoLanguageId = francDetectResult.youdaoLanguageId;
  if (isValidLanguageId(youdaoLanguageId)) {
    console.log(`final use franc unconfirmed but valid detect: ${youdaoLanguageId}`);
    return francDetectResult;
  }

  // if simple detect is preferred language, use simple detect language('en', 'zh').
  const simpleDetectLangTypeResult = simpleDetectTextLanguage(text);
  if (isPreferredLanguage(simpleDetectLangTypeResult.youdaoLanguageId)) {
    console.log(`use simple detect: ${JSON.stringify(simpleDetectLangTypeResult, null, 4)}`);
    return simpleDetectLangTypeResult;
  }

  // finally, use "auto" as fallback.
  console.log(`final use auto`);
  const finalAutoLanguageTypeResult: LanguageDetectTypeResult = {
    type: LanguageDetectType.Simple,
    sourceLanguageId: "",
    youdaoLanguageId: "auto",
    confirmed: false,
  };
  return finalAutoLanguageTypeResult;
}

/**
 * Get simple detect language id according to text, priority to use English and Chinese, and then auto.
 *
 * * NOTE: simple detect language, always set confirmed = false.
 */
export function simpleDetectTextLanguage(text: string): LanguageDetectTypeResult {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(text) && checkIfPreferredLanguagesContainEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isChinese(text) && checkIfPreferredLanguagesContainChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.log("simple detect language -->:", fromYoudaoLanguageId);
  const detectTypeResult = {
    type: LanguageDetectType.Simple,
    sourceLanguageId: fromYoudaoLanguageId,
    youdaoLanguageId: fromYoudaoLanguageId,
    confirmed: false,
  };
  return detectTypeResult;
}

function apiDetectedListContainsType(detectedLanguagetype: LanguageDetectType): boolean {
  // console.log(`check if api detected list contains type: ${detectedLanguagetype}`);
  // console.log(`api detected list: ${JSON.stringify(apiDetectedLanguageList, null, 4)}`);
  const isContained = apiDetectedLanguageList.find((item) => item.type === detectedLanguagetype);
  // console.log(`is contained: ${isContained}`);
  return isContained !== undefined;
}
