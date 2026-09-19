/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { autoDetectLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { bingMap, getYoudaoLangCode } from "@/core/language/utils";
import { LanguageDetectType } from "@/core/results/kinds";
import { requestBing } from "@/providers/shared/bing-request";

import type { DetectOptions } from "./base";
import { BaseDetectProvider } from "./base";

interface BingTranslateResult {
  detectedLanguage: { language: string; score: number };
  translations: unknown[];
}

export class BingDetectProvider extends BaseDetectProvider<BingTranslateResult> {
  type = LanguageDetectType.Bing;

  isEnabled(): boolean {
    return true;
  }

  protected async doDetect(text: string, options?: DetectOptions) {
    const { data: responseData } = await requestBing({
      text,
      fromLang: autoDetectLanguageItem.bingLangCode,
      to: englishLanguageItem.bingLangCode,
      signal: options?.signal,
    });

    if (!responseData) {
      throw new Error("Bing detect: empty response");
    }

    const responseArray = responseData as unknown[];
    const bingResult = responseArray[0] as BingTranslateResult | undefined;
    if (!bingResult?.detectedLanguage?.language) {
      throw new Error("Bing detect: invalid response");
    }

    const detectedLanguageCode = bingResult.detectedLanguage.language;
    const youdaoLangCode = getYoudaoLangCode(detectedLanguageCode, bingMap);

    return {
      type: LanguageDetectType.Bing,
      sourceLangCode: detectedLanguageCode,
      youdaoLangCode,
      confirmed: false,
      result: bingResult,
    };
  }
}
