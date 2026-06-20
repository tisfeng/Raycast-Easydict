/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { userAgent } from "@/consts";
import { BaseDictionaryProvider } from "@/providers/dictionary/base";
import { DictionaryType } from "@/types/api";
import type { QueryWordInfo, RequestOptions } from "@/types/query";
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
export class LingueeDictionaryProvider extends BaseDictionaryProvider {
  type = DictionaryType.Linguee;

  protected async doQuery(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}) {
    const lingueeUrl = getLingueeWebDictionaryURL(queryWordInfo);
    logTrace("linguee", `url: ${lingueeUrl}`);

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

    const response = await timedFetch.native(lingueeUrl, {
      headers: { "User-Agent": userAgent },
      signal,
    });

    const contentType = response.headers.get("content-type");
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    const html = data.toString(
      typeof contentType === "string" && contentType.includes("iso-8859-15") ? "latin1" : "utf-8",
    );
    const lingueeTypeResult = parseLingueeHTML(html);

    /**
     * Generally, the language of the queryWordInfo is the language of the dictionary result.
     * But sometimes, linguee detect language may be wrong when word item is empty, so we use queryWordInfo language.
     * eg. sql, auto detect is chinese -> english.
     */
    const lingueeDictionaryResult = lingueeTypeResult.result as LingueeDictionaryResult;
    if (lingueeDictionaryResult && lingueeDictionaryResult.wordItems.length === 0) {
      const wordInfo = lingueeDictionaryResult.queryWordInfo;
      lingueeDictionaryResult.queryWordInfo = {
        ...wordInfo,
        word: queryWordInfo.word,
        fromLanguage: queryWordInfo.fromLanguage,
        toLanguage: queryWordInfo.toLanguage,
      };
    }

    if (queryWordInfo.isWord !== undefined) {
      lingueeTypeResult.queryWordInfo.isWord = queryWordInfo.isWord;
    }

    const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);

    // Set accessoryItem (phonetic, examTypes) from queryWordInfo
    if (lingueeDisplaySections.length > 0 && lingueeDisplaySections[0].items.length > 0) {
      lingueeDisplaySections[0].items[0].accessoryItem = {
        phonetic: queryWordInfo.phonetic,
        examTypes: queryWordInfo.examTypes,
      };
    }

    return {
      type: DictionaryType.Linguee,
      sourceResult: lingueeTypeResult,
      displaySections: lingueeDisplaySections.length > 0 ? lingueeDisplaySections : undefined,
    };
  }
}
