/*
 * @author: tisfeng
 * @createTime: 2022-08-05 16:09
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-15 18:10
 * @fileName: google.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import googleTranslateApi from "@vitalets/google-translate-api";
import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { HttpsProxyAgent } from "https-proxy-agent";
import querystring from "node:querystring";
import { requestCostTime } from "../axiosConfig";
import { userAgent } from "../consts";
import { checkIfPreferredLanguagesContainedChinese } from "../detectLanauge/utils";
import { QueryWordInfo } from "../dict/youdao/types";
import { getGoogleLanguageId } from "../language/languages";
import { RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";
import { LanguageDetectType, LanguageDetectTypeResult } from "./../detectLanauge/types";
import { GoogleTranslateResult } from "./../types";

export async function requestGoogleTranslate(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Google`);
  const tld = await getTld();
  queryWordInfo.tld = tld;

  // googleWebTranslate(queryWordInfo, signal);
  return googleRPCTranslate(queryWordInfo, signal);
}

/**
 * Google RPC translate, can get richer word dictionary and automatic recognition feature.
 *
 * * Google RPC cost more time than web translate. almost 1s > 0.3s.
 */
async function googleRPCTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal): Promise<RequestTypeResult> {
  const fromLanguageId = getGoogleLanguageId(queryWordInfo.fromLanguage);
  const toLanguageId = getGoogleLanguageId(queryWordInfo.toLanguage);
  const tld = queryWordInfo.tld ?? (await getTld());
  queryWordInfo.tld = tld;

  const proxy = process.env.PROXY || undefined;
  const httpsAgent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  // console.warn(`---> proxy: ${proxy}, httpsAgent: ${JSON.stringify(httpsAgent, null, 4)}`);

  return new Promise((resolve, reject) => {
    const startTime = new Date().getTime();
    googleTranslateApi(
      queryWordInfo.word,
      { from: fromLanguageId, to: toLanguageId, tld: tld },
      { signal, agent: httpsAgent }
    )
      .then((res) => {
        console.warn(`---> Google RPC translate: ${res.text}, cost ${new Date().getTime() - startTime} ms`);
        const result: RequestTypeResult = {
          type: TranslationType.Google,
          result: res,
          translations: res.text.split("\n"),
        };
        resolve(result);
      })
      .catch((error) => {
        // * got use a different error meassage from axios.
        if (error.message === "The operation was aborted") {
          console.log(`---> google rpc aborted`);
          return;
        }

        console.error(`googleRPCTranslate error: ${JSON.stringify(error, null, 4)}`);
        const errorInfo: RequestErrorInfo = {
          type: TranslationType.Google,
          message: "Google RPC translate error",
        };
        reject(errorInfo);
      });
  });
}

/**
 * Google language detect.
 */
export async function googleLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  console.log(`---> start Google language detect: ${text}`);
  const startTime = new Date().getTime();
  const queryWord: QueryWordInfo = {
    word: text,
    fromLanguage: "auto",
    toLanguage: "en",
  };

  try {
    const googleTypeResult = await googleRPCTranslate(queryWord, new AbortController().signal);
    const googleResult = googleTypeResult.result as GoogleTranslateResult;
    const googleDetectLanaugeId = googleResult.from.language.iso;
    const youdaoLanguageId = getGoogleLanguageId(googleDetectLanaugeId);
    console.warn(
      `---> Google detect language: ${googleDetectLanaugeId}, youdaoId: ${youdaoLanguageId}, cost ${
        new Date().getTime() - startTime
      } ms`
    );
    const languagedDetectResult: LanguageDetectTypeResult = {
      type: LanguageDetectType.Google,
      sourceLanguageId: googleDetectLanaugeId,
      youdaoLanguageId: youdaoLanguageId,
      confirmed: true,
      result: googleResult,
    };
    return Promise.resolve(languagedDetectResult);
  } catch (error) {
    console.error(`googleLanguageDetect error: ${JSON.stringify(error)}`);
    const errorInfo = error as RequestErrorInfo;
    errorInfo.type = LanguageDetectType.Google;
    return Promise.reject(errorInfo);
  }
}

