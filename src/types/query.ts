/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import { DetectedLangModel } from "@/core/detect/types";
import { RequestError } from "@/utils/errors";

import { DictionaryType, TranslationType } from "./api";
import { DisplaySection } from "./display";
import type { QueryResponse } from "./queryResponse";

/**
 * Streaming callbacks — only used by streaming providers (e.g. OpenAI).
 * Passed via request options, not on QueryWordInfo.
 */
export interface StreamingCallbacks {
  onMessage?: (message: { content: string; role: string }) => void;
  onFinish?: (reason: string) => void;
}

export interface QueryWordInfo extends StreamingCallbacks {
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
