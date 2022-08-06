/*
 * @author: tisfeng
 * @createTime: 2022-08-04 23:21
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-06 22:22
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LanguageDetectTypeResult } from "../../detectLanguage";

export interface YoudaoDictionaryFormatResult {
  queryWordInfo: QueryWordInfo;
  translations: string[];
  explanations?: string[];
  forms?: YoudaoTranslateResultBasicFormsItem[];
  webTranslation?: TranslateResultKeyValueItem;
  webPhrases?: TranslateResultKeyValueItem[];
}

export enum YoudaoDictionaryListItemType {
  Translation = "Translate",
  Explanations = "Explanation",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
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

export interface TranslateResultKeyValueItem {
  key: string;
  value: string[];
}
