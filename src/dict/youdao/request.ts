/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-03 00:05
 * @fileName: request.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import CryptoJS from "crypto-js";
import querystring from "node:querystring";
import { downloadAudio, downloadWordAudioWithURL, getWordAudioPath, playWordAudio } from "../../audio";
import { getYoudaoErrorInfo, YoudaoRequestStateCode } from "../../consts";
import { youdaoAppId, youdaoAppSecret } from "../../crypto";
import { QueryWordInfo, RequestTypeResult, TranslationType, YoudaoDictionaryResult } from "../../types";
import { formatYoudaoDictionaryResult } from "./formatData";

/**
 * Max length of text to download youdao tts audio
 */
export const maxTextLengthOfDownloadYoudaoTTSAudio = 40;

/**
 * 有道翻译
 * Docs: https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
 */
export function requestYoudaoDictionary(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  function truncate(q: string): string {
    const len = q.length;
    return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
  }
  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const sha256Content = youdaoAppId + truncate(queryText) + salt + timestamp + youdaoAppSecret;
  const sign = CryptoJS.SHA256(sha256Content).toString();
  const url = "https://openapi.youdao.com/api";
  const params = querystring.stringify({
    sign,
    salt,
    from: fromLanguage,
    signType: "v3",
    q: queryText,
    appKey: youdaoAppId,
    curtime: timestamp,
    to: targetLanguage,
  });
  // console.log(`---> youdao params: ${params}`);

  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
      .then((response) => {
        const youdaoResult = response.data as YoudaoDictionaryResult;
        const youdaoFormatResult = formatYoudaoDictionaryResult(youdaoResult);
        const youdaoErrorInfo = getYoudaoErrorInfo(youdaoResult.errorCode);
        const youdaoTypeResult: RequestTypeResult = {
          type: TranslationType.Youdao,
          result: youdaoFormatResult,
          errorInfo: youdaoErrorInfo,
          translation: youdaoResult.translation.join(" "),
        };
        console.warn(`---> Youdao translate cost: ${response.headers["requestCostTime"]} ms`);
        if (youdaoResult.errorCode !== YoudaoRequestStateCode.Success.toString()) {
          reject(youdaoErrorInfo);
        } else {
          resolve(youdaoTypeResult);
        }
      })
      .catch((error) => {
        // It seems that Youdao will never reject, always resolve...
        // ? Error: write EPROTO 6180696064:error:1425F102:SSL routines:ssl_choose_client_version:unsupported protocol:../deps/openssl/openssl/ssl/statem/statem_lib.c:1994:
        console.error(`youdao translate error: ${error}`);
        reject({
          type: TranslationType.Youdao,
          code: error.response?.status.toString(),
          message: error.response?.statusText,
        });
      });
  });
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
  
  this is a wild web API from https://cloud.tencent.com/developer/article/1596467 , also can find in web https://dict.youdao.com/w/good
  Example: https://dict.youdao.com/dictvoice?type=0&audio=good
 */
export function downloadYoudaoEnglishWordAudio(word: string, callback?: () => void, forceDownload = false) {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
  console.log(`download youdao English word audio: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}
