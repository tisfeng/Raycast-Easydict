/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { francAll } from "franc";
import { languageItemList } from "@/language/consts";
import { getLanguageItemFromFrancCode, getLanguageItemFromYoudaoCode } from "@/language/languages";
import { DetectedLangModel, LanguageDetectType } from "./types";
import { logTrace } from "@/devLog";
import { isPreferredLanguage } from "./utils";

/**
 * Use franc to detect text language.
 * if franc detect language list contains preferred language && confidence > confirmedConfidence, use it and mark it as confirmed = true.
 * else use the first language in franc detect language list, and mark it as confirmed = false.
 *
 * @confirmedConfidence the minimum confidence of franc detect language.
 *
 * @return detectedLanguageArray: All detected languages will recorded.
 * @reutn confirmed: Only mark confirmed = true when > confirmedConfidence && is preferred language.
 * @return detectedLanguageId: The first language id when language is confirmed. If not confirmed, it will be detectedLanguageArray[0].
 */
export function francLanguageDetect(text: string, confirmedConfidence = 0.8): DetectedLangModel {
  const startTime = new Date().getTime();
  logTrace("franc", `start franc detect: ${text}`);
  let detectedLanguageId = "auto"; // 'und', language code that stands for undetermined.
  let confirmed = false;

  // get all franc language id from languageItemList
  const onlyFrancLanguageIdList = languageItemList.map((item) => item.francLangCode);
  const francDetectLanguageList = francAll(text, { minLength: 2, only: onlyFrancLanguageIdList });
  logTrace("franc", `franc detect cost time: ${new Date().getTime() - startTime} ms`);

  const detectedYoudaoLanguageArray: [string, number][] = francDetectLanguageList.map((languageTuple) => {
    const [francLanguageId, confidence] = languageTuple;
    // * NOTE: when francLanguageId = 'und' or detected unsupported language, the youdaoLanguageId will be 'auto'
    const youdaoLanguageId = getLanguageItemFromFrancCode(francLanguageId).youdaoLangCode;
    return [youdaoLanguageId, confidence];
  });

  logTrace("franc", `franc detected language array: ${JSON.stringify(detectedYoudaoLanguageArray)}`);
  if (detectedYoudaoLanguageArray.length === 1) {
    logTrace("franc", `franc detected language: ${francDetectLanguageList[0]}`);
  }

  // iterate francDetectLanguageList, if confidence > confirmedConfidence and is preferred language, use it.
  for (const [languageId, confidence] of detectedYoudaoLanguageArray) {
    if (confidence > confirmedConfidence && isPreferredLanguage(languageId)) {
      logTrace(
        "franc",
        `franc detect confirmed language: ${languageId}, confidence: ${confidence} (>${confirmedConfidence})`,
      );
      detectedLanguageId = languageId;
      confirmed = true;
      break;
    }
  }

  // if not confirmed, use the first language in the detectLanguageIdList.
  if (!confirmed) {
    [detectedLanguageId] = detectedYoudaoLanguageArray[0];
  }

  const detectTypeResult: DetectedLangModel = {
    type: LanguageDetectType.Franc,
    sourceLangCode: getLanguageItemFromYoudaoCode(detectedLanguageId).francLangCode,
    youdaoLangCode: detectedLanguageId,
    confirmed: confirmed,
    detectedLanguageArray: detectedYoudaoLanguageArray,
  };

  return detectTypeResult;
}
