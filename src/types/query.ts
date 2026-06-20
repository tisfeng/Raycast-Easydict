/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import type { DetectedLangModel } from "@/core/detect/types";
import type { RequestError } from "@/utils/errors";

import type { DictionaryType, TranslationType } from "./api";
import type { DisplaySection } from "./display";

/**
 * Runtime execution options for a query.
 * Passed separately from the data payload (QueryWordInfo).
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StreamChunk {
  content: string;
  role?: string;
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

export interface QueryTypeResult<T = unknown> {
  type: QueryType;
  queryWordInfo: QueryWordInfo;
  result?: T;
  translations: string[];
  oneLineTranslation?: string;
  errorInfo?: RequestError;
}

export interface QueryResult<T = unknown> {
  type: QueryType;
  sourceResult: QueryTypeResult<T>;
  displaySections?: DisplaySection<T>[];
  hideDisplay?: boolean;
}
