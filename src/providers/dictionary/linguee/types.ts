/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { LingueeListItemType } from "@/core/results/kinds";
import type { QueryWordInfo } from "@/core/results/types";

export interface LingueeParseResult {
  queryWordInfo: QueryWordInfo;
  result?: LingueeDictionaryResult;
}

export interface LingueeDictionaryResult {
  wordItems: LingueeWordItem[];
  examples: LingueeExample[];
  relatedWords: LingueeWordItem[];
  wikipedias: LingueeWikipedia[];
}

export interface LingueeWordItem {
  word: string;
  title: string;
  featured: boolean;
  pos: string; // part of speech, e.g. noun, verb, adj, etc.
  placeholder: string; // eg. (sth. ~), sth.
  audioUrl: string; // may have value when search English word, there are US and UK audio, we use US audio
  translationItems: LingueeWordExplanation[];
}

export interface LingueeWordExplanation {
  featured?: boolean;
  translation: string;
  pos: string;
  audioUrl: string; // may have value when search Chinese word
  examples: LingueeExample[]; // French: good
  frequencyTag: LingueeFrequencyTag;
}

export interface LingueeFrequencyTag {
  tagForms: string; // (often used), (almost always used), "good" in French: (bonne f sl, bons m pl, bonnes f pl)
  displayType: LingueeListItemType; // as frequency use: AlmostAlways, OfenUsed, Common, LessCommon
}

export interface LingueeExample {
  example: LingueePosText;
  // translation: string;
  // pos: string;
  translations: LingueePosText[];
}

export interface LingueePosText {
  text: string; // good
  pos: string; // adj
}

export interface LingueeWikipedia {
  title: string;
  explanation: string;
  source: string;
  sourceUrl: string;
}
