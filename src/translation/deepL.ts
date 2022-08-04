/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-04 22:06
 * @fileName: deepL.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosResponse } from "axios";
import querystring from "node:querystring";
import { deepLAuthKey } from "../crypto";
import { DeepLTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";
import { getLanguageItemFromYoudaoId } from "../utils";

/**
 * DeepL translate API
 * https://www.deepl.com/zh/docs-api/translating-text
 */
export async function requestDeepLTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  console.log(`---> start rquest DeepL`);
  const sourceLang = getLanguageItemFromYoudaoId(fromLanguage).deepLSourceLanguageId;
  const targetLang =
    getLanguageItemFromYoudaoId(targetLanguage).deepLSourceLanguageId ||
    getLanguageItemFromYoudaoId(targetLanguage).deepLTargetLanguageId;

  // if language is not supported, return null
  if (!sourceLang || !targetLang) {
    console.log(`DeepL translate not support language: ${fromLanguage} --> ${targetLanguage}`);
    return Promise.resolve({
      type: TranslationType.DeepL,
      result: null,
      translations: [],
    });
  }

  // * deepL api free and deepL pro api use different url host.
  const url = deepLAuthKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = {
    auth_key: deepLAuthKey,
    text: queryText,
    source_lang: sourceLang,
    target_lang: targetLang,
  };
  console.log(`---> deepL params: ${JSON.stringify(params, null, 4)}`);

  try {
    const response = await axios.post(url, querystring.stringify(params));
    const deepLResult = response.data as DeepLTranslateResult;
    const translatedText = deepLResult.translations[0].text;
    console.log(
      `DeepL translate: ${JSON.stringify(translatedText, null, 4)}, cost: ${response.headers["requestCostTime"]} ms`
    );
    return Promise.resolve({
      type: TranslationType.DeepL,
      result: deepLResult,
      translations: [translatedText],
    });
  } catch (err) {
    const error = err as { response: AxiosResponse };
    console.error("deepL error: ", JSON.stringify(error.response, null, 4));
    const errorInfo: RequestErrorInfo = {
      type: TranslationType.DeepL,
      code: error.response?.status.toString(),
      message: error.response?.statusText,
    };
    console.error("deepL error info: ", errorInfo);
    return Promise.reject(errorInfo);
  }
}
