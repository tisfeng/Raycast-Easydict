/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import { getLangCode } from "@/core/language/utils";
import { AppKeyStore } from "@/preferences";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo, RequestErrorInfo } from "@/types/query";
import { getTypeErrorInfo } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

export interface DeepLTranslateResult {
  translations: DeepLTranslationItem[];
}

export interface DeepLTranslationItem {
  detected_source_language: string;
  text: string;
}

/**
 * DeepL translate API. Cost time: > 1s
 *
 * https://www.deepl.com/zh/docs-api/translating-text
 */
export async function requestDeepLTranslate(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("deepl", "start request DeepL");
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const sourceLang = getLangCode(fromLanguage, "deepLSourceId");
  const targetLang = getLangCode(toLanguage, "deepLSourceId");

  const deepLType = TranslationType.DeepL;

  // if language is not supported, return null
  if (!sourceLang || !targetLang) {
    logTrace("deepl", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
    const result: QueryTypeResult = {
      type: deepLType,
      result: undefined,
      translations: [],
      queryWordInfo: queryWordInfo,
    };
    return Promise.resolve(result);
  }

  const deepLAuthKey = AppKeyStore.deepLAuthKey;

  const errorInfo: RequestErrorInfo = {
    type: deepLType,
    code: "",
    message: "Error",
  };

  if (!deepLAuthKey) {
    errorInfo.message = "No deepL key";
    return Promise.reject(errorInfo);
  }

  // * deepL api free and deepL pro api use different url host.
  let url = deepLAuthKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const deepLEndpoint = AppKeyStore.deepLEndpoint;
  if (deepLEndpoint.length > 0) {
    url = deepLEndpoint;
  }

  const params = {
    text: word,
    source_lang: sourceLang,
    target_lang: targetLang,
  };

  return new Promise((resolve, reject) => {
    timedFetch(url, {
      method: "POST",
      body: querystring.stringify(params),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `DeepL-Auth-Key ${deepLAuthKey}`,
      },
      signal,
    })
      .then((response: DeepLTranslateResult) => {
        const deepLResult = response;
        const translatedText = deepLResult.translations[0].text;
        logTrace("deepl", `translate: ${translatedText}`);

        const deepLTypeResult: QueryTypeResult = {
          type: TranslationType.DeepL,
          result: deepLResult,
          translations: translatedText.split("\n"),
          queryWordInfo: queryWordInfo,
        };
        resolve(deepLTypeResult);
      })
      .catch((error) => {
        if (error.message === "canceled" || error.name === "AbortError") {
          logTrace("deepl", "canceled");
          return reject(undefined);
        }

        logError("deepl", `error: ${error}`);

        const errorInfo = getTypeErrorInfo(TranslationType.DeepL, error);
        const errorCode = error.status;

        // https://www.deepl.com/zh/docs-api/api-access/error-handling/
        if (errorCode === 456) {
          errorInfo.message = "Quota exceeded"; // Quota exceeded. The character limit has been reached.
        } else if (errorCode === 403) {
          errorInfo.message = "Authorization failed"; // Authorization failed. Please supply a valid auth_key parameter.
        }

        logError("deepl", `error info: ${JSON.stringify(errorInfo)}`); // message: 'timeout of 15000ms exceeded'
        reject(errorInfo);
      });
  });
}
