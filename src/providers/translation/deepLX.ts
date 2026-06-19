/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { type TargetLanguage, translate } from "@deeplx/core";

import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo, RequestErrorInfo } from "@/types/query";
import { getErrorMessage } from "@/utils/errors";
import { logError, logTrace } from "@/utils/logger";

/**
 * DeepLX translate API - Free DeepL translation using deeplx package
 * Cost time: ~0.5-1s
 *
 * Uses the unofficial but free DeepL API client
 * https://github.com/un-ts/deeplx
 */
export async function requestDeepLXTranslate(
  queryWordInfo: QueryWordInfo,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("deeplx", "start request DeepLX");
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const sourceLang = getLangCode(fromLanguage, "deepLSourceId");
  const targetLang = getLangCode(toLanguage, "deepLSourceId");

  const deepLXType = TranslationType.DeepLX;
  // if language is not supported, return null
  if (!sourceLang || !targetLang) {
    logTrace("deeplx", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
    const result: QueryTypeResult = {
      type: deepLXType,
      result: undefined,
      translations: [],
      queryWordInfo: queryWordInfo,
    };
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    const startTime = new Date().getTime();
    // `sourceLang` is guaranteed not to be 'auto', safe to cast to TargetLanguage
    translate(word, targetLang as TargetLanguage, sourceLang as TargetLanguage)
      .then((translatedText: string) => {
        const costTime = new Date().getTime() - startTime;
        logTrace("deeplx", `translate: ${translatedText}, cost: ${costTime} ms`);

        // Create a result object similar to DeepL API structure
        const deepLXResult = {
          translations: [
            {
              detected_source_language: sourceLang,
              text: translatedText,
            },
          ],
        };

        const deepLXTypeResult: QueryTypeResult = {
          type: TranslationType.DeepLX,
          result: deepLXResult,
          translations: translatedText.split("\n"),
          queryWordInfo: queryWordInfo,
        };
        resolve(deepLXTypeResult);
      })
      .catch((error: unknown) => {
        logError("deeplx", `translate error: ${error}`);

        const errorInfo: RequestErrorInfo = {
          type: deepLXType,
          code: error instanceof Error ? error.name : "unknown",
          message: getErrorMessage(error),
        };

        reject(errorInfo);
      });
  });
}
