/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { getLanguageOfTwoExceptChinese } from "@/core/language/utils";
import { getLingueeWebDictionaryURL } from "@/providers/dictionary/linguee/parse";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { checkIsWord } from "@/providers/shared/utils";
import { DictionaryType } from "@/types/api";
import type { BooleanPreferenceKey } from "@/types/preferences";
import type { QueryInput } from "@/types/query";

import type { BaseDictionaryProvider } from "./base";
import { LingueeDictionaryProvider } from "./linguee";
import { YoudaoDictionaryProvider } from "./youdao";

export interface DictionaryServiceConfig {
  type: DictionaryType;
  preference?: BooleanPreferenceKey;
  provider?: new () => BaseDictionaryProvider;
  isEnabled?: (queryWordInfo: QueryInput) => boolean;
  getWebUrl?: (queryWordInfo: QueryInput) => string | undefined;
}

export const dictionaryServices: DictionaryServiceConfig[] = [
  {
    type: DictionaryType.Youdao,
    preference: "enableYoudaoDictionary",
    isEnabled: (q) =>
      myPreferences.enableYoudaoDictionary && getYoudaoWebDictionaryURL(q) !== undefined && checkIsWord(q),
    provider: YoudaoDictionaryProvider,
    getWebUrl: getYoudaoWebDictionaryURL,
  },
  {
    type: DictionaryType.Linguee,
    preference: "enableLingueeDictionary",
    provider: LingueeDictionaryProvider,
    getWebUrl: getLingueeWebDictionaryURL,
  },
  {
    type: DictionaryType.Eudic,
    getWebUrl: (q) => {
      const LangCode = getLanguageOfTwoExceptChinese([q.fromLanguage, q.toLanguage]);
      if (!LangCode) return;
      const eudicDictionaryLanguages = ["en", "fr", "de", "es"];
      if (eudicDictionaryLanguages.includes(LangCode)) {
        return `https://dict.eudic.net/dicts/${LangCode}/${encodeURIComponent(q.word)}`;
      }
    },
  },
];
