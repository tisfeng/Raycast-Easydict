/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/core/results/kinds";
import type { QueryInput, RequestOptions, TranslationResult } from "@/core/results/types";
import { getBingHost, requestBingConfig } from "@/providers/shared/bing-config";
import { requestBing } from "@/providers/shared/bing-request";
import { RequestError } from "@/utils/errors";
import { logWarn } from "@/utils/logger";

import { BaseNonStreamingTranslateProvider } from "./base";

export interface BingTranslateResult {
  detectedLanguage: BingDetectedLanguage;
  translations: BingTranslation[];
}

interface BingDetectedLanguage {
  language: string;
  score: number;
}

interface BingTranslation {
  text: string;
  to: string;
  sentLen: BingSentLen;
  transliteration?: BingTransliteration;
}

interface BingSentLen {
  srcSentLen: number[];
  transSentLen: number[];
}

interface BingTransliteration {
  script: string;
  text: string;
}

/**
 * Request Microsoft Bing Web Translator.
 */
export class BingTranslateProvider extends BaseNonStreamingTranslateProvider {
  type = TranslationType.Bing;

  protected async doTranslate(queryWordInfo: QueryInput, options: RequestOptions = {}): Promise<TranslationResult> {
    return this.doTranslateInternal(queryWordInfo, options, 0);
  }

  private async doTranslateInternal(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
    retryCount: number,
  ): Promise<TranslationResult> {
    const { fromLanguage, toLanguage, word } = queryWordInfo;
    const fromLang = getLangCode(fromLanguage, "bingLangCode") ?? "";
    const toLang = getLangCode(toLanguage, "bingLangCode") ?? "";

    const { url: finalUrl, data: responseData } = await requestBing({
      text: word,
      fromLang,
      to: toLang,
      signal,
    });

    // Get new host
    const newBingHost = new URL(finalUrl).host;
    const currentBingHost = getBingHost();
    // If bing translate response is empty, may be ip has been changed, bing tld is not correct, so check ip again, then request again.
    if (!responseData) {
      if (currentBingHost !== newBingHost && retryCount < 3) {
        logWarn(
          this.type,
          `translate response is empty, change to use new host: ${currentBingHost}, then request again, retryCount: ${retryCount}`,
        );
        const newConfig = await requestBingConfig();
        if (newConfig) {
          return this.doTranslateInternal(queryWordInfo, { signal }, retryCount + 1);
        }
        throw new RequestError(TranslationType.Bing, "Bing translate response is empty");
      }
      throw new RequestError(TranslationType.Bing, "Bing translate response is empty");
    }

    const responseArray = responseData as unknown[];
    const bingTranslateResult = responseArray[0] as BingTranslateResult | undefined;
    if (!bingTranslateResult?.translations?.length) {
      throw new RequestError(TranslationType.Bing, "Bing translate response is invalid");
    }

    const translations = bingTranslateResult.translations[0].text.split("\n");

    return {
      type: TranslationType.Bing,
      queryWordInfo,
      result: bingTranslateResult,
      translations,
    };
  }
}
