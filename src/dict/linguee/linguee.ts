/*
 * @author: tisfeng
 * @createTime: 2022-07-24 17:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-16 15:51
 * @fileName: linguee.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from "axios";
import util from "util";
import { requestCostTime } from "../../axiosConfig";
import { userAgent } from "../../consts";
import { DicionaryType, RequestErrorInfo, RequestTypeResult } from "../../types";
import { QueryWordInfo } from "../youdao/types";
import { getLingueeWebDictionaryUrl, parseLingueeHTML } from "./parse";
import { LingueeDictionaryResult } from "./types";

export const lingueeRequestTimeKey = "lingueeRequestTimeKey";

/**
 * Get linguee dictionary result.
 *
 * eg. good: https://www.linguee.com/english-chinese/search?source=auto&query=good
 */
export async function rquestLingueeDictionary(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Linguee`);

  const lingueeUrl = getLingueeWebDictionaryUrl(queryWordInfo);
  console.log(`---> linguee url: ${lingueeUrl}`);
  if (!lingueeUrl) {
    const result: RequestTypeResult = {
      type: DicionaryType.Linguee,
      result: undefined,
      translations: [],
      wordInfo: queryWordInfo,
    };
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    // * avoid linguee's anti-spider, otherwise it will reponse very slowly or even error.
    const headers: AxiosRequestHeaders = {
      "User-Agent": userAgent,
      // accept: "*/*",
      // connection: "keep-alive",
      // withCredentials: true,
    };
    const config: AxiosRequestConfig = {
      headers: headers,
      responseType: "arraybuffer", // handle French content-type iso-8859-15
      signal: signal,
    };

    axios
      .get(lingueeUrl, config)
      .then((response) => {
        recordLingueeRequestTime();

        const contentType = response.headers["content-type"];
        const data: Buffer = response.data;
        const html = data.toString(contentType.includes("iso-8859-15") ? "latin1" : "utf-8");
        const lingueeTypeResult = parseLingueeHTML(html);
        console.warn(`---> linguee cost: ${response.headers[requestCostTime]} ms`);

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
          return;
        }
        console.error(`---> linguee error: ${error}`);

        // Request failed with status code 503, this means your ip is banned by linguee for a few hours.
        console.error(`---> request error: ${util.inspect(error.response, { depth: null })}`);

        let errorMessage = error.response?.statusText;
        const errorCode: number = error.response?.status;
        if (errorCode === 503) {
          errorMessage = "Your ip is banned by linguee for a few hours.";
          resetLingueeRequestTime();
        }
        const errorInfo: RequestErrorInfo = {
          type: DicionaryType.Linguee,
          code: errorCode.toString(),
          message: errorMessage,
        };
        reject(errorInfo);
      });
  });
}

/**
 * Record linguee reqeust times.
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
