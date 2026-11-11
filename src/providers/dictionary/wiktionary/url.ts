/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getWiktionaryLanguage } from "@/core/language/utils";
import type { QueryInput } from "@/core/results/types";
import { checkIsWord } from "@/providers/shared/utils";

export function getWiktionaryTitle(word: string): string {
  return encodeURIComponent(word.trim().replace(/ /g, "_"));
}

export function getWiktionaryWebURL(queryWordInfo: QueryInput): string | undefined {
  if (!checkIsWord(queryWordInfo)) return undefined;
  const anchor = getWiktionaryLanguage(queryWordInfo.fromLanguage).names[0].replace(/ /g, "_");
  return `https://en.wiktionary.org/wiki/${getWiktionaryTitle(queryWordInfo.word)}#${anchor}`;
}
