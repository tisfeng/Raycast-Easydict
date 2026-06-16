/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import querystring from "node:querystring";

import { userAgent } from "@/consts";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getGoogleLangCode } from "@/language/languages";
import { QueryTypeResult, RequestErrorInfo, TranslationType } from "@/types";

console.log(`enter google.ts`);

export function requestGoogleTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
  console.log(`---> start request Google`);
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
  console.log(`start google web translate`);

  const fromLanguageId = getGoogleLangCode(queryWordInfo.fromLanguage);
  const toLanguageId = getGoogleLangCode(queryWordInfo.toLanguage);
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
  console.log(`---> google web url: ${url}`); // https://translate.google.com/m?sl=auto&tl=zh-CN&hl=zh-CN&q=good

  const config: AxiosRequestConfig = {
    headers,
    signal,
  };

  return new Promise((resolve, reject) => {
    axios
      .get(url, config)
      .then((res: AxiosResponse) => {
        const hmlt = res.data;
        const $ = cheerio.load(hmlt);

        // <div class="result-container">好的</div>
        const translation = $(".result-container").text();
        const translations = translation.split("\n");
        console.warn(`---> google web translation: ${translation}, cost: ${res.headers["requestCostTime"]} ms`);
        const result: QueryTypeResult = {
          type: TranslationType.Google,
          result: { translatedText: translation },
          translations: translations,
          queryWordInfo: queryWordInfo,
        };
        resolve(result);
      })
      .catch((error) => {
        if (error.message === "canceled") {
          console.log(`---> google web translate cancelled`);
          return reject(undefined);
        }
        console.error(`google web error: ${error}`);

        const errorInfo: RequestErrorInfo = {
          type: TranslationType.Google,
          message: "Google web translate error",
        };

        reject(errorInfo);

        // getSystemProxyURL();
      });
  });
}
