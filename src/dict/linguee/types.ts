/*
 * @author: tisfeng
 * @createTime: 2022-07-25 22:10
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-27 18:14
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { QueryWordInfo } from "../../types";

export interface LingueeDictionaryResult {
  queryWordInfo: QueryWordInfo;
  wordItems?: LingueeWordItem[];
  examples?: LingueeExample[];
}

export interface LingueeWordItem {
  word: string;
  partOfSpeech?: string;
  placeholder?: string;
  explanationItems?: LingueeWordExplanation[];
}

export interface LingueeWordExplanation {
  explanation: string;
  partOfSpeech: string;
  frequency?: WordFrequencey;
  isFeatured?: boolean;
}

export enum WordFrequencey {
  OftenUsed = "often used", // featured
  Common = "common", // featured
  LessCommon = "less common", // unfeatured
}

export interface LingueeExample {
  example?: string;
  translation?: string;
}

export enum LingueeDisplayType {
  OftenUsed,
  Common,
  LessCommon,
  Unfeatured,
  Example,
}
