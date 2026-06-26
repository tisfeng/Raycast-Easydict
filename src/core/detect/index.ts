/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import { config } from "@/core/config";
import { autoDetectLanguageItem, chineseLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { isValidLangCode } from "@/core/language/utils";
import type { BaseDetectProvider, DetectOptions } from "@/providers/detect/base";
import { detectServices } from "@/providers/detect/registry";
import { LanguageDetectType } from "@/types/api";
import type { RequestError } from "@/utils/errors";
import { logError, logSummary, logTrace, logWarn } from "@/utils/logger";

import type { DetectedLangModel } from "./types";
import {
  checkIfPreferredLanguagesContainChinese,
  checkIfPreferredLanguagesContainEnglish,
  isChinese,
  isEnglishOrNumber,
  isPreferredLanguage,
} from "./utils";

interface DetectContext {
  apiDetectedLanguageList: DetectedLangModel[];
  hasDetectFinished: boolean;
  signal?: AbortSignal;
}

const defaultConfirmedConfidence = 0.8;

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
export async function detectLanguage(text: string, signal?: AbortSignal): Promise<DetectedLangModel> {
  const ctx: DetectContext = { apiDetectedLanguageList: [], hasDetectFinished: false, signal };

  // Covert text to lowercase, because Tencent LanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
  const lowerCaseText = text.toLowerCase();

  const startTime = performance.now();
  const detectedLanguage = await raceDetectTextLanguage(lowerCaseText, ctx);
  const result = await getFinalDetectedLanguage(text, detectedLanguage, defaultConfirmedConfidence, ctx);
  const duration = (performance.now() - startTime).toFixed(0);

  const source =
    result.type === LanguageDetectType.Simple || result.type === LanguageDetectType.Franc
      ? `local:${result.type}`
      : result.type.toString();
  const confirmed = result.confirmed ? "confirmed" : "unconfirmed";
  logSummary("Detect", `${result.youdaoLangCode} (${source}, ${duration}ms, ${confirmed})`);

  return result;
}

/**
 * Get enabled API detect providers from the registry.
 */
function getDetectAPIs(signal?: AbortSignal): Array<(text: string) => Promise<DetectedLangModel>> {
  initDetectors();
  const opts: DetectOptions = { signal };
  return apiDetectors!.map((provider) => (text: string) => provider.detect(text, opts));
}

/**
 * Race to detect language, if success, callback API detect language, else local detect language
 */
function raceDetectTextLanguage(lowerCaseText: string, ctx: DetectContext): Promise<DetectedLangModel | undefined> {
  const detectActionList = getDetectAPIs(ctx.signal).map((detect) => detect(lowerCaseText));

  ctx.hasDetectFinished = false;
  let detectCount = 0;

  return new Promise((resolve) => {
    detectActionList.forEach((detectAction) => {
      detectAction
        .then((detectedLang) => {
          handleDetectedLanguage(detectedLang, ctx).then((result) => {
            if (result) {
              ctx.hasDetectFinished = true;
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
            logError("Detect", `race detect error`, error);
          }
        })
        .finally(() => {
          detectCount += 1;
          // If the last detection action is still not resolve, return undefined.
          if (detectCount === detectActionList.length && !ctx.hasDetectFinished) {
            logWarn("Detect", "all detect actions failed");
            resolve(undefined);
          }
        });
    });
  });
}

/**
 * Handle detected language.
 */
function handleDetectedLanguage(
  detectedLangModel: DetectedLangModel,
  ctx: DetectContext,
): Promise<DetectedLangModel | undefined> {
  return new Promise((resolve) => {
    if (ctx.hasDetectFinished) {
      return resolve(undefined);
    }

    // Record it in the apiDetectedLanguage.
    ctx.apiDetectedLanguageList.push(detectedLangModel);
    const detectedLangCode = detectedLangModel.youdaoLangCode;

    /**
     * 1. Preferred to use Google language detect, mark it as confirmed.
     *
     * Generally speaking, Google language detect is the most accurate, but it is too slow, it takes more than 1s.
     * So we have to try to use other types of language detection first.
     */
    if (detectedLangModel.type === LanguageDetectType.Google && detectedLangModel.sourceLangCode.length > 0) {
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

    for (const lang of ctx.apiDetectedLanguageList) {
      if (lang.youdaoLangCode === detectedLangCode) {
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
          return resolve(detectedLangModel);
        }
      }

      if (detectedIdenticalLanguages.length >= 2) {
        detectedLangModel.confirmed = true;
        return resolve(detectedLangModel);
      }
    }

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
  ctx: DetectContext,
): Promise<DetectedLangModel> {
  if (detectedLangModel && detectedLangModel.confirmed) {
    return detectedLangModel;
  }

  const finalDetectedLang = handleFinalDetectedLangFromAPIList(ctx.apiDetectedLanguageList);
  if (finalDetectedLang) {
    return finalDetectedLang;
  }

  return await getLocalTextLanguageDetectResult(text, confirmedConfidence, ctx.signal);
}

/**
 * Handle final detected language from API list, return the most accurate language.
 */
function handleFinalDetectedLangFromAPIList(
  apiDetectedLanguageList: DetectedLangModel[],
): DetectedLangModel | undefined {
  // If only one detected language, return it.
  if (apiDetectedLanguageList.length === 1) {
    return apiDetectedLanguageList[0];
  }

  // If prior is true, return it.
  const priorDetectedLang = apiDetectedLanguageList.find((lang) => lang.prior);
  if (priorDetectedLang) {
    return priorDetectedLang;
  }

  // If Baidu detected language is valid, return it.
  const baiduDetectedLang = apiDetectedLanguageList.find((lang) => lang.type === LanguageDetectType.Baidu);
  if (baiduDetectedLang && isValidLangCode(baiduDetectedLang.youdaoLangCode)) {
    return baiduDetectedLang;
  }

  // If Bing detected language, return it.
  for (const lang of apiDetectedLanguageList) {
    if (lang.type === LanguageDetectType.Bing) {
      return lang;
    }
  }

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
  signal?: AbortSignal,
  lowConfidence = 0.2,
): Promise<DetectedLangModel> {
  initDetectors();

  if (localDetectors && localDetectors.length > 0) {
    const localProvider = localDetectors[0];
    try {
      const localDetectResult = await localProvider.detect(text, { confirmedConfidence, signal });
      if (localDetectResult.confirmed) {
        return localDetectResult;
      }

      // if detect preferred language confidence > lowConfidence, use it, mark it as unconfirmed.
      const detectedLanguageArray = localDetectResult.detectedLanguageArray;
      if (detectedLanguageArray) {
        for (const [languageId, confidence] of detectedLanguageArray) {
          if (confidence > lowConfidence && isPreferredLanguage(languageId)) {
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
        return localDetectResult;
      }
    } catch (error) {
      logError("Detect", "local detect error", error);
    }
  }

  // if simple detect is preferred language, use simple detect language('en', 'zh').
  const simpleDetectLangTypeResult = simpleDetectTextLanguage(text);
  if (isPreferredLanguage(simpleDetectLangTypeResult.youdaoLangCode)) {
    return simpleDetectLangTypeResult;
  }

  // finally, use "auto" as fallback.
  return {
    type: LanguageDetectType.Simple,
    sourceLangCode: "",
    youdaoLangCode: "auto",
    confirmed: false,
  };
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
  return {
    type: LanguageDetectType.Simple,
    sourceLangCode: fromYoudaoLangCode,
    youdaoLangCode: fromYoudaoLangCode,
    confirmed: false,
  };
}
