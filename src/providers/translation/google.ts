/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import { userAgent } from "@/consts";
import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo, RequestOptions } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

export type GoogleTranslateResult = {
  translatedText: string;
};

export class GoogleTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Google;

  /**
   * Use crawler to get google web translate. Only simple translate result.
   *
   * * Note: max translated text length should <= 1830
   * * Otherwise will throw error: "400. That's an error. Your client has issued a malformed or illegal request. That's all we know."
   *
   * From https://github.com/roojay520/bobplugin-google-translate/blob/master/src/google-translate-mobile.ts
   * Another wild google translate api: http://translate.google.com/translate_a/single?client=gtx&dt=t&dj=1&ie=UTF-8&sl=auto&tl=zh_TW&q=good
   */
  protected async doTranslate(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}): Promise<QueryTypeResult> {
    logTrace("google", "start google web translate");

    const fromLanguageId = getLangCode(queryWordInfo.fromLanguage, "googleLangCode");
    const toLanguageId = getLangCode(queryWordInfo.toLanguage, "googleLangCode");
    const data = {
      sl: fromLanguageId,
      tl: toLanguageId,
      hl: toLanguageId,
      q: queryWordInfo.word,
    };

    const headers = {
      "User-Agent": userAgent,
    };
    const url = `https://translate.google.com/m?${querystring.stringify(data)}`;
    logTrace("google", `web url: ${url}`);

    const html = await timedFetch(url, {
      headers,
      signal,
      responseType: "text",
    });

    // <div class="result-container">好的</div>
    const match = html.match(/<div class="result-container">(.*?)<\/div>/s);
    const translation = match?.[1]?.trim() ?? "";
    const translations = translation.split("\n");
    logTrace("google", `web translation: ${translation}`);

    return {
      type: TranslationType.Google,
      result: { translatedText: translation },
      translations,
      queryWordInfo,
    };
  }
}
