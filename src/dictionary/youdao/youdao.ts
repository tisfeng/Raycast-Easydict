/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-27 10:49
 * @fileName: youdao.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosError } from "axios";
import CryptoJS from "crypto-js";
import querystring from "node:querystring";
import util from "util";
import { downloadAudio, downloadWordAudioWithURL, getWordAudioPath, playWordAudio } from "../../audio";
import { requestCostTime } from "../../axiosConfig";
import { userAgent, YoudaoErrorCode } from "../../consts";
import { KeyStore } from "../../preferences";
import { DicionaryType, QueryTypeResult, RequestErrorInfo, TranslationType } from "../../types";
import { copyToClipboard, getTypeErrorInfo } from "../../utils";
import { formatYoudaoDictionaryResult } from "./formatData";
import { QueryWordInfo, YoudaoDictionaryResult, YoudaoWebTranslateResult } from "./types";

const youdaoTranslatURL = "https://fanyi.youdao.com";
let youdaoCookie =
  "OUTFOX_SEARCH_USER_ID=362474716@10.108.162.139; Domain=.youdao.com; Expires=Sat, 17-Aug-2052 15:39:50 GMT";

/**
 * Get youdao cookie from youdao web.
 */
axios.get(youdaoTranslatURL).then((response) => {
  if (response.headers["set-cookie"]) {
    youdaoCookie = response.headers["set-cookie"]?.join(";");
    console.warn(`youdaoCookie: ${youdaoCookie}`);
  }
});

/**
 * Max length of text to download youdao tts audio
 */
export const maxTextLengthOfDownloadYoudaoTTSAudio = 40;

/**
 * Youdao translate, use official API. Cost time: 0.2s
 *
 * * Note: max length of text to translate must <= 1000, otherwise, will get error: "103	翻译文本过长"
 *
 * 有道翻译 https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
 */
export function requestYoudaoDictionary(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  console.log(`---> start request Youdao`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  function truncate(q: string): string {
    const len = q.length;
    return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
  }
  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const youdaoAppId = KeyStore.youdaoAppId;
  const sha256Content = youdaoAppId + truncate(word) + salt + timestamp + KeyStore.youdaoAppSecret;
  const sign = CryptoJS.SHA256(sha256Content).toString();
  const url = youdaoAppId ? "https://openapi.youdao.com/api" : "https://aidemo.youdao.com/trans";
  const params = querystring.stringify({
    sign,
    salt,
    from: fromLanguage,
    signType: "v3",
    q: word,
    appKey: youdaoAppId,
    curtime: timestamp,
    to: toLanguage,
  });
  // console.log(`---> youdao params: ${params}`);

  requestYoudaoWebDictionary(queryWordInfo);

  requestYoudaoWebTranslate(queryWordInfo)
    .then((result) => {
      console.log(`---> youdao translate result: ${util.inspect(result)}`);
    })
    .catch((error) => {
      console.error(`---> youdao translate error: ${util.inspect(error)}`);
    });

  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
      .then((response) => {
        const youdaoResult = response.data as YoudaoDictionaryResult;
        // console.log(`---> youdao res: ${util.inspect(youdaoResult, { depth: null })}`);

        const errorInfo = getYoudaoErrorInfo(youdaoResult.errorCode);
        const youdaoFormatResult = formatYoudaoDictionaryResult(youdaoResult);

        if (!youdaoFormatResult) {
          console.error(`---> youdao error: ${util.inspect(youdaoResult, { depth: null })}`);
          reject(errorInfo);
          return;
        }

        // use Youdao dictionary check if query text is a word.
        queryWordInfo.isWord = youdaoResult.isWord;

        const youdaoTypeResult: QueryTypeResult = {
          type: TranslationType.Youdao,
          result: youdaoFormatResult,
          wordInfo: youdaoFormatResult.queryWordInfo,
          errorInfo: errorInfo,
          translations: youdaoFormatResult.translations,
        };
        console.warn(`---> Youdao translate cost: ${response.headers[requestCostTime]} ms`);
        resolve(youdaoTypeResult);
      })
      .catch((error: AxiosError) => {
        if (error.message === "canceled") {
          console.log(`---> youdao canceled`);
          return;
        }

        console.error(`---> Youdao translate error: ${error}`);

        // It seems that Youdao will never reject, always resolve...
        // ? Error: write EPROTO 6180696064:error:1425F102:SSL routines:ssl_choose_client_version:unsupported protocol:../deps/openssl/openssl/ssl/statem/statem_lib.c:1994:

        const errorInfo = getTypeErrorInfo(DicionaryType.Youdao, error);
        reject(errorInfo);
      });
  });
}

