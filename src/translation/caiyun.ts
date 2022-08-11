/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-10 23:03
 * @fileName: caiyun.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import { requestCostTime } from "../axiosConfig";
import { QueryWordInfo } from "../dict/youdao/types";
import { getLanguageItemFromYoudaoId } from "../language/languages";
import { KeyStore } from "../preferences";
import { CaiyunTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";

/**
 * 彩云小译
 * Docs: https://open.caiyunapp.com/%E4%BA%94%E5%88%86%E9%92%9F%E5%AD%A6%E4%BC%9A%E5%BD%A9%E4%BA%91%E5%B0%8F%E8%AF%91_API
 */
export function requestCaiyunTextTranslate(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Caiyun`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;

  const url = "https://api.interpreter.caiyunai.com/v1/translator";
  const from = getLanguageItemFromYoudaoId(fromLanguage).caiyunLanguageId || "auto";
  const to = getLanguageItemFromYoudaoId(toLanguage).caiyunLanguageId;
  const trans_type = `${from}2${to}`; // "auto2xx";

  // Note that Caiyun Translate only supports these types of translation at present.
  const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
  if (!supportedTranslatType.includes(trans_type)) {
    console.log(`Caiyun translate not support language: ${fromLanguage} --> ${toLanguage}`);
    return Promise.resolve({
      type: TranslationType.Caiyun,
      result: undefined,
      translations: [],
    });
  }
  const params = {
    source: word.split("\n"), // source can be text or array. if source is an array, it will be translated in parallel
    trans_type,
    detect: from === "auto",
  };
  // console.log(`---> Caiyun params: ${JSON.stringify(params, null, 4)}`);
  const config = {
    headers: {
      "content-type": "application/json",
      "x-authorization": "token " + KeyStore.caiyunToken,
    },
    signal,
  };
  return new Promise((resolve, reject) => {
    axios
      .post(url, params, config)
      .then((response) => {
        const caiyunResult = response.data as CaiyunTranslateResult;
        const translations = caiyunResult.target;
        console.log(`caiyun translate: ${translations}, cost: ${response.headers[requestCostTime]} ms`);
        resolve({
          type: TranslationType.Caiyun,
          result: caiyunResult,
          translations: translations,
        });
      })
      .catch((error) => {
        console.error(`---> caiyun translate error: ${error}`);

        if (error.message === "canceled") {
          console.log(`---> caiyun cancelled`);
          return;
        }

        const errorInfo: RequestErrorInfo = {
          type: TranslationType.Caiyun,
          code: error.response?.status.toString(),
          message: error.response?.statusText,
        };
        reject(errorInfo);
        console.error("caiyun error response: ", error.response);
      });
  });
}
