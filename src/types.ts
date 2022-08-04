/*
 * @author: tisfeng
 * @createTime: 2022-06-04 21:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-04 23:52
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Image } from "@raycast/api";
import { TextTranslateResponse } from "tencentcloud-sdk-nodejs-tmt/tencentcloud/services/tmt/v20180321/tmt_models";
import { LanguageDetectType } from "./detectLanguage";
import { IcibaDictionaryResult } from "./dict/iciba/interface";
import { LingueeDictionaryResult, LingueeListItemType } from "./dict/linguee/types";
import { QueryWordInfo, YoudaoDictionaryFormatResult, YoudaoDictionaryListItemType } from "./dict/youdao/types";

export interface MyPreferences {
  language1: string;
  language2: string;
  isAutomaticQuerySelectedText: boolean;
  isAutomaticPlayWordAudio: boolean;
  isDisplayTargetTranslationLanguage: boolean;
  translationOrder: string;

  enableYoudaoDictionary: boolean;
  enableYoudaoTranslate: boolean;

  enableLingueeDictionary: boolean;

  youdaoAppId: string;
  youdaoAppSecret: string;

  enableDeepLTranslate: boolean;
  deepLAuthKey: string;

  enableGoogleTranslate: boolean;

  enableBaiduTranslate: boolean;
  baiduAppId: string;
  baiduAppSecret: string;

  enableTencentTranslate: boolean;
  tencentSecretId: string;
  tencentSecretKey: string;

  enableAppleLanguageDetect: boolean;
  enableAppleTranslate: boolean;

  enableCaiyunTranslate: boolean;
  caiyunToken: string;
}

export interface LanguageItem {
  youdaoLanguageId: string;
  appleDetectChineseLanguageTitle?: string; // such as 中文，英语. ⚠️: Apple detect more languages than apple translate.
  appleLanguageId?: string; // used to translate, Apple translate support 12 languages?
  deepLSourceLanguageId?: string; // deepL source language id
  deepLTargetLanguageId?: string; // most are same as source language, some are different, such as "EN-GB" "EN-US" and so on.
  francLanguageId: string; // the languages represented by ISO 639-3
  aliyunLanguageId: string;
  tencentDetectLanguageId?: string; // tencent detect language id, [Japanese is "jp", Korean is "kr"] different from tencentLanguageId
  tencentLanguageId?: string;
  baiduLanguageId?: string;
  caiyunLanguageId?: string;
  languageTitle: string;
  voiceList?: string[];
  googleLanguageId?: string;
  youdaoWebLanguageId?: string;
  eudicWebLanguageId?: string;
}

export interface ActionListPanelProps {
  displayItem: ListDisplayItem;
  isInstalledEudic: boolean;
  onLanguageUpdate: (language: LanguageItem) => void;
}

export enum TranslationType {
  Youdao = "Youdao Translate",
  Baidu = "Baidu Translate",
  Tencent = "Tencent Translate",
  Caiyun = "Caiyun Translate",
  Apple = "Apple Translate",
  DeepL = "DeepL Translate",
  Google = "Google Translate",
}

export enum DicionaryType {
  Youdao = "Youdao Dictionary",
  Iciba = "Iciba Dictionary",
  Eudic = "Eudic Dictionary",
  Linguee = "Linguee Dictionary",
}

export type QueryType = TranslationType | DicionaryType;
export type RequestType = TranslationType | DicionaryType | LanguageDetectType;

export interface RequestTypeResult {
  type: RequestType;
  result: RequestResultType | null; // when not supported, result is null.
  translations: string[]; // each translation is a paragraph.
  oneLineTranslations?: string; // one line translation.
  errorInfo?: RequestErrorInfo;
}

type RequestResultType =
  | YoudaoDictionaryFormatResult
  | BaiduTranslateResult
  | TencentTranslateResult
  | CaiyunTranslateResult
  | DeepLTranslateResult
  | IcibaDictionaryResult
  | LingueeDictionaryResult
  | AppleTranslateResult;

export interface RequestErrorInfo {
  message: string;
  code?: string;
  type?: RequestType;
}

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

export type TencentTranslateResult = TextTranslateResponse;

export interface CaiyunTranslateResult {
  rc: string;
  target: string[];
  confidence: number;
}

export interface DeepLTranslateResult {
  translations: DeepLTranslationItem[]; //  deepL may return multiple translations for the text.
}
export interface DeepLTranslationItem {
  detected_source_language: string;
  text: string;
}

export interface GoogleTranslateResult {
  translatedText: string;
}

export interface AppleTranslateResult {
  translatedText: string;
}

export interface TranslationItem {
  type: TranslationType;
  text: string;
}

export interface QueryResult {
  type: QueryType;
  sourceResult?: RequestTypeResult;
  displayResult?: SectionDisplayItem[];
}

export interface SectionDisplayItem {
  type: ListItemDisplayType;
  sectionTitle?: string;
  items?: ListDisplayItem[];
}

export interface ListDisplayItem {
  key: string;
  title: string;
  displayType: ListItemDisplayType;
  copyText: string;
  tooltip?: string;
  subtitle?: string;
  queryWordInfo: QueryWordInfo;
  speech?: string;
  translationMarkdown?: string;

  // accessory item
  accessoryItem?: ListAccessoryItem;
}

export interface ListAccessoryItem {
  phonetic?: string;
  examTypes?: string[];
  example?: string; // French word example text
}

export type ListItemDisplayType = LingueeListItemType | YoudaoDictionaryListItemType | QueryType;

export interface ClipboardRecoredItem {
  key: string;
  value: string;
}

export interface QueryRecoredItem {
  timestamp: number;
  queryText: string;
  result?: string;
}

export interface WebTranslationItem {
  type: QueryType;
  webUrl: string;
  icon: Image.ImageLike;
  title: string;
}