/**
 * Youdao web dictionary, zh <--> targetLanguage, supported target language: en, fr, ja, ko
 */
export function requestYoudaoWebDictionary(queryWordInfo: QueryWordInfo) {
  console.log(`---> start request Youdao`);
  const { fromLanguage, word } = queryWordInfo;
  const dicts = [
    [
      "longman",
      // "web_trans",
      // "video_sents",
      // "simple",
      // "phrs",
      // "syno",
      // "collins",
      // "word_video",
      // "discriminate",
      "ec",
      // "ee",
      // "blng_sents_part",
      // "individual",
      // "collins_primary",
      // "rel_word",
      // "auth_sents_part",
      // "media_sents_part",
      // "expand_ec",
      // "etym",
      // "special",
      // "baike",
      // "meta",

      // "senior",
      // "webster",
      // "oxford",
      // "oxfordAdvance",
      // "oxfordAdvanceHtml",
    ],
  ];

  // dicts: ["web_trans", "oxfordAdvanceHtml", "video_sents", "simple", "phrs", "oxford", "syno", "collins", "word_video", "webster", "discriminate", "ec", "ee", "blng_sents_part", "individual", "collins_primary", "rel_word", "auth_sents_part", "media_sents_part", "expand_ec", "etym", "special", "senior", "baike", "meta", "oxfordAdvance"]

  /**
   jsonversion: 2
client: mobile
q: good
dicts: {"count":99,"dicts":[["ec","ce","newcj","newjc","kc","ck","fc","cf","multle","jtj","pic_dict","tc","ct","typos","special","tcb","baike","lang","simple","wordform","exam_dict","ctc","web_search","auth_sents_part","ec21","phrs","input","wikipedia_digest","ee","collins","ugc","media_sents_part","syno","rel_word","longman","ce_new","le","newcj_sents","blng_sents_part","hh"],["ugc"],["longman"],["newjc"],["newcj"],["web_trans"],["fanyi"]]}
keyfrom: mdict.7.2.0.android
model: honor
mid: 5.6.1
imei: 659135764921685
vendor: wandoujia
screen: 1080x1800
ssid: superman
network: wifi
abtest: 2
xmlVersion: 5.1
   */
  const params = {
    q: word,
    le: fromLanguage,
    jsonversion: 2,
    client: "mobile",
    dicts: `{"count":3 ,"dicts":${JSON.stringify(dicts)}}`,
    keyfrom: "mdict.7.2.0.android",
    model: "honor",
    mid: "5.6.1",
    imei: "659135764921685",
    vendor: "wandoujia",
    screen: "1080x1800",
    ssid: "superman",
    network: "wifi",
    abtest: 2,
    xmlVersion: "5.1",
  };
  console.log(`---> youdao web dict params: ${util.inspect(params, { depth: null })}`);
  const queryString = querystring.stringify(params);
  const dictUrl = `https://dict.youdao.com/jsonapi?${queryString}`;
  console.log(`---> youdao web dict url: ${dictUrl}`);

  const headers = {
    "User-Agent": userAgent,
    Cookie: `JSESSIONID=abcSAn2OeFFV9e-wmnVfy; OUTFOX_SEARCH_USER_ID_NCOO=2137554906.8611808; OUTFOX_SEARCH_USER_ID="-1875619241@10.110.96.157"; search-popup-show=-1; PICUGC_FLASH=; PICUGC_SESSION=90fbe28fda40b5ff04f343a261160ce83d3439fc-%00_TS%3Asession%00; DICT_UGC=e65c970572f2dfea58db3393d069ae1c|m13397671157@163.com; webDict_HdAD=%7B%22req%22%3A%22http%3A//dict.youdao.com%22%2C%22width%22%3A960%2C%22height%22%3A240%2C%22showtime%22%3A5000%2C%22fadetime%22%3A500%2C%22notShowInterval%22%3A3%2C%22notShowInDays%22%3Afalse%2C%22lastShowDate%22%3A%22Mon%20Nov%2008%202010%22%7D; NTES_SESS=L_s6j5LsoBJ9gXmGNBURQ9BzCjFZq2CICS5dvKEkJpJqG3kH0hJnwBABNxnnTAX811Zu19Nf9ZQq83pNGVmQ77HvnjJSLol0oF_pnYDR6i03p2p2MNXy1kU4jxf8S_dMTaR7ESwo18XxK227hp3dkVLsrBP5bkRhHB.pUyk6ggwKE2uSEAQ9clIw9Y.g9rzo.pMgzr8qDjmgdqjJQOqsPSpwriUZnnUeQ; NTES_PASSPORT=bFlHWmiuaZgBM5R9EOx8moLoPEHhfYM3JrHr8PTtysFGlgDdIRry4UKUibyy.Ka_tRzYS_5EDbWJYujHU3NTvBWK3vPNzU91bG5iPqmqTlq73UZkVMgnRLpTX8Hg3hvujpYGNLTFrn_1vwsN8_5jnbK2rcjmjQC02IK2aGLanhbqxz_.y31qD1qQKK3Vv8Vet3w89Qpmridmd; S_INFO=1661229725|0|3&80##|m13397671157#ffdevolfxw#wxflovedff; P_INFO=m13397671157@163.com|1661229725|1|youdao_zhiyun2018|00&99|gud&1661222971&youdao_zhiyun2018#gud&441900#10#0#0|133157&1|youdao_zhiyun2018&search&cloudmusic&newsclient|13397671157@163.com; YOUDAO_MOBILE_ACCESS_TYPE=1; ___rl__test__cookies=1661442828116`,
  };

  return new Promise((resolve, reject) => {
    axios
      .get(dictUrl, { headers })
      .then((res) => {
        // log response headers
        console.log(`---> youdao web dict response headers: ${JSON.stringify(res.headers, null, 2)}`);

        console.log(`---> youdao web dict data: ${util.inspect(res.data, { depth: null })}`);
        const json = JSON.stringify(res.data, null, 4);
        copyToClipboard(json);
      })
      .catch((error) => {
        console.log(`---> youdao web dict error: ${error}`);
      });
  });
}

