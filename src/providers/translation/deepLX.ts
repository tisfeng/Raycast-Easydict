/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { type TargetLanguage, translate } from "@deeplx/core";

import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { logTrace } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

/**
 * DeepLX translate API - Free DeepL translation using deeplx package
 * Cost time: ~0.5-1s
 *
 * Uses the unofficial but free DeepL API client
 * https://github.com/un-ts/deeplx
 */
export class DeepLXTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.DeepLX;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async doTranslate(queryWordInfo: QueryWordInfo, _signal?: AbortSignal): Promise<QueryTypeResult> {
    logTrace("deeplx", "start request DeepLX");
    const { fromLanguage, toLanguage, word } = queryWordInfo;
    const sourceLang = getLangCode(fromLanguage, "deepLSourceId");
    const targetLang = getLangCode(toLanguage, "deepLSourceId");

    if (!sourceLang || !targetLang) {
      logTrace("deeplx", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
      return {
        type: TranslationType.DeepLX,
        result: undefined,
        translations: [],
        queryWordInfo,
      };
    }

    const translatedText = await translate(word, targetLang as TargetLanguage, sourceLang as TargetLanguage);
    logTrace("deeplx", `translate: ${translatedText}`);

    // Create a result object similar to DeepL API structure
    const deepLXResult = {
      translations: [
        {
          detected_source_language: sourceLang,
          text: translatedText,
        },
      ],
    };

    return {
      type: TranslationType.DeepLX,
      result: deepLXResult,
      translations: translatedText.split("\n"),
      queryWordInfo,
    };
  }
}
