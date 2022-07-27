/*
 * @author: tisfeng
 * @createTime: 2022-07-25 22:10
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-27 18:41
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
  frequency?: LingueeDisplayType;
  isFeatured?: boolean;
}

export interface LingueeExample {
  example?: string;
  translation?: string;
}

export enum LingueeDisplayType {
  OftenUsed = "often used", // also featured
  Common = "common", // also featured
  LessCommon = "less common", // unfeatured

  Unfeatured = "unfeatured",
  Example = "example",
}
