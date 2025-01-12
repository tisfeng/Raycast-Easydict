import axios, { AxiosError } from "axios";
import CryptoJS from "crypto-js";
import { userAgent } from "../../consts";
import { QueryType, QueryTypeResult, QueryWordInfo, TranslationType } from "../../types";
import { YoudaoKey } from "./key.type";
import { TranslateParams, YoudaoTranslateResponse } from "./translate.type";
import { isValidYoudaoWebTranslateLanguage } from "./utils";

export async function requestYoudaoWebTranslate(
  queryWordInfo: QueryWordInfo,
  queryType?: QueryType
): Promise<QueryTypeResult> {
  console.log(`---> start requestYoudaoWebTranslate: ${queryWordInfo.word}`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;

  const type = queryType ?? TranslationType.Youdao;
  const isValidLanguage = isValidYoudaoWebTranslateLanguage(queryWordInfo);

  const youdaoKey = await getYoudaoKey();
  console.log(`youdaoKey: ${JSON.stringify(youdaoKey, null, 4)}`);

  if (!isValidLanguage || !youdaoKey) {
    if (!youdaoKey) {
      console.error(`---> Youdao web translate error: no Youdao Key`);
    }
    if (!isValidLanguage) {
      console.warn(`---> invalid Youdao web translate language: ${fromLanguage} --> ${toLanguage}`);
    }
    const undefinedResult: QueryTypeResult = {
      type: type,
      result: undefined,
      queryWordInfo: queryWordInfo,
      translations: [],
    };
    return Promise.resolve(undefinedResult);
  }

  const translateResponse = await webTranslate(word, fromLanguage, toLanguage, youdaoKey);

  const translations = translateResponse.translateResult.map((e: Array<{ tgt: string }>) =>
    e.map((t) => t.tgt).join("")
  );
  console.log(`---> translations: ${translations}`);

  const result: QueryTypeResult = {
    type: type,
    result: translateResponse,
    translations: translations,
    queryWordInfo: queryWordInfo,
  };
  console.log(`---> end requestYoudaoTranslate: ${queryWordInfo.word}`);
  return result;
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
    sign: CryptoJS.MD5(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=asdjnjfenknafdfsdfsd`).toString(),
  };

  try {
    const response = await axios.get<YoudaoKey>("https://dict.youdao.com/webtranslate/key", {
      params,
      headers: {
        Origin: "https://fanyi.youdao.com",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to get Youdao key: ${error.message}`);
    }
    throw error;
  }
}

async function webTranslate(
  text: string,
  from: string,
  to: string,
  youdaoKey: YoudaoKey
): Promise<YoudaoTranslateResponse> {
  const { secretKey, aesKey, aesIv } = youdaoKey.data;

  const ts: string = String(new Date().getTime());
  const sign = CryptoJS.MD5(`client=fanyideskweb&mysticTime=${ts}&product=webfanyi&key=${secretKey}`).toString();
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

  console.log(`---> youdao web translate params: ${JSON.stringify(params, null, 4)}`);

  try {
    const response = await axios.post("https://dict.youdao.com/webtranslate", null, {
      params,
      headers: {
        Referer: "https://fanyi.youdao.com/",
        UserAgent: userAgent,
        Cookie: "OUTFOX_SEARCH_USER_ID=1796239350@10.110.96.157;",
      },
    });

    console.log(`---> youdao web translate response: ${JSON.stringify(response.data, null, 4)}`);

    const decryptedData = decryptAES(response.data, aesKey, aesIv);
    if (!decryptedData) {
      throw new Error("Failed to decrypt response data");
    }

    console.log(`---> youdao web translate decrypted data: ${decryptedData}`);

    return JSON.parse(decryptedData);
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to translate: ${error.message}`);
    }
    throw error;
  }
}

function m(e: string): string {
  return CryptoJS.MD5(e).toString(CryptoJS.enc.Hex);
}

function decryptAES(text: string, key: string, iv: string): string | null {
  console.log("---> Start decrypting...");
  console.log("---> Input data:", text);

  if (!text) {
    return null;
  }

  text = text.replace(/-/g, "+").replace(/_/g, "/");
  console.log("---> After replace:", text);

  const a = CryptoJS.enc.Hex.parse(m(key));
  const r = CryptoJS.enc.Hex.parse(m(iv));

  try {
    const i = CryptoJS.AES.decrypt(text, a, {
      iv: r,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const result = i.toString(CryptoJS.enc.Utf8);
    console.log("---> Decryption result:", result);
    return result;
  } catch (error) {
    console.error("---> Decryption error:", error);
    return null;
  }
}
