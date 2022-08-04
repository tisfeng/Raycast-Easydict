/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-04 17:45
 * @fileName: caiyun.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import { requestCostTime } from "../axiosConfig";
import { caiyunToken } from "../crypto";
import { CaiyunTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";
import { getLanguageItemFromYoudaoId } from "../utils";

/**
 * 彩云小译
 * Docs: https://open.caiyunapp.com/%E4%BA%94%E5%88%86%E9%92%9F%E5%AD%A6%E4%BC%9A%E5%BD%A9%E4%BA%91%E5%B0%8F%E8%AF%91_API
 */
export function requestCaiyunTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  console.log(`---> start request Caiyun`);
  const url = "https://api.interpreter.caiyunai.com/v1/translator";
  const from = getLanguageItemFromYoudaoId(fromLanguage).caiyunLanguageId || "auto";
  const to = getLanguageItemFromYoudaoId(targetLanguage).caiyunLanguageId;
  const trans_type = `${from}2${to}`; // "auto2xx";

  // Note that Caiyun Translate only supports these types of translation at present.
  const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
  if (!supportedTranslatType.includes(trans_type)) {
    console.warn(`Caiyun translate not support language: ${fromLanguage} --> ${targetLanguage}`);
    return Promise.resolve({
      type: TranslationType.Caiyun,
      result: null,
      translations: [],
    });
  }
  const params = {
    source: queryText.split("\n"), // source can be text or array. if source is an array, it will be translated in parallel
    trans_type,
    detect: from === "auto",
  };
  // console.log(`---> Caiyun params: ${JSON.stringify(params, null, 4)}`);
  const headers = {
    headers: {
      "content-type": "application/json",
      "x-authorization": "token " + caiyunToken,
    },
  };
  return new Promise((resolve, reject) => {
    axios
      .post(url, params, headers)
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
