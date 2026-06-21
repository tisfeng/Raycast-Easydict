/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { autoDetectLanguageItem } from "@/core/language/consts";
import { BaseDictionaryProvider } from "@/providers/dictionary/base";
import { DictionaryType } from "@/types/api";
import type { QueryWordInfo, RequestOptions } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logError } from "@/utils/logger";

import { ensureYoudaoCookie } from "./cookie";
import { formatYoudaoWebDictionaryModel, updateYoudaoDictionaryDisplay } from "./formatData";
import type { YoudaoWebDictionaryModel } from "./types";
import { getYoudaoWebDictionaryLanguageId } from "./utils";

// * Cookie will be expired after 1 day, so we need to update it every time we start.
if (myPreferences.enableYoudaoDictionary || myPreferences.enableYoudaoTranslate) {
  ensureYoudaoCookie().catch((error) => logError("Youdao Dictionary", `ensure cookie error: ${error}`));
}

/**
 * Youdao web dictionary provider.
 *
 * Cost time: 0.2s. Supported zh <--> targetLanguage (en, fr, ja, ko).
 */
export class YoudaoDictionaryProvider extends BaseDictionaryProvider {
  type = DictionaryType.Youdao;

  protected async doQuery(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}) {
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
