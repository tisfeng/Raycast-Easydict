import { LanguageDetectType } from "./../detectLanguage";
/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-12 17:18
 * @fileName: baidu.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import CryptoJS from "crypto-js";
import { requestCostTime } from "../axiosConfig";
import { LanguageDetectTypeResult } from "../detectLanguage";
import { QueryWordInfo } from "../dict/youdao/types";
import { getLanguageItemFromBaiduId, getLanguageItemFromYoudaoId } from "../language/languages";
import { KeyStore } from "../preferences";
import { BaiduTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";

/**
 * 百度翻译API
 * Docs: https://fanyi-api.baidu.com/doc/21
 */
export function requestBaiduTextTranslate(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Baidu`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const salt = Math.round(new Date().getTime() / 1000);
  const baiduAppId = KeyStore.baiduAppId;
  const md5Content = baiduAppId + word + salt + KeyStore.baiduAppSecret;
  const sign = CryptoJS.MD5(md5Content).toString();
  const url = "https://fanyi-api.baidu.com/api/trans/vip/translate";
  const from = getLanguageItemFromYoudaoId(fromLanguage).baiduLanguageId;
  const to = getLanguageItemFromYoudaoId(toLanguage).baiduLanguageId;
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
    axios
      .get(url, { params, signal })
      .then((response) => {
        const baiduResult = response.data as BaiduTranslateResult;
        // console.log(`---> baiduResult: ${JSON.stringify(baiduResult, null, 4)}`);
        if (baiduResult.trans_result) {
          const translations = baiduResult.trans_result.map((item) => item.dst);
          console.log(`Baidu translate: ${translations}, cost: ${response.headers[requestCostTime]} ms`);
          resolve({
            type: TranslationType.Baidu,
            result: baiduResult,
            translations: translations,
          });
        } else {
          console.error(`baidu translate error: ${JSON.stringify(baiduResult)}`);
          const errorInfo: RequestErrorInfo = {
            type: TranslationType.Baidu,
            code: baiduResult.error_code || "",
            message: baiduResult.error_msg || "",
          };
          reject(errorInfo);
        }
      })
      .catch((error) => {
        console.error(`---> baidu translate error: ${error}`);

        if (error.message === "canceled") {
          console.log(`---> baidu cancelled`);
          return;
        }

        // It seems that Baidu will never reject, always resolve...
        reject({
          type: TranslationType.Baidu,
          code: error.response?.status.toString(),
          message: error.response?.statusText,
        });
      });
  });
}

/**
 * Baidu language detect.
 *
 * Although Baidu provides a dedicated language recognition interface, the number of supported languages is too small, so we directly use Baidu Translate's automatic language recognition instead.
 *
 * 百度语种识别API https://fanyi-api.baidu.com/doc/24
 */
export async function requestBaiduLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  console.log(`---> start request Baidu language detect`);

  const queryWordInfo: QueryWordInfo = {
    fromLanguage: "auto",
    toLanguage: "zh",
    word: text,
  };

  try {
    const baiduTypeResult = await requestBaiduTextTranslate(queryWordInfo, new AbortController().signal);
    const baiduResult = baiduTypeResult.result as BaiduTranslateResult;
    const baiduLanaugeId = baiduResult.from || "";
    const languageId = getLanguageItemFromBaiduId(baiduLanaugeId).youdaoLanguageId;
    console.warn(`---> Baidu detect languageId: ${baiduLanaugeId}, ${languageId}`);

    /**
     * Generally speaking, Baidu language auto-detection is more accurate than Tencent language recognition.
     * Baidu language recognition is inaccurate in very few cases, such as "ragazza", it should be Italian, but Baidu auto detect is en.
     * In this case, trans_result's src === dst.
     */
    let confirmed = true;
    const transResult = baiduResult.trans_result;
    if (transResult?.length) {
      const firstTransResult = transResult[0];
      confirmed = firstTransResult.dst !== firstTransResult.src;
    }

    const detectedLanguageResult: LanguageDetectTypeResult = {
      type: LanguageDetectType.Baidu,
      sourceLanguageId: baiduLanaugeId,
      youdaoLanguageId: languageId,
      confirmed: confirmed,
    };
    return Promise.resolve(detectedLanguageResult);
  } catch (error) {
    console.error(`---> requestBaiduLanguageDetect error: ${error}`);
    const errorInfo = error as RequestErrorInfo;
    return Promise.reject(errorInfo);
  }
}
