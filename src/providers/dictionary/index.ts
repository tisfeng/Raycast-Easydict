/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getAIProviderQueryMode, resolveAIProviderIcon } from "@/ai-providers/runtime";
import type { AIProviderProfile } from "@/ai-providers/types";
import { myPreferences } from "@/consts";
import { getLanguageOfTwoExceptChinese } from "@/core/language/utils";
import { getLingueeWebDictionaryURL } from "@/providers/dictionary/linguee/parse";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { checkIsWord } from "@/providers/shared/utils";
import { DictionaryType } from "@/types/api";
import type { BooleanPreferenceKey } from "@/types/preferences";
import type { QueryInput, RuntimeServiceConfig } from "@/types/query";

import { createAIDictionaryProvider } from "./ai";
import type { BaseDictionaryProvider } from "./base";
import { LingueeDictionaryProvider } from "./linguee";
import { YoudaoDictionaryProvider } from "./youdao";

interface DictionaryWebServiceConfig {
  type: DictionaryType;
  getWebUrl?: (queryWordInfo: QueryInput) => string | undefined;
}

export interface DictionaryServiceConfig extends DictionaryWebServiceConfig, RuntimeServiceConfig {
  enabled: (queryWordInfo: QueryInput) => boolean;
  createProvider: () => BaseDictionaryProvider;
  canTriggerAutomaticAudio: boolean;
}

const staticDictionaryServices: Array<
  DictionaryWebServiceConfig & {
    preference: BooleanPreferenceKey;
    provider: new () => BaseDictionaryProvider;
    isEnabled?: (queryWordInfo: QueryInput) => boolean;
  }
> = [
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
];

export const dictionaryProviderServices: DictionaryServiceConfig[] = staticDictionaryServices.map((service, order) => ({
  id: `static:${service.type}`,
  label: service.type,
  order,
  revision: `static:${service.type}`,
  type: service.type,
  enabled: service.isEnabled ?? (() => myPreferences[service.preference]),
  createProvider: () => new service.provider(),
  canTriggerAutomaticAudio: true,
  getWebUrl: service.getWebUrl,
}));

export function resolveDictionaryServices(profiles: AIProviderProfile[]): DictionaryServiceConfig[] {
  const dynamicServices = profiles
    .filter((profile) => profile.wordResultMode === "dictionary")
    .map(
      (profile): DictionaryServiceConfig => ({
        id: `profile:${profile.id}:dictionary`,
        label: profile.name,
        order: profile.order,
        revision: `dictionary:${JSON.stringify(profile)}`,
        type: DictionaryType.AI,
        icon: resolveAIProviderIcon(profile),
        enabled: (queryWordInfo) => getAIProviderQueryMode(profile, queryWordInfo) === "dictionary",
        createProvider: () => createAIDictionaryProvider(profile),
        canTriggerAutomaticAudio: false,
      }),
    );
  return [...dictionaryProviderServices, ...dynamicServices];
}

export const dictionaryServices: DictionaryWebServiceConfig[] = [
  ...dictionaryProviderServices,
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
