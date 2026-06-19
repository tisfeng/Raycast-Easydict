/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import { RawResponse } from "@vitalets/google-translate-api/dist/cjs/types";

import { userAgent } from "@/constants";
import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo, RequestErrorInfo } from "@/types/query";
import { getErrorMessage, getErrorName } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

export type GoogleTranslateResult = {
  text: string;
  raw: RawResponse;
};

logTrace("google", "module loaded");

export function requestGoogleTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
  logTrace("google", "start request Google");
  // return googleRPCTranslate(queryWordInfo, signal);
  return googleWebTranslate(queryWordInfo, signal);
}

/**
 * Use crawler to get google web translate. Only simple translate result.
 *
 * * Note: max translated text length should <= 1830
 * * Otherwise will throw error: "400. That’s an error. Your client has issued a malformed or illegal request. That’s all we know."
 *
 * From https://github.com/roojay520/bobplugin-google-translate/blob/master/src/google-translate-mobile.ts
 * Another wild google translate api: http://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&sl=auto&tl=zh_TW&q=good
 */
export async function googleWebTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
  logTrace("google", "start google web translate");

  const fromLanguageId = getLangCode(queryWordInfo.fromLanguage, "googleLangCode");
  const toLanguageId = getLangCode(queryWordInfo.toLanguage, "googleLangCode");
  const data = {
    sl: fromLanguageId, // source language
    tl: toLanguageId, // target language
    hl: toLanguageId, // hope language? web ui language
    q: queryWordInfo.word, // query word
  };

  const headers = {
    "User-Agent": userAgent,
  };
  const url = `https://translate.google.com/m?${querystring.stringify(data)}`;
  logTrace("google", `web url: ${url}`); // https://translate.google.com/m?sl=auto&tl=zh-CN&hl=zh-CN&q=good

  return timedFetch(url, {
    headers,
    signal,
    responseType: "text",
  })
    .then((html) => {
      // <div class="result-container">好的</div>
      const match = html.match(/<div class="result-container">(.*?)<\/div>/s);
      const translation = match?.[1]?.trim() ?? "";
      const translations = translation.split("\n");
      logTrace("google", `web translation: ${translation}`);
      const result: QueryTypeResult = {
        type: TranslationType.Google,
        result: { translatedText: translation },
        translations: translations,
        queryWordInfo: queryWordInfo,
      };
      return result;
    })
    .catch((error) => {
      if (getErrorName(error) === "AbortError" || getErrorMessage(error) === "canceled") {
        logTrace("google", "canceled");
        throw undefined;
      }
      const errorMessage = getErrorMessage(error);
      logError("google", `web error: ${errorMessage}`);

      const errorInfo: RequestErrorInfo = {
        type: TranslationType.Google,
        message: errorMessage,
      };

      throw errorInfo;
    });
}
