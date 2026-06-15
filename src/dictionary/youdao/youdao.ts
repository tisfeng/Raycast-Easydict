/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";
import { timedFetch } from "@/fetchConfig";
import { downloadAudio, downloadWordAudioWithURL, getWordAudioPath, playWordAudio } from "@/audio";
import { userAgent } from "@/consts";
import { autoDetectLanguageItem, englishLanguageItem } from "@/language/consts";
import { myPreferences } from "@/preferences";
import { logTrace, logError } from "@/devLog";
import { DictionaryType, QueryType, QueryTypeResult, QueryWordInfo, RequestErrorInfo } from "@/types";
import { getTypeErrorInfo } from "@/utils";
import { formatYoudaoWebDictionaryModel } from "@/dictionary/youdao/formatData";
import { YoudaoWebDictionaryModel } from "@/dictionary/youdao/types";
import { getYoudaoWebDictionaryLanguageId } from "@/dictionary/youdao/utils";

logTrace("youdao", "module loaded");

const youdaoTranslatURL = "https://fanyi.youdao.com";

const youdaoCookieKey = "youdaoCookie";

let youdaoCookie: string | undefined; // "OUTFOX_SEARCH_USER_ID=362474716@10.108.162.139; Domain=.youdao.com; Expires=Sat, 17-Aug-2052 15:39:50 GMT";

// * Cookie will be expired after 1 day, so we need to update it every time we start.
if (myPreferences.enableYoudaoDictionary || myPreferences.enableYoudaoTranslate) {
  getYoudaoWebCookie();
}

/**
 * Get youdao cookie from youdao web, and store it in local storage.
 */
function getYoudaoWebCookie(): Promise<string | undefined> {
  logTrace("youdao", "start getYoudaoWebCookie");

  LocalStorage.getItem<string>(youdaoCookieKey).then((cookie) => {
    if (cookie) {
      youdaoCookie = cookie;
    }
  });

  const headers = {
    "User-Agent": userAgent,
  };

  return new Promise((resolve) => {
    timedFetch
      .raw(youdaoTranslatURL, { headers })
      .then((response) => {
        const setCookie = response.headers.getSetCookie?.() || [];
        if (setCookie.length > 0) {
          youdaoCookie = setCookie.join(";");
          resolve(youdaoCookie);
          LocalStorage.setItem(youdaoCookieKey, youdaoCookie);
          logTrace("youdao", "got web youdaoCookie");
        }
      })
      .catch((error) => {
        logError("youdao", `get youdaoCookie error: ${error}`);
        LocalStorage.removeItem(youdaoCookieKey);
        resolve(undefined);
      });
  });
}

/**
 * Youdao web dictionary, unofficial API. Cost time: 0.2s
 *
 * Supported zh <--> targetLanguage, supported target language: en, fr, ja, ko
 */
