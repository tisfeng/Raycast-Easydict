/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: Tisfeng
 * @lastEditTime: 2022-10-30 23:12
 * @fileName: deepL.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosError } from "axios";
import querystring from "node:querystring";
import { httpsAgent, requestCostTime } from "../axiosConfig";
import { QueryWordInfo } from "../dictionary/youdao/types";
import { getDeepLLangCode } from "../language/languages";
import { AppKeyStore } from "../preferences";
import { DeepLTranslateResult, QueryTypeResult, RequestErrorInfo, TranslationType } from "../types";
import { getTypeErrorInfo } from "../utils";

/**
 * DeepL translate API. Cost time: > 1s
 *
 * https://www.deepl.com/zh/docs-api/translating-text
 */
export async function requestDeepLTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  console.log(`---> start request DeepL`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const sourceLang = getDeepLLangCode(fromLanguage);
  const targetLang = getDeepLLangCode(toLanguage);

  const deepLType = TranslationType.DeepL;

  // if language is not supported, return null
  if (!sourceLang || !targetLang) {
    console.log(`DeepL translate not support language: ${fromLanguage} --> ${toLanguage}`);
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
  const url = deepLAuthKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = {
    auth_key: deepLAuthKey,
    text: word,
    source_lang: sourceLang,
    target_lang: targetLang,
  };
  // console.log(`---> deepL params: ${JSON.stringify(params, null, 4)}`);

  if (deepLAuthKey.endsWith(":fx")) {
    console.log(`---> deepL api free`);
    // checkIfKeyValid
    if (!(await checkIfKeyValid(deepLAuthKey))) {
      console.log(`---> deepL api free key is invalid`);
      errorInfo.message = "DeepL api free key is invalid";
      return Promise.reject(errorInfo);
    }
  }

  return new Promise((resolve, reject) => {
    axios
      .post(url, querystring.stringify(params), { httpsAgent })
      .then((response) => {
        const deepLResult = response.data as DeepLTranslateResult;
        const translatedText = deepLResult.translations[0].text;
        console.log(
          `DeepL translate: ${JSON.stringify(translatedText, null, 4)}, cost: ${response.headers[requestCostTime]} ms`
        );

        const deepLTypeResult: QueryTypeResult = {
          type: TranslationType.DeepL,
          result: deepLResult,
          translations: translatedText.split("\n"),
          queryWordInfo: queryWordInfo,
        };
        resolve(deepLTypeResult);
      })
      .catch((error: AxiosError) => {
        if (error.message === "canceled") {
          console.log(`---> deepL canceled`);
          return reject(undefined);
        }

        console.error("deepL error: ", error);

        const errorInfo = getTypeErrorInfo(TranslationType.DeepL, error);
        const errorCode = error.response?.status;

        // https://www.deepl.com/zh/docs-api/api-access/error-handling/
        if (errorCode === 456) {
          errorInfo.message = "Quota exceeded"; // Quota exceeded. The character limit has been reached.
        } else if (errorCode === 403) {
          errorInfo.message = "Authorization failed"; // Authorization failed. Please supply a valid auth_key parameter.
        }

        console.error("deepL error info: ", errorInfo); // message: 'timeout of 15000ms exceeded'
        reject(errorInfo);
      });
  });
}

interface DeepLUsage {
  character_count: number;
  character_limit: number;
}

/**
 * Check if key is valid.
 *
 * https://www.deepl.com/zh/docs-api/other-functions/monitoring-usage/
 */
function checkIfKeyValid(key: string): Promise<boolean> {
  console.log(`test a deepL key: ${key}`);
  const url = "https://api-free.deepl.com/v2/usage";
  const params = {
    auth_key: key,
  };

  return new Promise((resolve) => {
    axios
      .post(url, querystring.stringify(params))
      .then((res) => {
        const usage = res.data as DeepLUsage;
        console.log(`---> deepL usage: ${JSON.stringify(usage)}`);
        if (usage.character_count < usage.character_limit) {
          console.log(`---> valid key: ${key}`);
          resolve(true);
        } else {
          console.log(`---> execeded quota: ${key}`);
          resolve(false);
        }
      })
      .catch((err) => {
        console.error(`---> isValidKey deepL error: ${err}`);
        resolve(false);
      });
  });
}
