/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { timedFetch } from "@/fetchConfig";
import { DetectedLangModel, LanguageDetectType } from "@/detectLanguage/types";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getVolcanoLangCode, getYoudaoLangCodeFromVolcanoCode } from "@/language/languages";
import { QueryTypeResult, RequestErrorInfo, TranslationType } from "@/types";
import { getTypeErrorInfo } from "@/utils";
import { VolcanoDetectResult, VolcanoTranslateResult } from "@/translation/volcano/types";
import { genVolcanoSign } from "@/translation/volcano/volcanoSign";

console.log(`enter volcanoAPI.ts`);

/**
 * Volcengine Translate API.
 *
 * Docs: https://www.volcengine.com/docs/4640/65067
 */
export function requestVolcanoTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
  console.log(`---> start request Volcano Translate`);

  const { fromLanguage, toLanguage, word } = queryWordInfo;
  const from = getVolcanoLangCode(fromLanguage);
  const to = getVolcanoLangCode(toLanguage);

  const type = TranslationType.Volcano;

  const query = {
    Action: "TranslateText",
    Version: "2020-06-01",
  };
  const params = {
    SourceLanguage: from, // 若不配置此字段，则代表自动检测源语言
    TargetLanguage: to,
    TextList: [word], // 列表长度不超过 8，总文本长度不超过 5000 字符
    Category: "", // 默认使用通用翻译领域，无需填写
  };

  const signObject = genVolcanoSign(query, params);
  if (!signObject) {
    console.warn(`Volcano AccessKey or SecretKey is empty`);
    const errorInfo: RequestErrorInfo = {
      type: type,
      code: "",
      message: "Volcano AccessKey or SecretKey is empty",
    };
    return Promise.reject(errorInfo);
  }

  const url = signObject.getUrl();
  const config = signObject.getConfig();

  return timedFetch(url, {
    method: "POST",
    body: params,
    headers: config.headers,
    signal,
  })
    .then((volcanoResult: VolcanoTranslateResult) => {
      console.warn(`Volcano Translate res: ${JSON.stringify(volcanoResult, null, 4)}`);

      console.warn(`ResponseMetaData: ${JSON.stringify(volcanoResult.ResponseMetadata, null, 4)}`);

      const volcanoError = volcanoResult.ResponseMetadata?.Error;

      if (volcanoError) {
        console.error(`Volcano translate error: ${JSON.stringify(volcanoResult)}`);
        const errorInfo: RequestErrorInfo = {
          type: type,
          code: volcanoError.Code || "",
          message: volcanoError.Message || "",
        };
        throw errorInfo;
      }

      if (!volcanoResult.TranslationList) {
        throw new Error("Volcano translate: no translation list");
      }

      const translations = volcanoResult.TranslationList[0].Translation.split("\n");
      const result: QueryTypeResult = {
        type: type,
        result: volcanoResult,
        translations: translations,
        queryWordInfo: queryWordInfo,
      };
      console.log(`Volcano Translate: ${translations}`);
      return result;
    })
    .catch((error) => {
      if (error.message === "canceled" || error.name === "AbortError") {
        console.log(`---> Volcano Translate canceled`);
        throw undefined;
      }

      console.log(`Volcano Translate err: ${JSON.stringify(error, null, 4)}`);
      const errorInfo = getTypeErrorInfo(type, error);
      throw errorInfo;
    });
}

/**
 * Volcengine Detect API. Cost time: ~150ms
 */
export function volcanoDetect(text: string): Promise<DetectedLangModel> {
  console.log(`---> start request Volcano Detect`);
  const type = LanguageDetectType.Volcano;

  const query = {
    Action: "LangDetect",
    Version: "2020-06-01",
  };
  const params = {
    TextList: [text],
  };

  const signObject = genVolcanoSign(query, params);

  if (!signObject) {
    console.warn(`Volcano AccessKey or SecretKey is empty`);
    const result: DetectedLangModel = {
      type: type,
      sourceLangCode: "",
      youdaoLangCode: "",
      confirmed: false,
      result: undefined,
    };
    return Promise.resolve(result);
  }

  const url = signObject.getUrl();
  const config = signObject.getConfig();

  return timedFetch(url, {
    method: "POST",
    body: params,
    headers: config.headers,
  })
    .then((volcanoDetectResult: VolcanoDetectResult) => {
      const volcanoError = volcanoDetectResult.ResponseMetaData.Error;
      if (volcanoError) {
        console.error(`Volcano detect error: ${JSON.stringify(volcanoDetectResult)}`);
        const errorInfo: RequestErrorInfo = {
          type: type,
          code: volcanoError.Code || "",
          message: volcanoError.Message || "",
        };
        throw errorInfo;
      }

      const detectedLanguage = volcanoDetectResult.DetectedLanguageList[0];
      const volcanoLangCode = detectedLanguage.Language;
      const youdaoLangCode = getYoudaoLangCodeFromVolcanoCode(volcanoLangCode);
      const isConfirmed = detectedLanguage.Confidence > 0.5;
      const detectedLanguageModel: DetectedLangModel = {
        type: type,
        sourceLangCode: volcanoLangCode,
        youdaoLangCode: youdaoLangCode,
        confirmed: isConfirmed,
        result: volcanoDetectResult,
      };
      console.warn(`Volcano detect language: ${JSON.stringify(detectedLanguage)}, youdaoLangCode: ${youdaoLangCode}`);
      return detectedLanguageModel;
    })
    .catch((error) => {
      if (error.message === "canceled" || error.name === "AbortError") {
        console.log(`---> Volcano detect canceled`);
        throw undefined;
      }

      console.log(`Volcano detect err: ${JSON.stringify(error, null, 4)}`);
      const errorInfo = getTypeErrorInfo(type, error);
      throw errorInfo;
    });
}
