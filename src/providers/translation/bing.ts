/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";

import { userAgent } from "@/constants";
import { getLangCode } from "@/core/language/utils";
import { myPreferences } from "@/preferences";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

interface BingConfig {
  IG: string;
  IID: string;
  key: string;
  token: string;
  expirationInterval: string;
  count: number;
}

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

logTrace("bing", "module loaded");

const bingConfigKey = "BingConfig";
let bingConfig: BingConfig | undefined;

const defaultBingHost = "www.bing.com";

// * bing host depends ip, if ip is in china, `must` use cn.bing.com, otherwise use www.bing.com. And vice versa.
let bingHost: string = myPreferences.bingHost || defaultBingHost;

let retryCount = 0;

/**
 * Request Microsoft Bing Web Translator.
 */
export class BingTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Bing;

  protected async doTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
    const { fromLanguage, toLanguage, word } = queryWordInfo;
    const fromLang = getLangCode(fromLanguage, "bingLangCode") ?? "";
    const toLang = getLangCode(toLanguage, "bingLangCode") ?? "";

    const isExpired = await checkIfBingTokenExpired();
    logTrace("bing", `token expired: ${isExpired}`);

    if (isExpired) {
      logTrace("bing", "token expired, request new one");
      bingConfig = await requestBingConfig();
    } else {
      const storedBingConfig = await LocalStorage.getItem<string>(bingConfigKey);
      if (storedBingConfig) {
        bingConfig = JSON.parse(storedBingConfig) as BingConfig;
        logTrace("bing", `use stored bingConfig, IG: ${bingConfig.IG}`);
      }
    }

    if (!bingConfig) {
      logError("bing", "get bingConfig failed");
      throw new RequestError(TranslationType.Bing, "Get bing config failed");
    }

    const { IID, IG, key, token, count } = bingConfig;
    const requestCount = count + 1;
    bingConfig.count = requestCount;
    LocalStorage.setItem(bingConfigKey, JSON.stringify(bingConfig));

    const data = {
      text: word,
      fromLang: fromLang,
      to: toLang,
      token: token,
      key: key,
    };

    const IIDString = `${IID}.${requestCount}`;

    const url = `https://${bingHost}/ttranslatev3?isVertical=1&IG=${IG}&IID=${IIDString}`;
    logTrace("bing", `url: ${url}`);

    const { url: finalUrl, data: responseData } = await this.makeRequest(url, data, signal);

    // Get new host
    const newBingHost = new URL(finalUrl).host;
    // If bing translate response is empty, may be ip has been changed, bing tld is not correct, so check ip again, then request again.
    if (!responseData) {
      if (bingHost !== newBingHost && retryCount < 3) {
        logWarn(
          "bing",
          `translate response is empty, change to use new host: ${bingHost}, then request again, retryCount: ${retryCount}`,
        );
        retryCount++;
        const newConfig = await requestBingConfig();
        if (newConfig) {
          return this.doTranslate(queryWordInfo, { signal });
        }
        throw new RequestError(TranslationType.Bing, "Bing translate response is empty");
      }
      throw new RequestError(TranslationType.Bing, "Bing translate response is empty");
    }

    retryCount = 0;

    const responseArray = responseData as unknown[];
    const bingTranslateResult = responseArray[0] as BingTranslateResult | undefined;
    if (!bingTranslateResult?.translations?.length) {
      throw new RequestError(TranslationType.Bing, "Bing translate response is invalid");
    }

    const translations = bingTranslateResult.translations[0].text.split("\n");
    const detectedLanguage = bingTranslateResult.detectedLanguage?.language;
    const toLangResult = bingTranslateResult.translations[0].to;
    logTrace("bing", `translate: ${translations}, from: ${detectedLanguage} -> ${toLangResult}`);

    return {
      type: TranslationType.Bing,
      queryWordInfo,
      result: bingTranslateResult,
      translations,
    };
  }

  private async makeRequest(
    requestUrl: string,
    data: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<{ url: string; data: unknown }> {
    const response = await timedFetch.raw(requestUrl, {
      method: "POST",
      body: new URLSearchParams(data).toString(),
      headers: {
        "User-Agent": userAgent,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
      signal,
    });

    const finalUrl = response.url;

    logTrace("bing", `finalUrl: ${finalUrl}`);

    // Handle redirect manually - POST body needs to be resent
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get("location");
      if (redirectUrl) {
        logTrace("bing", `redirect to: ${redirectUrl}`);
        return this.makeRequest(redirectUrl, data, signal);
      }
    }

    return { url: finalUrl, data: response._data };
  }
}

