/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { toLegacyDictionaryResult } from "@/core/content/legacyDictionary";
import { DictionaryType } from "@/core/results/kinds";
import type { DictionaryResult, QueryInput, RequestOptions } from "@/core/results/types";
import { BaseDictionaryProvider } from "@/providers/dictionary/base";
import { RequestError } from "@/shared/errors";
import { timedFetch } from "@/shared/http";
import { logError } from "@/shared/logger";

import { buildYoudaoContent } from "./content";
import { ensureYoudaoCookie } from "./cookie";
import { decodeYoudaoResponse } from "./decode";
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

  protected override async doQuery(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
  ): Promise<DictionaryResult> {
    // * Note: "fanyi" only works when response dicts has only one item ["meta"]
    const dicts = [["web_trans", "ec", "ce", "newhh", "baike", "wikipedia_digest"]];

    const queryYoudaoDictLanguageId = getYoudaoWebDictionaryLanguageId(queryWordInfo);
    if (!queryYoudaoDictLanguageId) {
      throw new RequestError(DictionaryType.Youdao, "not supported language");
    }

    const params = {
      q: queryWordInfo.word,
      le: queryYoudaoDictLanguageId,
      dicts: JSON.stringify({ count: 99, dicts: dicts }),
    };

    const queryString = new URLSearchParams(params).toString();
    const dictUrl = `https://dict.youdao.com/jsonapi?${queryString}`;

    const response = await timedFetch<unknown>(dictUrl, { signal });
    const content = buildYoudaoContent(queryWordInfo, decodeYoudaoResponse(response));
    return toLegacyDictionaryResult(this.type, content);
  }
}
