/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { QueryResponse } from "@/types";

export enum LanguageDetectType {
  Simple = "Simple Detect",
  Franc = "Franc Detect",
  Apple = "Apple Detect",
  Tencent = "Tencent Detect",
  Baidu = "Baidu Detect",
  Google = "Google Detect",
  Bing = "Bing Detect",
  Volcano = "Volcano Detect",
}

export interface DetectedLangModel {
  type: LanguageDetectType;
  youdaoLangCode: string; // pl
  sourceLangCode: string; // eg. apple detect 波兰语
  confirmed: boolean;
  detectedLanguageArray?: [string, number][]; // [['ita', 1], ['fra', 0.6]]
  result?: QueryResponse;
  prior?: boolean; // has higher priority than other detected languages, such as has two identical detected languages.
}
