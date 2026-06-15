/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { timedFetch } from "@/fetchConfig";
import { DictionaryType, QueryResponse, QueryTypeResult } from "@/types";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { RequestErrorInfo } from "@/types";

/**
 * request iciba dictionary
 */
export function icibaDictionary(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
  const url = "http://dict-co.iciba.com/api/dictionary.php";
  const params = {
    key: "0EAE08A016D6688F64AB3EBB2337BFB0",
    type: "json",
    w: queryWordInfo.word,
  };

  return timedFetch<QueryResponse>(url, { params, signal })
    .then((result) => {
      const typeResult: QueryTypeResult = {
        type: DictionaryType.Iciba,
        result,
        translations: [],
        queryWordInfo: queryWordInfo,
      };
      return typeResult;
    })
    .catch((error) => {
      const errorInfo: RequestErrorInfo = {
        type: DictionaryType.Iciba,
        code: error.status,
        message: error.statusText,
      };
      throw errorInfo;
    });
}