/**
 * Youdao translate, use web API. Cost time: 0.2s
 *
 * Ref: https://mp.weixin.qq.com/s/AWL3et91N8T24cKs1v660g
 */
export function requestYoudaoWebTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  const { fromLanguage, toLanguage, word } = queryWordInfo;

  const timestamp = new Date().getTime();
  const lts = timestamp.toString(); // 1661435375537
  const salt = timestamp.toString() + Math.round(Math.random() * 10); // 16614353755371
  const bv = CryptoJS.MD5(userAgent).toString();
  const sign = CryptoJS.MD5("fanyideskweb" + word + salt + "Ygy_4c=r#e#4EX^NUGUc5").toString();

  const url = `${youdaoTranslatURL}/translate_o?smartresult=dict&smartresult=rule`;
  const headers = {
    "User-Agent": userAgent,
    Referer: youdaoTranslatURL,
    Cookie: youdaoCookie,
  };
  const data = {
    salt,
    sign,
    lts,
    bv,
    i: word,
    from: fromLanguage,
    to: toLanguage,
    smartresult: "dict",
    client: "fanyideskweb",
    doctype: "json",
    version: "2.1",
    keyfrom: "fanyi.web",
    action: "FY_BY_REALTlME",
  };
  console.log(`---> youdao data: ${util.inspect(data, { depth: null })}`);

  return new Promise((resolve, reject) => {
    axios
      .post(url, querystring.stringify(data), { headers })
      .then((response) => {
        console.log(`---> youdao translate res: ${util.inspect(response.data, { depth: null })}`);
        const youdaoWebResult = response.data as YoudaoWebTranslateResult;
        if (youdaoWebResult.errorCode === 0) {
          const translatedText = youdaoWebResult.translateResult[0][0].tgt as string;
          console.log(`youdao web translatedText: ${translatedText}, cost: ${response.headers[requestCostTime]} ms`);
          const youdaoTypeResult: QueryTypeResult = {
            type: TranslationType.Youdao,
            result: youdaoWebResult,
            wordInfo: queryWordInfo,
            translations: translatedText.split("\n"),
          };
          resolve(youdaoTypeResult);
        } else {
          const errorInfo: RequestErrorInfo = {
            type: TranslationType.Youdao,
            code: youdaoWebResult.errorCode.toString(),
            message: "",
          };
          reject(errorInfo);
        }
      })
      .catch((error) => {
        if (error.message === "canceled") {
          console.log(`---> youdao canceled`);
          return;
        }

        console.log(`---> youdao translate error: ${error}`);
        const errorInfo = getTypeErrorInfo(DicionaryType.Youdao, error);
        reject(errorInfo);
      });
  });
}

