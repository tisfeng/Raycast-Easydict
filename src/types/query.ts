/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import type { DetectedLangModel } from "@/core/detect/types";
import type { RequestError } from "@/utils/errors";

import type { DictionaryType, TranslationType } from "./api";
import type { DisplaySection } from "./display";
import type { QueryResponse } from "./queryResponse";

/**
 * Runtime execution options for a query.
 * Passed separately from the data payload (QueryWordInfo).
 */
export interface RequestOptions {
  signal?: AbortSignal;
  onMessage?: (message: { content: string; role: string }) => void;
  onFinish?: (reason: string) => void;
}

export interface QueryWordInfo {
  word: string;
  fromLanguage: string; // ! must be Youdao language id.
  toLanguage: string;
  isWord?: boolean; // * Dictionary Type should has value, show web url need this value.
  hasDictionaryEntries?: boolean; // it is true if the word has dictionary entries.
  detectedLangModel?: DetectedLangModel;
  phonetic?: string; // [ɡʊd]
  examTypes?: string[];
  speechUrl?: string; // word audio url. some language not have tts url, such as "ຂາດ"
}

export type QueryType = TranslationType | DictionaryType;

export interface QueryTypeResult {
  type: QueryType;
  queryWordInfo: QueryWordInfo;
  result?: QueryResponse;
  translations: string[];
  oneLineTranslation?: string;
  errorInfo?: RequestError;
}

export interface QueryResult {
  type: QueryType;
  sourceResult: QueryTypeResult;
  displaySections?: DisplaySection[];
  hideDisplay?: boolean;
}
