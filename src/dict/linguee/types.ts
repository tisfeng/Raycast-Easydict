/*
 * @author: tisfeng
 * @createTime: 2022-07-25 22:10
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-29 16:21
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { QueryWordInfo } from "../../types";

export interface LingueeDictionaryResult {
  queryWordInfo: QueryWordInfo;
  wordItems?: LingueeWordItem[];
  examples?: LingueeExample[];
  relatedWords?: LingueeWordItem[];
}

export interface LingueeWordItem {
  word: string;
  featured: boolean;
  pos?: string; // part of speech, e.g. noun, verb, adj, etc.
  placeholder?: string;
  audioUrl?: string; // may have value when search English word, there are US and UK audio, we use US audio
  explanationItems?: LingueeWordExplanation[];
}

export interface LingueeWordExplanation {
  featured?: boolean;
  explanation: string;
  pos: string;
  frequency?: LingueeDisplayType; // AlmostAlways, OfenUsed, Common, LessCommon
  audioUrl?: string; // may have value when search Chinese word
}

export interface LingueeExample {
  example?: string;
  translation?: string;
}

export enum LingueeDisplayType {
  AlmostAlways = "almost always used", // also featured, eg. true
  OftenUsed = "often used", // also featured, eg. good
  Common = "common", // also featured
  LessCommon = "less common", // unfeatured

  Unfeatured = "unfeatured",
  Example = "example",
  RelatedWord = "see also",
}
