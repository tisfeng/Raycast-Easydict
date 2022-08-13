/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-13 18:11
 * @fileName: tencent.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import * as tencentcloud from "tencentcloud-sdk-nodejs-tmt";
import { LanguageDetectType, LanguageDetectTypeResult } from "../detectLanauge/types";
import { QueryWordInfo } from "../dict/youdao/types";
import { getLanguageItemFromTencentId, getLanguageItemFromYoudaoId } from "../language/languages";
import { KeyStore } from "../preferences";
import { RequestErrorInfo, RequestTypeResult, TencentTranslateResult, TranslationType } from "../types";

const tencentEndpoint = "tmt.tencentcloudapi.com";
const tencentRegion = "ap-guangzhou";
const tencentProjectId = 0;
const TmtClient = tencentcloud.tmt.v20180321.Client;

const clientConfig = {
  credential: {
    secretId: KeyStore.tencentSecretId,
    secretKey: KeyStore.tencentSecretKey,
  },
  region: tencentRegion,
  profile: {
    httpProfile: {
      endpoint: tencentEndpoint,
    },
  },
};
const client = new TmtClient(clientConfig);

/**
 * 腾讯文本翻译，5次/秒
 * Docs: https://cloud.tencent.com/document/api/551/15619
 *
 * Todo: use axios to request. so that we can use AbortSignal to cancel request.
 */
export async function requestTencentTextTranslate(queryWordInfo: QueryWordInfo): Promise<RequestTypeResult> {
  console.log(`---> start request Tencent translate`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;

  const from = getLanguageItemFromYoudaoId(fromLanguage).tencentLanguageId;
  const to = getLanguageItemFromYoudaoId(toLanguage).tencentLanguageId;
  if (!from || !to) {
    console.warn(`Tencent translate not support language: ${fromLanguage} --> ${toLanguage}`);
    return Promise.resolve({
      type: TranslationType.Tencent,
      result: undefined,
      translations: [],
    });
  }
  const params = {
    SourceText: word,
    Source: from,
    Target: to,
    ProjectId: tencentProjectId,
  };
  const startTime = new Date().getTime();

  try {
    const response = await client.TextTranslate(params);
    const endTime = new Date().getTime();
    console.log(`Tencen translate: ${response.TargetText}, cost: ${endTime - startTime} ms`);
    const typeResult: RequestTypeResult = {
      type: TranslationType.Tencent,
      result: response as TencentTranslateResult,
      translations: response.TargetText.split("\n"),
    };
    return Promise.resolve(typeResult);
  } catch (err) {
    // console.error(`tencent translate error: ${JSON.stringify(err, null, 2)}`);
    const error = err as { code: string; message: string };
    console.error(`Tencent translate error, code: ${error.code}, message: ${error.message}`);
    const errorInfo: RequestErrorInfo = {
      type: TranslationType.Tencent,
      code: error.code,
      message: error.message,
    };
    return Promise.reject(errorInfo);
  }
}

/**
 * 腾讯语种识别，5次/秒
 * Docs: https://cloud.tencent.com/document/product/551/15620?cps_key=1d358d18a7a17b4a6df8d67a62fd3d3d
 */
export async function tencentLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  const params = {
    Text: text,
    ProjectId: tencentProjectId,
  };
  const startTime = new Date().getTime();
  try {
    const response = await client.LanguageDetect(params);
    const endTime = new Date().getTime();
    const tencentLanguageId = response.Lang || "";
    const youdaoLanguageId = getLanguageItemFromTencentId(tencentLanguageId).youdaoLanguageId;
    console.warn(
      `tencent detect language id: ${tencentLanguageId}, ${youdaoLanguageId}, cost time: ${endTime - startTime} ms`
    );
    const typeResult: LanguageDetectTypeResult = {
      type: LanguageDetectType.Tencent,
      sourceLanguageId: tencentLanguageId,
      youdaoLanguageId: youdaoLanguageId,
      confirmed: false,
    };
    return Promise.resolve(typeResult);
  } catch (err) {
    const error = err as { code: string; message: string };
    console.error(`tencent detect error, code: ${error.code}, message: ${error.message}`);
    const errorInfo: RequestErrorInfo = {
      type: TranslationType.Tencent,
      code: error.code,
      message: error.message,
    };
    return Promise.reject(errorInfo);
  }
}
