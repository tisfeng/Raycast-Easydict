/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getLangCode } from "@/core/language/utils";
import { AppKeyStore } from "@/preferences";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

export interface CaiyunTranslateResult {
  rc: string;
  target: string[];
  confidence: number;
}

/**
 * Caiyun translate API. Cost time: 0.2s
 *
 * 彩云小译  https://open.caiyunapp.com/%E4%BA%94%E5%88%86%E9%92%9F%E5%AD%A6%E4%BC%9A%E5%BD%A9%E4%BA%91%E5%B0%8F%E8%AF%91_API
 */
export class CaiyunTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Caiyun;

  protected async doTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
    logTrace("caiyun", "start request Caiyun");
    const { fromLanguage, toLanguage, word } = queryWordInfo;

    const url = "https://api.interpreter.caiyunai.com/v1/translator";
    const from = getLangCode(fromLanguage, "caiyunLangCode");
    const to = getLangCode(toLanguage, "caiyunLangCode");
    const trans_type = `${from}2${to}`; // "auto2xx";

    const type = TranslationType.Caiyun;

    // Note that Caiyun Translate only supports these types of translation at present.
    const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
    if (!supportedTranslatType.includes(trans_type)) {
      logTrace("caiyun", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
      return {
        type,
        result: undefined,
        translations: [],
        queryWordInfo,
      };
    }

    const params = {
      source: word.split("\n"), // source can be text or array. if source is an array, it will be translated in parallel
      trans_type,
      detect: from === "auto",
    };
    const headers = {
      "content-type": "application/json",
      "x-authorization": "token " + AppKeyStore.caiyunToken,
    };

    const caiyunResult = await timedFetch<CaiyunTranslateResult>(url, {
      method: "POST",
      body: params,
      headers,
      signal,
    });

    const translations = caiyunResult.target;
    logTrace("caiyun", `translate: ${translations}`);

    return {
      type,
      result: caiyunResult,
      translations,
      queryWordInfo,
    };
  }
}
