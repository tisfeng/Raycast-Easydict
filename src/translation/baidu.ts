/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-04 17:45
 * @fileName: baidu.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import CryptoJS from "crypto-js";

import { requestCostTime } from "../axiosConfig";
import { baiduAppId, baiduAppSecret } from "../crypto";
import { BaiduTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";
import { getLanguageItemFromYoudaoId } from "../utils";

/**
 * 百度翻译API
 * Docs: https://fanyi-api.baidu.com/doc/21
 */
export function requestBaiduTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  console.log(`---> start request Baidu`);
  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = baiduAppId + queryText + salt + baiduAppSecret;
  const sign = CryptoJS.MD5(md5Content).toString();
  const url = "https://fanyi-api.baidu.com/api/trans/vip/translate";
  const from = getLanguageItemFromYoudaoId(fromLanguage).baiduLanguageId;
  const to = getLanguageItemFromYoudaoId(targetLanguage).baiduLanguageId;
  const encodeQueryText = Buffer.from(queryText, "utf8").toString();
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
      .get(url, { params })
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
        // It seems that Baidu will never reject, always resolve...
        console.error(`---> baidu translate error: ${error}`);
        reject({
          type: TranslationType.Baidu,
          code: error.response?.status.toString(),
          message: error.response?.statusText,
        });
      });
  });
}
