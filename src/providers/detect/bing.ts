/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { userAgent } from "@/consts";
import { autoDetectLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { bingMap, getYoudaoLangCode } from "@/core/language/utils";
import { ensureBingConfig, getBingHost, incrementBingConfigCount } from "@/providers/shared/bing-config";
import { LanguageDetectType } from "@/types/api";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

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

  protected async doDetect(text: string) {
    const bingConfig = await ensureBingConfig();
    const { IG, key, token } = bingConfig;
    const IIDString = incrementBingConfigCount();

    const data = {
      text,
      fromLang: autoDetectLanguageItem.bingLangCode,
      to: englishLanguageItem.bingLangCode,
      token,
      key,
    };

    const bingHost = getBingHost();
    const url = `https://${bingHost}/ttranslatev3?isVertical=1&IG=${IG}&IID=${IIDString}`;

    const response = await timedFetch.raw(url, {
      method: "POST",
      body: new URLSearchParams(data).toString(),
      headers: {
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
    });

    const finalUrl = response.url;
    const newHost = new URL(finalUrl).host;
    if (newHost !== bingHost) {
      // Host mismatch detected; shared module handles host switching on next request.
    }

    const responseData = response._data;
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
    logTrace(this.type, `detected: ${detectedLanguageCode}`);

    return {
      type: LanguageDetectType.Bing,
      sourceLangCode: detectedLanguageCode,
      youdaoLangCode,
      confirmed: false,
      result: bingResult,
    };
  }
}
