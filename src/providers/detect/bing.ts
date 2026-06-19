/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";

import { userAgent } from "@/constants";
import type { DetectedLangModel } from "@/core/detect/types";
import { LanguageDetectType } from "@/core/detect/types";
import { autoDetectLanguageItem, englishLanguageItem } from "@/core/language/consts";
import { bingMap, getYoudaoLangCode } from "@/core/language/utils";
import type { QueryResponse } from "@/types/queryResponse";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { BaseDetectProvider } from "./base";

interface BingConfig {
  IG: string;
  IID: string;
  key: string;
  token: string;
  expirationInterval: string;
  count: number;
}

interface BingTranslateResult {
  detectedLanguage: { language: string; score: number };
  translations: unknown[];
}

const bingConfigKey = "BingConfig";
const defaultBingHost = "www.bing.com";

let bingHost = defaultBingHost;
let bingConfig: BingConfig | undefined;

export class BingDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Bing;

  isEnabled(): boolean {
    return true;
  }

  protected async doDetect(text: string): Promise<DetectedLangModel> {
    logTrace("bing", "start BingDetectProvider.doDetect");

    const isExpired = await checkIfBingTokenExpired();
    if (isExpired) {
      bingConfig = await requestBingConfig();
    } else {
      const stored = await LocalStorage.getItem<string>(bingConfigKey);
      if (stored) {
        bingConfig = JSON.parse(stored) as BingConfig;
      }
    }

    if (!bingConfig) {
      throw new Error("Bing detect: failed to get config");
    }

    const { IID, IG, key, token, count } = bingConfig;
    const requestCount = count + 1;
    bingConfig.count = requestCount;
    LocalStorage.setItem(bingConfigKey, JSON.stringify(bingConfig));

    const data = {
      text,
      fromLang: autoDetectLanguageItem.bingLangCode,
      to: englishLanguageItem.bingLangCode,
      token,
      key,
    };

    const IIDString = `${IID}.${requestCount}`;
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
      bingHost = newHost;
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
    logTrace("bing", `detected: ${detectedLanguageCode}`);

    return {
      type: LanguageDetectType.Bing,
      sourceLangCode: detectedLanguageCode,
      youdaoLangCode,
      confirmed: false,
      result: bingResult as QueryResponse,
    };
  }
}

async function requestBingConfig(): Promise<BingConfig | undefined> {
  const url = `https://${bingHost}/translator`;
  const response = await timedFetch.raw(url, {
    headers: { "User-Agent": userAgent },
    responseType: "text",
  });

  const html = response._data as string;
  const IG = html.match(/IG:"(.*?)"/)?.[1];
  const IID = html.match(/data-iid="(.*?)"/)?.[1];
  const params_AbusePreventionHelper = html.match(/var params_AbusePreventionHelper = (.*?);/)?.[1];

  if (IG && params_AbusePreventionHelper) {
    const paramsArray = JSON.parse(params_AbusePreventionHelper);
    const [key, token, expirationInterval] = paramsArray;
    const config: BingConfig = {
      IG,
      IID: IID || "translator.5023",
      key,
      token,
      expirationInterval,
      count: 1,
    };
    bingConfig = config;
    LocalStorage.setItem(bingConfigKey, JSON.stringify(config));
    return config;
  }

  bingHost = new URL(response.url).host;
  try {
    return await requestBingConfig();
  } catch {
    return undefined;
  }
}

async function checkIfBingTokenExpired(): Promise<boolean> {
  const value = await LocalStorage.getItem<string>(bingConfigKey);
  if (!value) {
    requestBingConfig();
    return true;
  }

  const config = JSON.parse(value) as BingConfig;
  const { key, expirationInterval } = config;
  const tokenStartTime = parseInt(key);
  const expiration = parseInt(expirationInterval);
  const tokenUsedTime = Date.now() - tokenStartTime;
  const isExpired = tokenUsedTime > expiration;
  if (isExpired) {
    requestBingConfig();
  } else {
    bingConfig = config;
    if (tokenUsedTime > expiration / 2) {
      requestBingConfig();
    }
  }
  return isExpired;
}
