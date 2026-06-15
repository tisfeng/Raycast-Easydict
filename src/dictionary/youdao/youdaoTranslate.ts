import { timedFetch } from "@/fetchConfig";
import crypto from "node:crypto";
import { userAgent } from "@/consts";
import { logTrace, logError, logWarn } from "@/devLog";
import { QueryType, QueryTypeResult, QueryWordInfo, RequestErrorInfo, TranslationType } from "@/types";
import { getErrorMessage } from "@/utils";
import { YoudaoKey } from "@/dictionary/youdao/key.type";
import { TranslateParams, YoudaoTranslateResponse } from "@/dictionary/youdao/translate.type";
import { isValidYoudaoWebTranslateLanguage } from "@/dictionary/youdao/utils";

export async function requestYoudaoWebTranslate(
  queryWordInfo: QueryWordInfo,
  queryType?: QueryType,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("youdaoTranslate", `start requestYoudaoWebTranslate: ${queryWordInfo.word}`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;

  const type = queryType ?? TranslationType.Youdao;
  const isValidLanguage = isValidYoudaoWebTranslateLanguage(queryWordInfo);

  let youdaoKey: YoudaoKey | null = null;
  try {
    youdaoKey = await getYoudaoKey();
  } catch (error) {
    logError("youdaoTranslate", `failed to get Youdao key: ${error}`);
    return Promise.reject({
      type: type,
      message: getErrorMessage(error),
      code: "KEY_ERROR",
    } as RequestErrorInfo);
  }

  if (!isValidLanguage) {
    logWarn("youdaoTranslate", `invalid Youdao web translate language: ${fromLanguage} --> ${toLanguage}`);
    return Promise.reject({
      type: type,
      message: `Unsupported language pair: ${fromLanguage} -> ${toLanguage}`,
      code: "INVALID_LANGUAGE",
    } as RequestErrorInfo);
  }

  try {
    const translateResponse = await webTranslate(word, fromLanguage, toLanguage, youdaoKey, signal);
    const translations = translateResponse.translateResult.map((e: Array<{ tgt: string }>) =>
      e.map((t) => t.tgt).join(""),
    );
    logTrace("youdaoTranslate", `translate result: ${translations.join("\n")}`);

    return {
      type: type,
      result: translateResponse,
      translations: translations,
      queryWordInfo: queryWordInfo,
    };
  } catch (error) {
    const errorInfo = error as RequestErrorInfo;
    if (errorInfo.type && errorInfo.message) {
      logError("youdaoTranslate", `failed to translate: ${errorInfo.message}`);
      return Promise.reject(errorInfo);
    }
    const message = getErrorMessage(error);
    logError("youdaoTranslate", `failed to translate: ${message}`);
    return Promise.reject({
      type: type,
      message: message,
      code: "TRANSLATE_ERROR",
    } as RequestErrorInfo);
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

  try {
    const response = await timedFetch<YoudaoKey>("https://dict.youdao.com/webtranslate/key", {
      params,
      headers: {
        Origin: "https://fanyi.youdao.com",
      },
    });

    if (response.code !== 0) {
      return Promise.reject({
        type: TranslationType.Youdao,
        message: `Failed to get Youdao key: code=${response.code}, msg=${response.msg}`,
        code: "KEY_ERROR",
      } as RequestErrorInfo);
    }

    return response;
  } catch (error) {
    return Promise.reject({
      type: TranslationType.Youdao,
      message: `An unknown error occurred while getting Youdao key: ${error}`,
      code: "UNKNOWN_ERROR",
    } as RequestErrorInfo);
  }
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

  try {
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
      return Promise.reject({
        type: TranslationType.Youdao,
        message: "Failed to decrypt response data",
        code: "DECRYPT_ERROR",
      } as RequestErrorInfo);
    }

    return JSON.parse(decryptedData);
  } catch (error) {
    const message = getErrorMessage(error);
    const isTooLong = message.includes("400") || message.includes("length");
    return Promise.reject({
      type: TranslationType.Youdao,
      message: isTooLong ? "Text too long for Youdao translate" : `Youdao translate failed: ${message}`,
      code: isTooLong ? "TEXT_TOO_LONG" : "UNKNOWN_ERROR",
    } as RequestErrorInfo);
  }
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