function getYoudaoErrorInfo(errorCode: string): RequestErrorInfo {
  let errorMessage = "";
  switch (errorCode) {
    case YoudaoErrorCode.Success: {
      errorMessage = "Success";
      break;
    }
    case YoudaoErrorCode.TargetLanguageNotSupported: {
      errorMessage = "Target language not supported";
      break;
    }
    case YoudaoErrorCode.TranslatedTextTooLong: {
      errorMessage = "Translated text too long";
      break;
    }
    case YoudaoErrorCode.InvalidApplicationID: {
      errorMessage = "Invalid application ID";
      break;
    }
    case YoudaoErrorCode.InvalidSignature: {
      errorMessage = "Invalid signature";
      break;
    }
    case YoudaoErrorCode.AccessFrequencyLimited: {
      errorMessage = "Access frequency limited";
      break;
    }
    case YoudaoErrorCode.TranslationQueryFailed: {
      errorMessage = "Translation query failed";
      break;
    }
    case YoudaoErrorCode.InsufficientAccountBalance: {
      errorMessage = "Insufficient account balance";
      break;
    }
  }

  const errorInfo: RequestErrorInfo = {
    type: DicionaryType.Youdao,
    code: errorCode,
    message: errorMessage,
  };
  return errorInfo;
}

/**
 * Download query word audio and play after download.
 */
export function playYoudaoWordAudioAfterDownloading(queryWordInfo: QueryWordInfo) {
  tryDownloadYoudaoAudio(queryWordInfo, () => {
    playWordAudio(queryWordInfo.word, queryWordInfo.fromLanguage);
  });
}

/**
 * Download word audio file. 
*  If query text is a word (only English word?), download audio file from youdao web api, otherwise downloaded from youdao tts.

 * * NOTE: If query text is too long(>40), don't download audio file, later derectly use say command to play.
 */
export function tryDownloadYoudaoAudio(queryWordInfo: QueryWordInfo, callback?: () => void, forceDownload = false) {
  if (queryWordInfo.isWord && queryWordInfo.fromLanguage === "en") {
    downloadYoudaoEnglishWordAudio(queryWordInfo.word, callback, (forceDownload = false));
  } else if (queryWordInfo.word.length < maxTextLengthOfDownloadYoudaoTTSAudio) {
    if (queryWordInfo.speechUrl) {
      downloadWordAudioWithURL(queryWordInfo.word, queryWordInfo.speechUrl, callback, forceDownload);
    } else {
      console.warn(`youdao tts url not found: ${queryWordInfo.word}`);
      callback && callback();
    }
  } else {
    console.log(`text is too long, use say command to play derectly`);
    callback && callback();
  }
}

/**
 * * Note: this function is only used to download `isWord` audio file from web youdao, if not a word, the pronunciation audio is not accurate.
 *
 * This is a wild web API from https://cloud.tencent.com/developer/article/1596467 , also can find in web https://dict.youdao.com/w/good
 *
 * Example: https://dict.youdao.com/dictvoice?type=0&audio=good
 */
export function downloadYoudaoEnglishWordAudio(word: string, callback?: () => void, forceDownload = false) {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
  console.log(`download youdao English word audio: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}

/**
 
1: 8
2: 9
3: 0
4: 1
5: 2
6: 3, result
7: 4, article
8: 5, download
9: 6, developer
10: 7, successful
11: 8
12: 9, successfully
 */