/**
 * Use crawler to get google web translate. Only simple translate result.
 *
 * From https://github.com/roojay520/bobplugin-google-translate/blob/master/src/google-translate-mobile.ts
 */
export async function googleWebTranslate(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  const fromLanguageId = getGoogleLanguageId(queryWordInfo.fromLanguage);
  const toLanguageId = getGoogleLanguageId(queryWordInfo.toLanguage);
  const data = {
    sl: fromLanguageId, // source language
    tl: toLanguageId, // target language
    hl: toLanguageId, // hope language? web ui language
    q: queryWordInfo.word, // query word
  };
  const tld = queryWordInfo.tld ?? (await getTld());
  queryWordInfo.tld = tld;

  const headers = {
    "User-Agent": userAgent,
  };
  const url = `https://translate.google.${tld}/m?${querystring.stringify(data)}`;
  console.log(`---> google url: ${url}`); // https://translate.google.cn/m?sl=auto&tl=zh-CN&hl=zh-CN&q=good

  return new Promise<RequestTypeResult>((resolve, reject) => {
    axios
      .get(url, { headers, signal })
      .then((res: AxiosResponse) => {
        const hmlt = res.data;
        const $ = cheerio.load(hmlt);

        // <div class="result-container">好的</div>
        const translation = $(".result-container").text();
        const translations = translation.split("\n");
        console.warn(`---> google web translation: ${translation}, cost: ${res.headers["requestCostTime"]} ms`);
        const result: RequestTypeResult = {
          type: TranslationType.Google,
          result: { translatedText: translation },
          translations: translations,
        };
        resolve(result);
      })
      .catch((error) => {
        if (error.message === "canceled") {
          console.log(`---> google cancelled`);
          return;
        }
        console.error(`google web error: ${error}`);

        const errorInfo: RequestErrorInfo = {
          type: TranslationType.Google,
          message: "Google web translate error",
        };

        reject(errorInfo);
      });
  });
}

/**
 * Get tld. if user has preferred Chinese language or ip in China, use cn, else use com.
 */
async function getTld(): Promise<string> {
  let tld = "com"; // cn,com
  if (checkIfPreferredLanguagesContainedChinese() || (await checkIfIpInChina())) {
    tld = "cn";
    console.log(`---> China, or Chinese: ${checkIfPreferredLanguagesContainedChinese()}`);
  }
  console.log(`---> google tld: ${tld}`);
  return tld;
}

/**
 * Get current ip address
 */
export async function getCurrentIp(): Promise<string> {
  const url = "http://icanhazip.com/"; // from https://blog.csdn.net/uikoo9/article/details/113820051
  try {
    const res = await axios.get(url);
    const ip = res.data.trim();
    console.warn(`---> current ip: ${ip}, cost ${res.headers["requestCostTime"]} ms`);
    return Promise.resolve(ip);
  } catch (error) {
    console.error(`getCurrentIp error: ${error}`);
    return Promise.reject(error);
  }
}

/**
 *  Check if ip is in China
 *
 *  Todo: should store ip in LocalStorage.
 */
async function checkIfIpInChina(): Promise<boolean> {
  try {
    const ipInfo = await getCurrentIpInfo();
    const country = ipInfo.country;
    console.warn(`---> country: ${country}`);
    return Promise.resolve(country === "CN");
  } catch (error) {
    console.error(`checkIfIpInChina error: ${error}`);
    return Promise.resolve(true);
  }
}

/**
 * Get current ip info
 * curl https://ipinfo.io
{
  "ip": "120.240.53.42",
  "city": "Zhanjiang",
  "region": "Guangdong",
  "country": "CN",
  "loc": "21.2339,110.3875",
  "org": "AS9808 China Mobile Communications Group Co., Ltd.",
  "timezone": "Asia/Shanghai",
  "readme": "https://ipinfo.io/missingauth"
}
 */
async function getCurrentIpInfo() {
  try {
    const url = "https://ipinfo.io";
    const res = await axios.get(url);
    console.warn(`---> ip info: ${JSON.stringify(res.data, null, 4)}, cost ${res.headers[requestCostTime]} ms`);
    return Promise.resolve(res.data);
  } catch (error) {
    console.error(`getCurrentIp error: ${error}`);
    return Promise.reject(error);
  }
}
