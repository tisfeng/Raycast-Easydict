/*
 * @author: tisfeng
 * @createTime: 2022-09-26 15:52
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-09-26 23:54
 * @fileName: volcanoAPI.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import { requestCostTime } from "../../axiosConfig";
import { QueryWordInfo } from "../../dictionary/youdao/types";
import { getVolcanoLanguageId } from "../../language/languages";
import { getTypeErrorInfo, printObject } from "../../utils";
import { QueryTypeResult, RequestErrorInfo, TranslationType } from "./../../types";
import { VolcanoTranslateResult } from "./types";
import { genVolcanoSign } from "./volcanoSign";

/**
 * Volcengine Translate API.
 *
 * Docs: https://www.volcengine.com/docs/4640/65067
 */
export function requestVolcanoTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  console.log(`---> start request Volcano Translate`);

  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const from = getVolcanoLanguageId(fromLanguage);
  const to = getVolcanoLanguageId(toLanguage);

  requestVolcanoDetect(queryWordInfo);

  const query = {
    Action: "TranslateText",
    Version: "2020-06-01",
  };
  const params = {
    SourceLanguage: from, // 若不配置此字段，则代表自动检测源语言
    TargetLanguage: to,
    TextList: [word], // 列表长度不超过8，总文本长度不超过5000字符
    Category: "", // 默认使用通用翻译领域，无需填写
  };

  const signObjet = genVolcanoSign(query, params);
  const url = signObjet.getUrl();
  const config = signObjet.getConfig();

  const type = TranslationType.Volcano;

  return new Promise((resolve, reject) => {
    axios
      .post(url, params, config)
      .then((res) => {
        const volcanoResult = res.data as VolcanoTranslateResult;
        const volcanoError = volcanoResult.ResponseMetaData.Error;
        if (volcanoError) {
          console.error(`baidu translate error: ${JSON.stringify(volcanoResult)}`); //  {"error_code":"54001","error_msg":"Invalid Sign"}
          const errorInfo: RequestErrorInfo = {
            type: type,
            code: volcanoError.Code || "",
            message: volcanoError.Message || "",
          };
          return reject(errorInfo);
        }

        const translations = volcanoResult.TranslationList[0].Translation.split("\n");
        const result: QueryTypeResult = {
          type: type,
          result: volcanoResult,
          translations: translations,
          wordInfo: queryWordInfo,
        };
        resolve(result);

        console.log(`Volcano Translate: ${translations}`);
        console.warn(`Volcano Translate cost time: ${res.headers[requestCostTime]} ms`);
      })
      .catch((error) => {
        if (error.message === "canceled") {
          console.log(`---> Volcano Translate canceled`);
          return reject(undefined);
        }

        console.log(`Volcano Translate err: ${JSON.stringify(error, null, 2)}`);
        const errorInfo = getTypeErrorInfo(type, error);
        reject(errorInfo);
      });
  });
}

/**
 * Volcengine Detect API
 */
export function requestVolcanoDetect(queryWordInfo: QueryWordInfo) {
  console.log(`---> start request requestVolcanoDetect`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  console.log(`---> fromLanguage: ${fromLanguage}, toLanguage: ${toLanguage}, word: ${word}`);

  const query = {
    Action: "LangDetect",
    Version: "2020-06-01",
  };
  const params = {
    TextList: [word],
  };

  const signObjet = genVolcanoSign(query, params);
  const url = signObjet.getUrl();
  const config = signObjet.getConfig();

  axios
    .post(url, params, config)
    .then((res) => {
      printObject(`headers`, res.config.headers);

      console.log(`requestVolcanoDetect res: ${JSON.stringify(res.data, null, 2)}`);
      console.warn(`cost time: ${res.headers[requestCostTime]} ms`);
    })
    .catch((err) => {
      console.log(`requestVolcanoDetect err: ${JSON.stringify(err, null, 2)}`);
    });
}
