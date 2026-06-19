/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import type { QueryWordInfo } from "@/types/query";

export interface BaiduTranslateResult {
  from?: string;
  to?: string;
  trans_result?: BaiduTranslateItem[];
  error_code?: string;
  error_msg?: string;
}

export interface BaiduTranslateItem {
  src: string;
  dst: string;
}

export interface BaiduWebLanguageDetect {
  error?: number;
  msg?: string;
  lan?: string;
}
import { DetectedLangModel, LanguageDetectType } from "@/core/detect/types";
import { baiduMap, getLangCode, getYoudaoLangCode } from "@/core/language/utils";
import { isValidLangCode } from "@/core/language/utils";
import { AppKeyStore } from "@/preferences";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, RequestErrorInfo } from "@/types/query";
import { md5 } from "@/utils/crypto";
import { getTypeErrorInfo } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";

/**
 * Baidu translate. Cost time: ~0.4s
 *
 * 百度翻译 API https://fanyi-api.baidu.com/doc/21
 */
export function requestBaiduTextTranslate(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("baidu", "start request Baidu translate");

  const type = TranslationType.Baidu;

  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const from = getLangCode(fromLanguage, "baiduLangCode");
  const to = getLangCode(toLanguage, "baiduLangCode");

  if (!from || !to) {
    logWarn("baidu", `translate not support language: ${fromLanguage} to ${toLanguage}`);
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

  return new Promise((resolve, reject) => {
    timedFetch(url, { params, signal })
      .then((response: BaiduTranslateResult) => {
        const baiduResult = response;
        if (baiduResult.trans_result) {
          const translations = baiduResult.trans_result.map((item) => item.dst);
          logTrace("baidu", `translate: ${translations}, ${baiduResult.from}`);
          const result: QueryTypeResult = {
            type: type,
            result: baiduResult,
            translations: translations,
            queryWordInfo: queryWordInfo,
          };
          resolve(result);
        } else {
          logError("baidu", `translate error: ${JSON.stringify(baiduResult)}`); //  {"error_code":"54001","error_msg":"Invalid Sign"}
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
          logTrace("baidu", "translate canceled");
          return reject(undefined);
        }

        // It seems that Baidu will never reject, always resolve...
        logError("baidu", `translate error: ${error}`);
        const errorInfo = getTypeErrorInfo(type, error);
        reject(errorInfo);
      });
  });
}

/**
 * Baidu web language detect, unofficial API. Cost time: ~0.3s
 */
export async function baiduWebDetect(text: string): Promise<DetectedLangModel> {
  logTrace("baidu", "start web Baidu language detect");
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
        const baiduWebLanguageDetect = response;
        if (baiduWebLanguageDetect.error === 0) {
          const baiduLanguageId = baiduWebLanguageDetect.lan || "";
          const youdaoLanguageId = getYoudaoLangCode(baiduLanguageId, baiduMap);
          const isConfirmed = isValidLangCode(youdaoLanguageId);

          logTrace("baidu", `detected: ${baiduLanguageId}`);

          const detectedLanguageResult: DetectedLangModel = {
            type: type,
            sourceLangCode: baiduLanguageId,
            youdaoLangCode: youdaoLanguageId,
            confirmed: isConfirmed,
            result: baiduWebLanguageDetect,
          };
          resolve(detectedLanguageResult);
        } else {
          logError("baidu", `web detect error: ${JSON.stringify(baiduWebLanguageDetect)}`);

          const errorInfo = getBaiduWebLanguageDetectErrorInfo(baiduWebLanguageDetect);
          reject(errorInfo);
        }
      })
      .catch((error) => {
        if (error.message === "canceled" || error.name === "AbortError") {
          logTrace("baidu", "detect canceled");
          return reject(undefined);
        }

        logError("baidu", `web Baidu language detect error: ${error}`);

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
