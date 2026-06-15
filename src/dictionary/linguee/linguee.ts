/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";
import { timedFetch } from "@/fetchConfig";
import { userAgent } from "@/consts";
import { DictionaryType, QueryTypeResult } from "@/types";
import { getTypeErrorInfo } from "@/utils";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getLingueeWebDictionaryURL, parseLingueeHTML } from "@/dictionary/linguee/parse";
import { LingueeDictionaryResult } from "@/dictionary/linguee/types";

export const lingueeRequestTimeKey = "lingueeRequestTimeKey";

/**
 * Get linguee dictionary result. cost time: > 2s.
 *
 * eg. good: https://www.linguee.com/english-chinese/search?source=auto&query=good
 */
export async function requestLingueeDictionary(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  console.log(`---> start request Linguee`);

  const lingueeUrl = getLingueeWebDictionaryURL(queryWordInfo);
  console.log(`---> linguee url: ${lingueeUrl}`);
  if (!lingueeUrl) {
    const result: QueryTypeResult = {
      type: DictionaryType.Linguee,
      result: undefined,
      translations: [],
      queryWordInfo: queryWordInfo,
    };
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    timedFetch
      .native(lingueeUrl, {
        headers: { "User-Agent": userAgent },
        signal,
      })
      .then(async (response) => {
        recordLingueeRequestTime();

        const contentType = response.headers.get("content-type");
        const arrayBuffer = await response.arrayBuffer();
        const data = Buffer.from(arrayBuffer);
        const html = data.toString(
          typeof contentType === "string" && contentType.includes("iso-8859-15") ? "latin1" : "utf-8",
        );
        const lingueeTypeResult = parseLingueeHTML(html);

        /**
         * Generally, the language of the queryWordInfo is the language of the dictionary result.
         * But sometimes, linguee detect language may be wrong when word item is empty, so we use queryWordInfo language.
         * eg. sql, auto detect is chinese -> english.
         */
        const lingueeDictionaryResult = lingueeTypeResult.result as LingueeDictionaryResult;
        if (lingueeDictionaryResult && lingueeDictionaryResult.wordItems.length === 0) {
          const wordInfo = lingueeDictionaryResult.queryWordInfo;
          lingueeDictionaryResult.queryWordInfo = {
            ...wordInfo,
            word: queryWordInfo.word,
            fromLanguage: queryWordInfo.fromLanguage,
            toLanguage: queryWordInfo.toLanguage,
          };
        }
        resolve(lingueeTypeResult);
      })
      .catch((error) => {
        if (error.message === "canceled") {
          console.log(`---> linguee canceled`);
          return reject(undefined);
        }
        console.error(`---> linguee error: ${error}`);

        const errorInfo = getTypeErrorInfo(DictionaryType.Linguee, error);
        if (error.status === 503) {
          errorInfo.message = "Your ip is banned by linguee for a few hours. Please try to use proxy.";
          resetLingueeRequestTime();
        }
        reject(errorInfo);
      });
  });
}

/**
 * Record linguee request times.
 */
async function recordLingueeRequestTime() {
  const lingueeRequestTime = (await LocalStorage.getItem<number>(lingueeRequestTimeKey)) || 1;
  console.log(`---> linguee has requested times: ${lingueeRequestTime}`);
  LocalStorage.setItem(lingueeRequestTimeKey, lingueeRequestTime + 1);
}
/**
 * Reset linguee request times.
 */
export async function resetLingueeRequestTime() {
  LocalStorage.setItem(lingueeRequestTimeKey, 0);
}
