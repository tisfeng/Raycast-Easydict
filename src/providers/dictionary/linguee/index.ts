/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { userAgent } from "@/consts";
import { BaseDictionaryProvider } from "@/providers/dictionary/base";
import { DictionaryType } from "@/types/api";
import type { QueryInput, QueryResult, RequestOptions } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { formatLingueeDisplaySections, getLingueeWebDictionaryURL, parseLingueeHTML } from "./parse";
import type { LingueeDictionaryResult } from "./types";

/**
 * Linguee dictionary provider.
 *
 * Cost time: > 2s.
 * eg. good: https://www.linguee.com/english-chinese/search?source=auto&query=good
 */
export class LingueeDictionaryProvider extends BaseDictionaryProvider<LingueeDictionaryResult> {
  type = DictionaryType.Linguee;

  protected override async doQuery(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
  ): Promise<QueryResult<LingueeDictionaryResult>> {
    const lingueeUrl = getLingueeWebDictionaryURL(queryWordInfo);
    logTrace(this.type, `url: ${lingueeUrl}`);

    if (!lingueeUrl) {
      return {
        type: DictionaryType.Linguee,
        sourceResult: {
          type: DictionaryType.Linguee,
          queryWordInfo,
          translations: [],
        },
      };
    }

    const response = await timedFetch.raw(lingueeUrl, {
      headers: { "User-Agent": userAgent },
      signal,
      responseType: "arrayBuffer",
    });

    const contentType = response.headers.get("content-type");
    const arrayBuffer = response._data;
    if (!arrayBuffer) {
      throw new Error("No data received from Linguee");
    }
    const data = Buffer.from(arrayBuffer);
    const html = data.toString(
      typeof contentType === "string" && contentType.includes("iso-8859-15") ? "latin1" : "utf-8",
    );
    const parsedTypeResult = parseLingueeHTML(html);

    /**
     * Generally, the language of the queryWordInfo is the language of the dictionary result.
     * But sometimes, linguee detect language may be wrong when word item is empty, so we use queryWordInfo language.
     * eg. sql, auto detect is chinese -> english.
     */
    const lingueeDictionaryResult = parsedTypeResult.result;
    const resultQueryWordInfo =
      queryWordInfo.isWord === undefined
        ? parsedTypeResult.queryWordInfo
        : { ...parsedTypeResult.queryWordInfo, isWord: queryWordInfo.isWord };
    const dictionaryQueryWordInfo =
      lingueeDictionaryResult && lingueeDictionaryResult.wordItems.length === 0
        ? {
            ...lingueeDictionaryResult.queryWordInfo,
            word: queryWordInfo.word,
            fromLanguage: queryWordInfo.fromLanguage,
            toLanguage: queryWordInfo.toLanguage,
          }
        : resultQueryWordInfo;

    const lingueeTypeResult = {
      ...parsedTypeResult,
      queryWordInfo: resultQueryWordInfo,
      result: lingueeDictionaryResult
        ? { ...lingueeDictionaryResult, queryWordInfo: dictionaryQueryWordInfo }
        : undefined,
    };

    const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);

    return {
      type: DictionaryType.Linguee,
      sourceResult: lingueeTypeResult,
      displaySections: lingueeDisplaySections.length > 0 ? lingueeDisplaySections : undefined,
    };
  }
}
