/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import { config } from "@/core/config";
import { autoDetectLanguageItem, chineseLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { isValidLangCode } from "@/core/language/utils";
import type { BaseDetectProvider } from "@/providers/detect/base";
import { detectServices } from "@/providers/detect/registry";
import { LanguageDetectType } from "@/types/api";
import type { RequestError } from "@/utils/errors";
import { logError, logTrace, logWarn } from "@/utils/logger";

import type { DetectedLangModel } from "./types";
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
let apiDetectedLanguageList: DetectedLangModel[];

const defaultConfirmedConfidence = 0.8;

let hasDetectFinished = false;

let apiDetectors: BaseDetectProvider[] | null = null;
let localDetectors: BaseDetectProvider[] | null = null;

function initDetectors() {
  const enabled = detectServices.map((c) => new c.provider()).filter((p) => p.isEnabled());
  apiDetectors = enabled.filter((p) => !p.isLocal);
  localDetectors = enabled.filter((p) => p.isLocal);
}

/**
 * given text, callback with LanguageDetectTypeResult.
 *
 * Prioritize the API language detection, if over time, try to use local language detection.
 */
export async function detectLanguage(text: string): Promise<DetectedLangModel> {
  logTrace("Detect", "start detectLanguage");

  apiDetectedLanguageList = [];

  // Covert text to lowercase, because Tencent LanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
  const lowerCaseText = text.toLowerCase();
  logTrace("Detect", `api detect queryText: ${text}`);
  logTrace("Detect", `detect lowerCaseText: ${lowerCaseText}`);

  const detectedLanguage = await raceDetectTextLanguage(lowerCaseText);
  return await getFinalDetectedLanguage(text, detectedLanguage, defaultConfirmedConfidence);
}

/**
 * Get enabled API detect providers from the registry.
 */
function getDetectAPIs(): Array<(text: string) => Promise<DetectedLangModel>> {
  initDetectors();
  return apiDetectors!.map((provider) => provider.detect);
}

/**
 * Race to detect language, if success, callback API detect language, else local detect language
 */
function raceDetectTextLanguage(lowerCaseText: string): Promise<DetectedLangModel | undefined> {
  logTrace("Detect", "start raceDetectLanguage");
  const detectActionList = getDetectAPIs().map((detect) => detect(lowerCaseText));

  hasDetectFinished = false;
  let detectCount = 0;

  return new Promise((resolve) => {
    detectActionList.forEach((detectAction) => {
      detectAction
        .then((detectedLang) => {
          logTrace("Detect", `detectAction success: ${detectedLang.type}`);
          handleDetectedLanguage(detectedLang).then((result) => {
            if (result) {
              hasDetectFinished = true;
              resolve(result);
            }
          });
        })
        .catch((error) => {
          // If current API detect error, do nothing, just continue try next API.
          const errorInfo = error as RequestError | undefined;
          if (!errorInfo) {
            logTrace("Detect", "detect cancelled");
          } else {
            logError("Detect", `race detect language error: ${JSON.stringify(error, null, 4)}`);
          }
        })
        .finally(() => {
          detectCount += 1;
          // If the last detection action is still not resolve, return undefined.
          if (detectCount === detectActionList.length && !hasDetectFinished) {
            logWarn("Detect", "last detect action fail, return undefine");
            resolve(undefined);
          }
        });
    });
  });
}

/**
 * Handle detected language.
 */
function handleDetectedLanguage(detectedLangModel: DetectedLangModel): Promise<DetectedLangModel | undefined> {
  return new Promise((resolve) => {
    if (hasDetectFinished) {
      logTrace("Detect", "detect has finished, return");
      return resolve(undefined);
    }

    logTrace("Detect", `handleDetectedLanguage: ${JSON.stringify(detectedLangModel)}`);

    // Record it in the apiDetectedLanguage.
    apiDetectedLanguageList.push(detectedLangModel);
    const detectedLangCode = detectedLangModel.youdaoLangCode;

    /**
     * 1. Preferred to use Google language detect, mark it as confirmed.
     *
     * Generally speaking, Google language detect is the most accurate, but it is too slow, it takes more than 1s.
     * So we have to try to use other types of language detection first.
     */
    if (detectedLangModel.type === LanguageDetectType.Google && detectedLangModel.sourceLangCode.length > 0) {
      logTrace("Detect", `using Google detect: ${detectedLangModel.sourceLangCode}`);
      detectedLangModel.confirmed = true;
      return resolve(detectedLangModel);
    }

    // Detected language must be valid language.
    if (!isValidLangCode(detectedLangCode)) {
      return resolve(undefined);
    }
    // 2. Iterate API detected language List, check if has detected >= `two` identical valid language.
    const detectedIdenticalLanguages: DetectedLangModel[] = [];
    const detectedTypes: string[] = [];
    logTrace("Detect", `detectedLangCode: ${detectedLangCode}, detectedList: ${apiDetectedLanguageList.length}`);

    for (const lang of apiDetectedLanguageList) {
      if (lang.youdaoLangCode === detectedLangCode) {
        logTrace("Detect", `detected push: ${lang.type}`);
        detectedIdenticalLanguages.push(lang);
        detectedTypes.push(lang.type.toString().split(" ")[0]);
      }

      // If enabled speed first, and API detected two `preferred` language, try to use it.
      // Perf: To speed up language detection, we use the first detected && preferred language.
      if (detectedIdenticalLanguages.length === 1) {
        // Mark two identical language as prior.
        detectedLangModel.prior = true;

        const onlyOneDetectService = apiDetectors!.length === 1;

        if (onlyOneDetectService || (isPreferredLanguage(detectedLangCode) && config.enableDetectLanguageSpeedFirst)) {
          detectedLangModel.confirmed = true;
          logTrace("Detect", `speed first, detected: ${detectedTypes}`);
          return resolve(detectedLangModel);
        }
      }

      if (detectedIdenticalLanguages.length >= 2) {
        detectedLangModel.confirmed = true;
        logTrace("Detect", `>=2 identical languages detected`);
        return resolve(detectedLangModel);
      }
    }

    logTrace(
      "Detect",
      `type: '${detectedLangModel.type}' detected '${detectedLangCode}' is not confirmed, continue next`,
    );
    return resolve(undefined);
  });
}

/**
 * Get the final confirmed language, for handling some special case.
 *
 * 1. If detect language is confirmed, use it directly.
 * 2. Try to use the most accurate language in apiDetectedLanguageList.
 * 3. If all language detect failed, use local detect language.
 */
async function getFinalDetectedLanguage(
  text: string,
  detectedLangModel: DetectedLangModel | undefined,
  confirmedConfidence: number,
): Promise<DetectedLangModel> {
  logTrace("Detect", `start try get final detect: ${JSON.stringify(detectedLangModel)}`);
  if (detectedLangModel && detectedLangModel.confirmed) {
    return detectedLangModel;
  }

  const finalDetectedLang = handleFinalDetectedLangFromAPIList(apiDetectedLanguageList);
  if (finalDetectedLang) {
    logTrace("Detect", `use final detected language from API list: ${JSON.stringify(finalDetectedLang)}`);
    return finalDetectedLang;
  }

  return await getLocalTextLanguageDetectResult(text, confirmedConfidence);
}

/**
 * Handle final detected language from API list, return the most accurate language.
 */
function handleFinalDetectedLangFromAPIList(
  apiDetectedLanguageList: DetectedLangModel[],
): DetectedLangModel | undefined {
  logTrace("Detect", "handleFinalDetectedLangFromAPIList");

  // If only one detected language, return it.
  if (apiDetectedLanguageList.length === 1) {
    logTrace("Detect", "only one detected language, return it");
    return apiDetectedLanguageList[0];
  }

  // If prior is true, return it.
  const priorDetectedLang = apiDetectedLanguageList.find((lang) => lang.prior);
  if (priorDetectedLang) {
    logTrace("Detect", "prior detected language, return it");
    return priorDetectedLang;
  }

  // If Baidu detected language is valid, return it.
  const baiduDetectedLang = apiDetectedLanguageList.find((lang) => lang.type === LanguageDetectType.Baidu);
  if (baiduDetectedLang && isValidLangCode(baiduDetectedLang.youdaoLangCode)) {
    logTrace("Detect", "Baidu detected language is valid, return it");
    return baiduDetectedLang;
  }

  // If Bing detected language, return it.
  for (const lang of apiDetectedLanguageList) {
    if (lang.type === LanguageDetectType.Bing) {
      logTrace("Detect", "Bing detected language, return it");
      return lang;
    }
  }

  logTrace("Detect", "no detected language, return undefined");
  return undefined;
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
 */
async function getLocalTextLanguageDetectResult(
  text: string,
  confirmedConfidence: number,
  lowConfidence = 0.2,
): Promise<DetectedLangModel> {
  logTrace("Detect", `local detect, confidence >${confirmedConfidence}`);

  initDetectors();

  if (localDetectors && localDetectors.length > 0) {
    const localProvider = localDetectors[0];
    try {
      const localDetectResult = await localProvider.detect(text, { confirmedConfidence });
      if (localDetectResult.confirmed) {
        return localDetectResult;
      }

      // if detect preferred language confidence > lowConfidence, use it, mark it as unconfirmed.
      const detectedLanguageArray = localDetectResult.detectedLanguageArray;
      if (detectedLanguageArray) {
        for (const [languageId, confidence] of detectedLanguageArray) {
          if (confidence > lowConfidence && isPreferredLanguage(languageId)) {
            logTrace(
              "Detect",
              `local detect preferred but unconfirmed language: ${languageId}, confidence: ${confidence} (>${lowConfidence})`,
            );
            const lowConfidenceDetect: DetectedLangModel = {
              type: localDetectResult.type,
              sourceLangCode: localDetectResult.sourceLangCode,
              youdaoLangCode: languageId,
              confirmed: false,
              detectedLanguageArray: localDetectResult.detectedLanguageArray,
            };
            return lowConfidenceDetect;
          }
        }
      }

      // if local detect language is valid, use it, such as 'fr', 'it'.
      const youdaoLangCode = localDetectResult.youdaoLangCode;
      if (isValidLangCode(youdaoLangCode)) {
        logTrace("Detect", `final use local unconfirmed but valid detect: ${youdaoLangCode}`);
        return localDetectResult;
      }
    } catch (error) {
      logError("Detect", `local detect error: ${error}`);
    }
  }

  // if simple detect is preferred language, use simple detect language('en', 'zh').
  const simpleDetectLangTypeResult = simpleDetectTextLanguage(text);
  if (isPreferredLanguage(simpleDetectLangTypeResult.youdaoLangCode)) {
    logTrace("Detect", `use simple detect: ${JSON.stringify(simpleDetectLangTypeResult, null, 4)}`);
    return simpleDetectLangTypeResult;
  }

  // finally, use "auto" as fallback.
  logTrace("Detect", "final use auto");
  const finalAutoLanguageTypeResult: DetectedLangModel = {
    type: LanguageDetectType.Simple,
    sourceLangCode: "",
    youdaoLangCode: "auto",
    confirmed: false,
  };
  return finalAutoLanguageTypeResult;
}

/**
 * Get simple detect language id according to text, priority to use English and Chinese, and then auto.
 *
 * * NOTE: simple detect language, always set confirmed = false.
 */
function simpleDetectTextLanguage(text: string): DetectedLangModel {
  let fromYoudaoLangCode = autoDetectLanguageItem.youdaoLangCode;
  if (isEnglishOrNumber(text) && checkIfPreferredLanguagesContainEnglish()) {
    fromYoudaoLangCode = englishLanguageItem.youdaoLangCode;
  } else if (isChinese(text) && checkIfPreferredLanguagesContainChinese()) {
    fromYoudaoLangCode = chineseLanguageItem.youdaoLangCode;
  }
  logTrace("Detect", `simple detect language -->: ${fromYoudaoLangCode}`);
  const detectTypeResult: DetectedLangModel = {
    type: LanguageDetectType.Simple,
    sourceLangCode: fromYoudaoLangCode,
    youdaoLangCode: fromYoudaoLangCode,
    confirmed: false,
  };
  return detectTypeResult;
}
