/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import axios from "axios";
import { DictionaryType, QueryTypeResult } from "@/types";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { RequestErrorInfo } from "@/types";

/**
 * request iciba dictionary
 */
export function icibaDictionary(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  const url = "http://dict-co.iciba.com/api/dictionary.php";
  const params = {
    key: "0EAE08A016D6688F64AB3EBB2337BFB0",
    type: "json",
    w: queryWordInfo.word,
  };

  return new Promise((resolve, reject) => {
    axios
      .get(url, { params })
      .then((response) => {
        const result: QueryTypeResult = {
          type: DictionaryType.Iciba,
          result: response.data,
          translations: [],
          queryWordInfo: queryWordInfo,
        };
        resolve(result);
      })
      .catch((error) => {
        const errorInfo: RequestErrorInfo = {
          type: DictionaryType.Iciba,
          code: error.response?.status,
          message: error.response?.statusText,
        };
        reject(errorInfo);
      });
  });
}
