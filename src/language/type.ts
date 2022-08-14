/*
 * @author: tisfeng
 * @createTime: 2022-08-14 11:50
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-14 12:48
 * @fileName: type.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

export interface LanguageItem {
  youdaoLanguageId: string;
  appleDetectChineseLanguageTitle: string; // such as 中文，英语. ⚠️: Apple detect more languages than apple translate.
  appleLanguageId?: string; // used to translate, Apple translate support 12 languages?
  deepLSourceLanguageId?: string; // deepL source language id
  deepLTargetLanguageId?: string; // most are same as source language, some are different, such as "EN-GB" "EN-US" and so on. "EN" = "EN-US"
  francLanguageId: string; // the languages represented by ISO 639-3
  aliyunLanguageId: string;
  tencentDetectLanguageId?: string; // tencent detect language id, [Japanese is "jp", Korean is "kr"] different from tencentLanguageId
  tencentLanguageId?: string;
  baiduLanguageId: string;
  caiyunLanguageId?: string;
  languageTitle: string; // * when system language is English, Apple detect language is equal to languageTitle.
  voiceList?: string[];
  googleLanguageId?: string;
  emoji: string;
}
