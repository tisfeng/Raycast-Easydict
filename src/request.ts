import axios from "axios";
import crypto from "crypto";
import querystring from "node:querystring";
import { getLanguageItemFromYoudaoLanguageId, myPreferences } from "./utils";
import * as tencentcloud from "tencentcloud-sdk-nodejs-tmt";
import {
  LanguageDetectResponse,
  TextTranslateResponse,
} from "tencentcloud-sdk-nodejs-tmt/tencentcloud/services/tmt/v20180321/tmt_models";

const tencentSecretId = "AKIDHOIxOZUAalhNp2zh9LIzQbXEfroVxA8r";
const tencentSecretKey = "VkmY5NQEm47vTnVzEDxRgfOs89vSlpeF";
const tencentEndpoint = "tmt.tencentcloudapi.com";
const tencentRegion = "ap-guangzhou";
const tencentProjectId = 1258657901;
const TmtClient = tencentcloud.tmt.v20180321.Client;
const clientConfig = {
  credential: {
    secretId: tencentSecretId,
    secretKey: tencentSecretKey,
  },
  region: tencentRegion,
  profile: {
    httpProfile: {
      endpoint: tencentEndpoint,
    },
  },
};
const client = new TmtClient(clientConfig);

// 腾讯翻译，5次/秒
export function tencentTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<TextTranslateResponse> {
  const from =
    getLanguageItemFromYoudaoLanguageId(fromLanguage).tencentLanguageId ||
    "auto";
  const to =
    getLanguageItemFromYoudaoLanguageId(targetLanguage).tencentLanguageId;
  if (!to) {
    return Promise.reject(
      new Error("Target language is not supported by Tencent Translate")
    );
  }
  const params = {
    SourceText: queryText,
    Source: from,
    Target: to!,
    ProjectId: tencentProjectId,
  };
  return client.TextTranslate(params);
}

// 腾讯语种识别，5次/秒
export function tencentLanguageDetect(
  text: string
): Promise<LanguageDetectResponse> {
  const params = {
    Text: text,
    ProjectId: tencentProjectId,
  };
  return client.LanguageDetect(params);
}

// concurrent request for multiple translation interfaces
export function requestAllTranslateAPI(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  return axios.all([
    youdaoTextTranslate(queryText, fromLanguage, targetLanguage),
    baiduTextTranslate(queryText, fromLanguage, targetLanguage),
    caiyunTextTranslate(queryText, fromLanguage, targetLanguage),
  ]);
}

// API Document https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
export function youdaoTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  function truncate(q: string): string {
    const len = q.length;
    return len <= 20
      ? q
      : q.substring(0, 10) + len + q.substring(len - 10, len);
  }

  const appId = myPreferences.youdaoAppId;
  const appSecret = myPreferences.youdaoAppSecret;

  const sha256 = crypto.createHash("sha256");
  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const sha256Content =
    appId + truncate(queryText) + salt + timestamp + appSecret;
  const sign = sha256.update(sha256Content).digest("hex");
  const url = "https://openapi.youdao.com/api";

  console.log("requestYoudaoAPI");

  return axios.post(
    url,
    querystring.stringify({
      sign,
      salt,
      from: fromLanguage,
      signType: "v3",
      q: queryText,
      appKey: appId,
      curtime: timestamp,
      to: targetLanguage,
    })
  );
}

// 百度翻译API https://fanyi-api.baidu.com/doc/21
export function baiduTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  const appId = myPreferences.baiduAppId;
  const appSecret = myPreferences.baiduAppSecret;

  const md5 = crypto.createHash("md5");
  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = appId + queryText + salt + appSecret;
  const sign = md5.update(md5Content).digest("hex");
  const apiServer = "https://fanyi-api.baidu.com/api/trans/vip/translate";

  const from =
    getLanguageItemFromYoudaoLanguageId(fromLanguage).baiduLanguageId;
  const to =
    getLanguageItemFromYoudaoLanguageId(targetLanguage).baiduLanguageId;

  let encodeQueryText = encodeURIComponent(queryText);

  const url =
    apiServer +
    `?q=${encodeQueryText}&from=${from}&to=${to}&appid=${appId}&salt=${salt}&sign=${sign}`;

  return axios.get(url);
}

// 彩云小译 https://docs.caiyunapp.com/blog/2018/09/03/lingocloud-api/#python-%E8%B0%83%E7%94%A8
export function caiyunTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  const appToken = myPreferences.caiyunAppToken;

  const url = "https://api.interpreter.caiyunai.com/v1/translator";
  const from =
    getLanguageItemFromYoudaoLanguageId(fromLanguage).caiyunLanguageId ||
    "auto";
  const to =
    getLanguageItemFromYoudaoLanguageId(targetLanguage).caiyunLanguageId;
  const trans_type = `${from}2${to}`; // "auto2xx";

  // Note that Caiyun Xiaoyi only supports these types of translation at present.
  const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
  if (!supportedTranslatType.includes(trans_type) || !appToken.length) {
    return Promise.resolve(null);
  }

  return axios.post(
    url,
    {
      source: queryText,
      trans_type,
      detect: from === "auto",
    },
    {
      headers: {
        "content-type": "application/json",
        "x-authorization": "token " + appToken,
      },
    }
  );
}
