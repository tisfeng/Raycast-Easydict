/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LocalStorage } from "@raycast/api";

import { userAgent } from "@/constants";
import { autoDetectLanguageItem } from "@/core/language/consts";
import { myPreferences } from "@/preferences";
import { BaseDictionaryProvider } from "@/providers/dictionary/base";
import { DictionaryType } from "@/types/api";
import type { QueryResult, QueryWordInfo, RequestOptions } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

import { formatYoudaoWebDictionaryModel, updateYoudaoDictionaryDisplay } from "./formatData";
import type { YoudaoWebDictionaryModel } from "./types";
import { getYoudaoWebDictionaryLanguageId } from "./utils";

logTrace("youdao", "module loaded");

const youdaoTranslatURL = "https://fanyi.youdao.com";

const youdaoCookieKey = "youdaoCookie";

let youdaoCookie: string | undefined;

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
 * Youdao web dictionary provider.
 *
 * Cost time: 0.2s. Supported zh <--> targetLanguage (en, fr, ja, ko).
 */
export class YoudaoDictionaryProvider extends BaseDictionaryProvider {
  type = DictionaryType.Youdao;

  protected async doQuery(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}): Promise<QueryResult> {
    // * Note: "fanyi" only works when response dicts has only one item ["meta"]
    const dicts = [["web_trans", "ec", "ce", "newhh", "baike", "wikipedia_digest"]];

    const queryYoudaoDictLanguageId = getYoudaoWebDictionaryLanguageId(queryWordInfo);
    if (!queryYoudaoDictLanguageId) {
      throw {
        type: DictionaryType.Youdao,
        code: "",
        message: "not supported language",
      };
    }

    const params = {
      q: queryWordInfo.word,
      le: queryYoudaoDictLanguageId,
      dicts: JSON.stringify({ count: 99, dicts: dicts }),
    };

    const queryString = new URLSearchParams(params).toString();
    const dictUrl = `https://dict.youdao.com/jsonapi?${queryString}`;

    const youdaoWebModel = await timedFetch<YoudaoWebDictionaryModel>(dictUrl, { signal });
    const youdaoFormatResult = formatYoudaoWebDictionaryModel(youdaoWebModel);
    const youdaoQueryWordInfo = youdaoFormatResult.queryWordInfo;

    if (!youdaoQueryWordInfo.hasDictionaryEntries) {
      return {
        type: DictionaryType.Youdao,
        sourceResult: {
          type: DictionaryType.Youdao,
          queryWordInfo,
          translations: [],
        },
      };
    }

    // * Note: Youdao web dict from-to language may be incorrect, eg: 鶗鴂，so we need to update it.
    if (queryWordInfo.fromLanguage !== autoDetectLanguageItem.youdaoLangCode) {
      youdaoQueryWordInfo.fromLanguage = queryWordInfo.fromLanguage;
      youdaoQueryWordInfo.toLanguage = queryWordInfo.toLanguage;
    }

    const displaySections = updateYoudaoDictionaryDisplay(youdaoFormatResult);

    return {
      type: DictionaryType.Youdao,
      sourceResult: {
        type: DictionaryType.Youdao,
        queryWordInfo: youdaoQueryWordInfo,
        result: youdaoFormatResult,
        translations: youdaoFormatResult.translation.split("\n"),
      },
      displaySections,
    };
  }
}
