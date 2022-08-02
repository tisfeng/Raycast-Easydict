import { LingueeDisplayType } from "./dict/linguee/types";
/*
 * @author: tisfeng
 * @createTime: 2022-06-04 21:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-03 00:01
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Image } from "@raycast/api";
import { TextTranslateResponse } from "tencentcloud-sdk-nodejs-tmt/tencentcloud/services/tmt/v20180321/tmt_models";
import { LanguageDetectType, LanguageDetectTypeResult } from "./detectLanguage";
import { IcibaDictionaryResult } from "./dict/iciba/interface";
import { LingueeDictionaryResult } from "./dict/linguee/types";

export enum YoudaoDisplayType {
  Translation = "Translate",
  Explanations = "Explanation",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
}

export enum TranslationType {
  Youdao = "Youdao",
  Baidu = "Baidu",
  Tencent = "Tencent",
  Caiyun = "Caiyun",
  Apple = "Apple",
  DeepL = "DeepL",
  Google = "Google",
}

export enum DicionaryType {
  Youdao = "Youdao Dicionary",
  Iciba = "Iciba Dicionary",
  Eudic = "Eudic Dicionary",
  Linguee = "Linguee Dicionary",
}

export type QueryType = TranslationType | DicionaryType;
export type RequestType = TranslationType | DicionaryType | LanguageDetectType;

export interface RequestTypeResult {
  type: RequestType;
  result: RequestResultType | null;
  translation: string; // one line translation, join by " ". if show multiple translation, need to join by "\n"
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

export interface YoudaoDictionaryResult {
  l: string;
  query: string;
  returnPhrase: [];
  errorCode: string;
  translation: string[];
  web?: TranslateResultKeyValueItem[];
  basic?: YoudaoTranslateResultBasicItem;
  isWord: boolean;
  speakUrl: string;
}

export type YoudaoTranslateResult = YoudaoDictionaryResult;

export interface QueryWordInfo {
  word: string;
  fromLanguage: string; // ! must be Youdao language id.
  toLanguage: string;
  isWord: boolean; // ! show web translation need this value.
  detectedLanguage?: LanguageDetectTypeResult;
  phonetic?: string; // ɡʊd
  speech?: string; // youdao tts url
  examTypes?: string[];
  audioPath?: string;
  speechUrl?: string; // youdao tts url, some language not have tts url, such as "ຂາດ"
}

export interface YoudaoTranslateResultBasicItem {
  explains: string[];
  "us-phonetic"?: string; // American phonetic
  "us-speech"?: string;
  phonetic?: string; // Chinese word phonetic
  exam_type?: string[];
  wfs?: YoudaoTranslateResultBasicFormsItem[]; // word forms
}
export interface YoudaoTranslateResultBasicFormsItem {
  wf?: YoudaoTranslateResultBasicFormItem;
}
export interface YoudaoTranslateResultBasicFormItem {
  name: string;
  value: string;
}

export interface YoudaoTranslateReformatResult {
  type: YoudaoDisplayType;
  children?: YoudaoTranslateReformatResultItem[];
}
export interface YoudaoTranslateReformatResultItem {
  key: string;
  title: string;
  copyText: string;
  subtitle?: string;
  phonetic?: string;
  speech?: string;
  examTypes?: string[];
}

export interface MyPreferences {
  language1: string;
  language2: string;
  isAutomaticQuerySelectedText: boolean;
  isAutomaticPlayWordAudio: boolean;
  isDisplayTargetTranslationLanguage: boolean;
  translationDisplayOrder: string;

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

export interface ActionListPanelProps {
  displayItem: ListDisplayItem;
  isInstalledEudic: boolean;
  onLanguageUpdate: (language: LanguageItem) => void;
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

export interface YoudaoDictionaryFormatResult {
  queryWordInfo: QueryWordInfo;
  translations: string[];
  explanations?: string[];
  forms?: YoudaoTranslateResultBasicFormsItem[];
  webTranslation?: TranslateResultKeyValueItem;
  webPhrases?: TranslateResultKeyValueItem[];
}

export interface TranslateItem {
  type: TranslationType;
  text: string;
}
export interface TranslateResultKeyValueItem {
  key: string;
  value: string[];
}

// export type RequestDisplayResult = SectionDisplayItem[];

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

export type ListItemDisplayType = LingueeDisplayType | YoudaoDisplayType | QueryType | TranslationType | DicionaryType;

export interface ClipboardRecoredItem {
  key: string;
  vale: string;
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
