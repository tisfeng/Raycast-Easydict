/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-27 18:07
 * @fileName: request.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import {
  downloadAudio,
  downloadWordAudioWithURL,
  getWordAudioPath,
  maxTextLengthOfDownloadYoudaoTTSAudio,
  playWordAudio,
} from "../../audio";
import { QueryWordInfo } from "../../types";

/**
 * Download query word audio and play when after download.
 */
export function downloadYoudaoAudioAndPlay(queryWordInfo: QueryWordInfo) {
  downloadYoudaoAudio(queryWordInfo, () => {
    playWordAudio(queryWordInfo.word, queryWordInfo.fromLanguage);
  });
}

/**
  Download word audio file. 
  if query text is a word (only English word?), download audio file from youdao wild api, otherwise download from youdao tts.
  if query text is too long, don't download audio file, later derectly use say command to play.
 */
export function downloadYoudaoAudio(queryWordInfo: QueryWordInfo, callback?: () => void, forceDownload = false) {
  if (queryWordInfo.isWord && queryWordInfo.fromLanguage === "en") {
    downloadYoudaoWebWordAudio(queryWordInfo.word, callback, (forceDownload = false));
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
  example https://dict.youdao.com/dictvoice?type=0&audio=good
 */
export function downloadYoudaoWebWordAudio(word: string, callback?: () => void, forceDownload = false) {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURI(word)}`;
  console.log(`download youdao web audio: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}
