/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DictionaryType, TranslationType } from "./api";
import type { DisplaySection } from "./display";

/**
 * Runtime execution options for a query.
 * Passed separately from the data payload (QueryInput).
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StreamChunk {
  content: string;
  role?: string;
}

export interface QueryInput {
  readonly word: string;
  readonly fromLanguage: string; // ! must be Youdao language id.
  readonly toLanguage: string;
  readonly isWord?: boolean; // * Dictionary Type should has value, show web url need this value.
}

export interface QueryWordInfo extends QueryInput {
  hasDictionaryEntries?: boolean; // it is true if the word has dictionary entries.
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
}

export interface QueryResult<T = unknown> {
  type: QueryType;
  sourceResult: QueryTypeResult<T>;
  displaySections?: DisplaySection[];
  hideDisplay?: boolean;
}
