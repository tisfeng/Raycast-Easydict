/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { DictionaryType } from "@/core/results/kinds";
import type { QueryInput, RuntimeServiceConfig } from "@/core/results/types";
import { builtinDictionaryProviders, getEffectiveBuiltinPreference } from "@/providers/catalog";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import type { BuiltinEnabledOverrides } from "@/providers/profiles/types";
import { checkIsWord } from "@/providers/shared/utils";

import type { BaseDictionaryProvider } from "./base";
import { LingueeDictionaryProvider } from "./linguee";
import { WiktionaryDictionaryProvider } from "./wiktionary";
import { YoudaoDictionaryProvider } from "./youdao";

export interface DictionaryServiceConfig extends RuntimeServiceConfig {
  type: DictionaryType;
  enabled: (queryWordInfo: QueryInput) => boolean;
  createProvider: () => BaseDictionaryProvider;
  canTriggerAutomaticAudio: boolean;
}

const builtinProviderClasses = {
  [DictionaryType.Youdao]: YoudaoDictionaryProvider,
  [DictionaryType.Linguee]: LingueeDictionaryProvider,
  [DictionaryType.Wiktionary]: WiktionaryDictionaryProvider,
} satisfies Record<(typeof builtinDictionaryProviders)[number]["type"], new () => BaseDictionaryProvider>;

function supportsQuery(type: DictionaryType, query: QueryInput): boolean {
  switch (type) {
    case DictionaryType.Youdao:
      return getYoudaoWebDictionaryURL(query) !== undefined && checkIsWord(query);
    case DictionaryType.Wiktionary:
      return checkIsWord(query);
    default:
      return true;
  }
}

export function isBuiltinDictionaryEnabled(
  service: { providerKey: string; type: DictionaryType },
  query: QueryInput,
  preferences: Preferences,
  overrides?: BuiltinEnabledOverrides,
): boolean {
  const provider = builtinDictionaryProviders.find((candidate) => candidate.providerKey === service.providerKey);
  if (!provider) return false;
  return getEffectiveBuiltinPreference(provider, preferences, overrides) && supportsQuery(service.type, query);
}

export const builtinDictionaryServices: DictionaryServiceConfig[] = builtinDictionaryProviders.map((service) => ({
  ...service,
  cacheIdentity: service.type,
  enabled: (query) => isBuiltinDictionaryEnabled(service, query, myPreferences),
  createProvider: () => new builtinProviderClasses[service.type](),
  canTriggerAutomaticAudio: true,
}));