export function requestYoudaoWebDictionary(
  queryWordInfo: QueryWordInfo,
  queryType?: QueryType,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("youdao", "start requestYoudaoWebDictionary");

  const type = queryType ?? DictionaryType.Youdao;

  // * Note: "fanyi" only works when responese dicts has only one item ["meta"]
  const dicts = [["web_trans", "ec", "ce", "newhh", "baike", "wikipedia_digest"]];

  // English --> Chinese
  // ["web_trans","video_sents", "simple", "phrs",  "syno", "collins", "word_video",  "discriminate", "ec", "ee", "blng_sents_part", "individual", "collins_primary", "rel_word", "auth_sents_part", "media_sents_part", "expand_ec", "etym", "special","baike", "meta", "senior", "webster","oxford", "oxfordAdvance", "oxfordAdvanceHtml"]

  // Chinese --> English
  // ["web_trans", "blng_sents_part", "ce", "wuguanghua", "ce_new", "simple", "media_sents_part", "special", "baike", "meta", "newhh"]

  const queryYoudaoDictLanguageId = getYoudaoWebDictionaryLanguageId(queryWordInfo);
  if (!queryYoudaoDictLanguageId) {
    logError("youdao", `not supported language: ${queryWordInfo.fromLanguage} --> ${queryWordInfo.toLanguage}`);
    const errorInfo: RequestErrorInfo = {
      type: type,
      code: "",
      message: "not supported language 😭",
    };
    return Promise.reject(errorInfo);
  }

  const params = {
    q: queryWordInfo.word,
    le: queryYoudaoDictLanguageId,
    dicts: JSON.stringify({ count: 99, dicts: dicts }),
  };

  const queryString = new URLSearchParams(params).toString();

  const dictUrl = `https://dict.youdao.com/jsonapi?${queryString}`;

  return timedFetch<YoudaoWebDictionaryModel>(dictUrl, { signal })
    .then((youdaoWebModel) => {
      const youdaoFormatResult = formatYoudaoWebDictionaryModel(youdaoWebModel);
      const youdaoQueryWordInfo = youdaoFormatResult.queryWordInfo;

      if (!youdaoQueryWordInfo.hasDictionaryEntries) {
        return {
          type: type,
          result: undefined,
          queryWordInfo: queryWordInfo,
          translations: [],
        } as QueryTypeResult;
      }

      // * Note: Youdao web dict from-to language may be incorrect, eg: 鶗鴂，so we need to update it.
      if (queryWordInfo.fromLanguage !== autoDetectLanguageItem.youdaoLangCode) {
        youdaoQueryWordInfo.fromLanguage = queryWordInfo.fromLanguage;
        youdaoQueryWordInfo.toLanguage = queryWordInfo.toLanguage;
      }

      return {
        type: type,
        result: youdaoFormatResult,
        queryWordInfo: youdaoQueryWordInfo,
        translations: youdaoFormatResult.translation.split("\n"),
      };
    })
    .catch((error) => {
      if (error.message === "canceled" || error.name === "AbortError") {
        logTrace("youdao", "web dict canceled");
        throw undefined;
      }

      logError("youdao", `web dict error: ${error}`);

      const errorInfo = getTypeErrorInfo(type, error);
      throw errorInfo;
    });
}

/**
 * Download query word audio and play after download.
 */
export function playYoudaoWordAudioAfterDownloading(queryWordInfo: QueryWordInfo, enableYoudaoWebAudio = true) {
  downloadYoudaoAudio(queryWordInfo, enableYoudaoWebAudio, () => {
    playWordAudio(queryWordInfo.word, queryWordInfo.fromLanguage);
  });
}

/**
 * Download word audio file.
 *
 * If query text is a English word, download audio file from youdao web api, otherwise downloaded from youdao tts.
 *
 * * If query text is too long(>40), don't download audio file, later derectly use say command to play.
 */
export function downloadYoudaoAudio(
  queryWordInfo: QueryWordInfo,
  enableYoudaoWebAudio = true,
  callback?: () => void,
  forceDownload = false,
) {
  // For most English words, it seems that Youdao web audio is better than Youdao tts, but not all words have web audio.
  if (queryWordInfo.speechUrl) {
    downloadWordAudioWithURL(queryWordInfo.word, queryWordInfo.speechUrl, callback, forceDownload);
  } else if (
    enableYoudaoWebAudio &&
    queryWordInfo.isWord &&
    queryWordInfo.fromLanguage === englishLanguageItem.youdaoLangCode
  ) {
    downloadYoudaoEnglishWordAudio(queryWordInfo.word, callback, (forceDownload = false));
  } else {
    logTrace("youdao", "use say command to play directly");
    callback?.();
  }
}

/**
 * * Note: this function is only used to download `isWord` audio file from web youdao, if not a word, the pronunciation audio is not accurate.
 *
 * This is a wild web API from https://cloud.tencent.com/developer/article/1596467 , also can find in web https://dict.youdao.com/w/good
 *
 * Example: https://dict.youdao.com/dictvoice?audio=good&type=2
 *
 * type: 1: uk, 2: us. ---> 0: us ?
 *
 * * NOTE: Audio 'Volcano' is different from 'volcano' in youdao web audio, so odd, so we use lower case word.
 *
 * * Note: some of words, both uppercase and lowercase, have the same audio url, eg: polaris and Polaris: https://dict.youdao.com/dictvoice?type=2&audio=Polaris
 */
export function downloadYoudaoEnglishWordAudio(word: string, callback?: () => void, forceDownload = false) {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
  logTrace("youdao", `download english word audio: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}
