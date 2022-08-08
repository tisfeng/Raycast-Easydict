/*
 * @author: tisfeng
 * @createTime: 2022-06-24 22:36
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-08 18:36
 * @fileName: consts.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { RequestErrorInfo } from "./types";

export const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36";

export const clipboardQueryTextKey = "clipboardQueryTextKey";

export enum YoudaoRequestStateCode {
  Success = "0",
  AccessFrequencyLimited = "207",
  InsufficientAccountBalance = "401",
  TargetLanguageNotSupported = "102",
  TranslationQueryFailed = "302", // 翻译查询失败, such as 'con' 😓
}

// https://fanyi-api.baidu.com/doc/21
export enum BaiduRequestStateCode {
  Success = "52000",
  AccessFrequencyLimited = "54003",
  InsufficientAccountBalance = "54004",
  TargetLanguageNotSupported = "58001",
}

export const youdaoErrorCodeUrl = encodeURI(
  "https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html#section-11"
);

export const youdaoErrorList: RequestErrorInfo[] = [
  {
    code: YoudaoRequestStateCode.Success,
    message: "Success",
  },
  {
    code: YoudaoRequestStateCode.AccessFrequencyLimited,
    message: "Access frequency limited",
  },
  {
    code: YoudaoRequestStateCode.InsufficientAccountBalance,
    message: "Insufficient account balance",
  },
  {
    code: YoudaoRequestStateCode.TargetLanguageNotSupported,
    message: "Target language not supported",
  },
  {
    code: YoudaoRequestStateCode.TranslationQueryFailed,
    message: "Translation query failed",
  },
];
