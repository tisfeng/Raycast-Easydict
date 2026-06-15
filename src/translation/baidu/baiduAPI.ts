/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";
import { timedFetch } from "@/fetchConfig";
import { DetectedLangModel, LanguageDetectType } from "@/detectLanguage/types";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getBaiduLangCode, getYoudaoLangCodeFromBaiduCode, isValidLangCode } from "@/language/languages";
import { AppKeyStore } from "@/preferences";
import {
  BaiduTranslateResult,
  BaiduWebLanguageDetect,
  QueryTypeResult,
  RequestErrorInfo,
  TranslationType,
} from "@/types";
import { getTypeErrorInfo, md5 } from "@/utils";

/**
 * Baidu translate. Cost time: ~0.4s
 *
 * 百度翻译 API https://fanyi-api.baidu.com/doc/21
 */
export function requestBaiduTextTranslate(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  console.log(`---> start request Baidu translate`);

  const type = TranslationType.Baidu;

  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const from = getBaiduLangCode(fromLanguage);
  const to = getBaiduLangCode(toLanguage);

  if (!from || !to) {
    console.warn(`Baidu translate not support language: ${fromLanguage} to ${toLanguage}`);
    const result: QueryTypeResult = {
      type: type,
      result: undefined,
      translations: [],
      queryWordInfo: queryWordInfo,
    };
    return Promise.resolve(result);
  }

  const baiduAppId = AppKeyStore.baiduAppId;
  const baiduAppSecret = AppKeyStore.baiduAppSecret;

  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = baiduAppId + word + salt + baiduAppSecret;
  const sign = md5(md5Content);
  const url = "https://fanyi-api.baidu.com/api/trans/vip/translate";
  const encodeQueryText = Buffer.from(word, "utf8").toString();
  const params = {
    q: encodeQueryText,
    from: from,
    to: to,
    appid: baiduAppId,
    salt: salt,
    sign: sign,
  };
  // console.log(`---> Baidu params: ${JSON.stringify(params, null, 4)}`);

  return new Promise((resolve, reject) => {
    timedFetch(url, { params, signal })
      .then((response: BaiduTranslateResult) => {
        const baiduResult = response;
        // console.log(`---> baiduResult: ${JSON.stringify(baiduResult, null, 4)}`);
        if (baiduResult.trans_result) {
          const translations = baiduResult.trans_result.map((item) => item.dst);
          console.warn(`Baidu translate: ${translations}, ${baiduResult.from}`);
          const result: QueryTypeResult = {
            type: type,
            result: baiduResult,
            translations: translations,
            queryWordInfo: queryWordInfo,
          };
          resolve(result);
        } else {
          console.error(`baidu translate error: ${JSON.stringify(baiduResult)}`); //  {"error_code":"54001","error_msg":"Invalid Sign"}
          const errorInfo: RequestErrorInfo = {
            type: type,
            code: baiduResult.error_code || "",
            message: baiduResult.error_msg || "",
          };
          reject(errorInfo);
        }
      })
      .catch((error) => {
        if (error.message === "canceled" || error.name === "AbortError") {
          console.log(`---> baidu translate canceled`);
          return reject(undefined);
        }

        // It seems that Baidu will never reject, always resolve...
        console.error(`---> baidu translate error: ${error}`);
        const errorInfo = getTypeErrorInfo(type, error);
        reject(errorInfo);
      });
  });
}

/**
 * Baidu web language detect, unofficial API. Cost time: ~0.3s
 */
export async function baiduWebDetect(text: string): Promise<DetectedLangModel> {
  console.log(`---> start web Baidu language detect`);
  const type = LanguageDetectType.Baidu;

  return new Promise((resolve, reject) => {
    const url = "https://fanyi.baidu.com/langdetect";
    const params = { query: text };
    timedFetch(url, {
      method: "POST",
      body: querystring.stringify(params),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
      .then((response: BaiduWebLanguageDetect) => {
        // console.log(`---> web Baidu language detect response: ${JSON.stringify(response)}`);

        const baiduWebLanguageDetect = response;
        if (baiduWebLanguageDetect.error === 0) {
          const baiduLanguageId = baiduWebLanguageDetect.lan || "";
          const youdaoLanguageId = getYoudaoLangCodeFromBaiduCode(baiduLanguageId);
          const isConfirmed = isValidLangCode(youdaoLanguageId);

          console.warn(`---> Baidu detect language: ${baiduLanguageId}, youdaoId: ${youdaoLanguageId}`);

          const detectedLanguageResult: DetectedLangModel = {
            type: type,
            sourceLangCode: baiduLanguageId,
            youdaoLangCode: youdaoLanguageId,
            confirmed: isConfirmed,
            result: baiduWebLanguageDetect,
          };
          resolve(detectedLanguageResult);
        } else {
          console.error(`web Baidu detect error: ${JSON.stringify(baiduWebLanguageDetect)}`);

          const errorInfo = getBaiduWebLanguageDetectErrorInfo(baiduWebLanguageDetect);
          reject(errorInfo);
        }
      })
      .catch((error) => {
        if (error.message === "canceled" || error.name === "AbortError") {
          console.log(`---> baidu detect canceled`);
          return reject(undefined);
        }

        console.error(`---> web Baidu language detect error: ${error}`);

        const errorInfo = getTypeErrorInfo(type, error);
        reject(errorInfo);
      });
  });
}

function getBaiduWebLanguageDetectErrorInfo(result: BaiduWebLanguageDetect): RequestErrorInfo {
  const errorCode = result.error;
  const errorInfo: RequestErrorInfo = {
    type: LanguageDetectType.Baidu,
    code: errorCode ? errorCode.toString() : "",
    message: result.msg || "",
  };

  return errorInfo;
}
