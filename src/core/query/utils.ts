/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { config } from "@/core/config";
import type { LanguageItem } from "@/core/language/types";
import type { QueryResult } from "@/core/results/types";
import { logTrace } from "@/utils/logger";

/**
 * Sort query results by designated order.
 *
 * * NOTE: this function will be called many times, because request results are async, so we need to sort every time.
 */
export function sortedQueryResults(queryResults: QueryResult[]) {
  return queryResults
    .map((result, index) => ({ result, index }))
    .sort((left, right) => {
      return left.result.serviceOrder - right.result.serviceOrder || left.index - right.index;
    })
    .map(({ result }) => result);
}

/**
 * Get auto select target language according to the LangCode.
 */
export function getAutoSelectedTargetLanguageItem(fromLangCode: string): LanguageItem {
  const targetLanguageItem = config.preferredLanguages.find(
    (languageItem) => languageItem.youdaoLangCode !== fromLangCode,
  ) as LanguageItem;
  logTrace("QueryUtils", `fromLangCode: ${fromLangCode}, auto selected target: ${targetLanguageItem.youdaoLangCode}`);
  return targetLanguageItem;
}
