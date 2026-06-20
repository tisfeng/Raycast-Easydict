/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import crypto from "node:crypto";

import { userAgent } from "@/consts";
import { getLanguageOfTwoExceptChinese } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo, RequestOptions } from "@/types/query";
import { RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

interface TranslateParams {
  keyid: string;
  client: string;
  product: string;
  appVersion: string;
  vendor: string;
  pointParam: string;
  mysticTime: string;
  keyfrom: string;
  sign: string;
  i?: string;
  from?: string;
  to?: string;
  dictResult?: string;
}

interface YoudaoTranslateResponse {
  code: number;
  translateResult: { tgt: string; src: string }[][];
  type: string;
}

interface YoudaoKey {
  data: {
    secretKey: string;
    aesKey: string;
    aesIv: string;
  };
  code: number;
  msg: string;
}

/**
 * Check is valid Youdao web translate language.
 *
 * See: https://fanyi.youdao.com/
 */
function isValidYoudaoWebTranslateLanguage(queryTextInfo: QueryWordInfo): boolean {
  const { fromLanguage, toLanguage } = queryTextInfo;
  const targetLanguage = getLanguageOfTwoExceptChinese([fromLanguage, toLanguage]);
  if (!targetLanguage) {
    return false;
  }

  // * Note: Youdao web translate only support Chinese <--> validLanguages
  const validLanguages = ["en", "ja", "ko", "fr", "de", "ru", "es", "it", "ar", "nl", "th"];
  return validLanguages.includes(targetLanguage);
}

export class YoudaoTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Youdao;

  protected async doTranslate(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}): Promise<QueryTypeResult> {
    const { fromLanguage, toLanguage, word } = queryWordInfo;

    const isValidLanguage = isValidYoudaoWebTranslateLanguage(queryWordInfo);

    const youdaoKey = await getYoudaoKey();

    if (!isValidLanguage) {
      logWarn("youdaoTranslate", `invalid Youdao web translate language: ${fromLanguage} --> ${toLanguage}`);
      throw {
        type: TranslationType.Youdao,
        message: `Unsupported language pair: ${fromLanguage} -> ${toLanguage}`,
        code: "INVALID_LANGUAGE",
      } as RequestError;
    }

    const translateResponse = await webTranslate(word, fromLanguage, toLanguage, youdaoKey, signal);
    const translations = translateResponse.translateResult.map((e: Array<{ tgt: string }>) =>
      e.map((t) => t.tgt).join(""),
    );
    logTrace("youdaoTranslate", `translate result: ${translations.join("\n")}`);

    return {
      type: TranslationType.Youdao,
      translations,
      queryWordInfo,
    };
  }
}

// get Youdao key. Refer: https://github.com/HolynnChen/somejs/blob/5c74682faccaa17d52740e7fe285d13de3c32dba/translate.js#L717
async function getYoudaoKey(): Promise<YoudaoKey> {
  const ts: string = String(new Date().getTime());
  const params: TranslateParams = {
    keyid: "webfanyi-key-getter",
    client: "fanyideskweb",
    product: "webfanyi",
    appVersion: "1.0.0",
    vendor: "web",
    pointParam: "client,mysticTime,product",
    mysticTime: ts,
    keyfrom: "fanyi.web",
    sign: crypto
      .createHash("md5")
      .update(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=asdjnjfenknafdfsdfsd`)
      .digest("hex"),
  };

  const response = await timedFetch<YoudaoKey>("https://dict.youdao.com/webtranslate/key", {
    params,
    headers: {
      Origin: "https://fanyi.youdao.com",
    },
  });

  if (response.code !== 0) {
    throw {
      type: TranslationType.Youdao,
      message: `Failed to get Youdao key: code=${response.code}, msg=${response.msg}`,
      code: "KEY_ERROR",
    } as RequestError;
  }

  return response;
}

/// New Youdao web translate function, 2025.1.12
async function webTranslate(
  text: string,
  from: string,
  to: string,
  youdaoKey: YoudaoKey,
  signal?: AbortSignal,
): Promise<YoudaoTranslateResponse> {
  const { secretKey, aesKey, aesIv } = youdaoKey.data;

  const ts: string = String(new Date().getTime());
  const sign = crypto
    .createHash("md5")
    .update(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=${secretKey}`)
    .digest("hex");
  const params: TranslateParams = {
    keyid: "webfanyi",
    client: "fanyideskweb",
    product: "webfanyi",
    appVersion: "1.0.0",
    vendor: "web",
    pointParam: "client,mysticTime,product",
    mysticTime: ts,
    keyfrom: "fanyi.web",
    sign: sign,
    i: text,
    from: from,
    to: to,
  };

  const response = await timedFetch("https://dict.youdao.com/webtranslate", {
    method: "POST",
    params,
    headers: {
      Referer: "https://fanyi.youdao.com/",
      UserAgent: userAgent,
      Cookie: "OUTFOX_SEARCH_USER_ID=1796239350@10.110.96.157;",
    },
    responseType: "text",
    signal,
  });

  const decryptedData = decryptAES(response, aesKey, aesIv);
  if (!decryptedData) {
    throw new RequestError(TranslationType.Youdao, "Failed to decrypt response data", "DECRYPT_ERROR");
  }

  return JSON.parse(decryptedData);
}

function md5Hex(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

function decryptAES(text: string, key: string, iv: string): string | null {
  if (!text) {
    return null;
  }

  text = text.replace(/-/g, "+").replace(/_/g, "/");

  const a = Buffer.from(md5Hex(key), "hex");
  const r = Buffer.from(md5Hex(iv), "hex");

  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", a, r);
    const decrypted = decipher.update(text, "base64", "utf8") + decipher.final("utf8");
    return decrypted;
  } catch {
    logError("youdaoTranslate", "decryption error");
    return null;
  }
}