/**
 * Request Bing Translator API Token from web, and store it.
 *
 * Ref: https://github.com/plainheart/bing-translate-api/blob/master/src/index.js
 */
async function requestBingConfig(): Promise<BingConfig | undefined> {
  logTrace("bing", "start requestBingConfig");
  logTrace("bing", `config bingTld: ${bingHost}`);

  const url = `https://${bingHost}/translator`;
  logTrace("bing", `get config url: ${url}`);

  const response = await timedFetch.raw(url, {
    headers: { "User-Agent": userAgent },
    responseType: "text",
  });

  const html = response._data as string;
  const config = parseBingConfig(html);

  if (config) {
    bingConfig = config;
    logTrace("bing", `getBingConfig from web, IG: ${config.IG}`);
    LocalStorage.setItem(bingConfigKey, JSON.stringify(config));
    return config;
  } else {
    logWarn("bing", `parse config failed, html: ${html}`);
    logTrace("bing", "try check if ip in china");

    const finalUrl = response.url;
    bingHost = new URL(finalUrl).host;

    logWarn("bing", `get config failed, host: ${bingHost}, change host, then request again`);
    try {
      return await requestBingConfig();
    } catch {
      return undefined;
    }
  }
}

/**
 * Parse bing config from html.
 */
function parseBingConfig(html: string): BingConfig | undefined {
  // IG:"C064D2C8D4F84111B96C9F14E2F5CE07"
  const IG = html.match(/IG:"(.*?)"/)?.[1];
  // data-iid="translator.5023"
  const IID = html.match(/data-iid="(.*?)"/)?.[1];
  // var params_AbusePreventionHelper = [1663259642763, "ETrbGhqGa5PwV8WL3sTYSBxsYRagh5bl", 3600000, true, null, false, "必应翻译", false, false, null, null];
  const params_AbusePreventionHelper = html.match(/var params_AbusePreventionHelper = (.*?);/)?.[1];
  if (IG && params_AbusePreventionHelper) {
    const paramsArray = JSON.parse(params_AbusePreventionHelper);
    const [key, token, expirationInterval] = paramsArray;
    const config: BingConfig = {
      IG: IG,
      IID: IID || "translator.5023",
      key: key,
      token: token,
      expirationInterval: expirationInterval,
      count: 1,
    };

    bingConfig = config;
    LocalStorage.setItem(bingConfigKey, JSON.stringify(config));
    return config;
  }
}

/**
 * Check if token expired, if expired, get a new one. else use the stored one as bingConfig.
 */
async function checkIfBingTokenExpired(): Promise<boolean> {
  logTrace("bing", "check if token expired");
  const value = await LocalStorage.getItem<string>(bingConfigKey);
  if (!value) {
    requestBingConfig();
    return true;
  }

  const config = JSON.parse(value) as BingConfig;
  const { key, expirationInterval } = config;
  const tokenStartTime = parseInt(key);
  const expiration = parseInt(expirationInterval);
  // default expiration is 10 min, for better experience, we get a new token after 5 min.
  const tokenUsedTime = Date.now() - tokenStartTime;
  const isExpired = tokenUsedTime > expiration;
  if (isExpired) {
    logTrace("bing", "token expired, request new one");
    requestBingConfig();
  } else {
    bingConfig = config;
    if (tokenUsedTime > expiration / 2) {
      requestBingConfig();
    }
  }
  return isExpired;
}
