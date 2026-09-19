/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getAIProviderCacheIdentity } from "@/ai-providers/cacheIdentity";
import { getAIProviderQueryMode, resolveAIProviderIcon } from "@/ai-providers/runtime";
import type { AIProviderProfile } from "@/ai-providers/types";
import { myPreferences } from "@/consts";
import { DictionaryType } from "@/core/results/kinds";
import type { QueryInput, RuntimeServiceConfig } from "@/core/results/types";
import { builtinDictionaryProviders } from "@/providers/catalog";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { getAIProviderKey } from "@/providers/order";
import { checkIsWord } from "@/providers/shared/utils";

import { createAIDictionaryProvider, type NativeJSONUnsupportedHandler } from "./ai";
import type { BaseDictionaryProvider } from "./base";
import { LingueeDictionaryProvider } from "./linguee";
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
} satisfies Record<(typeof builtinDictionaryProviders)[number]["type"], new () => BaseDictionaryProvider>;

const builtinServices: DictionaryServiceConfig[] = builtinDictionaryProviders.map((service) => ({
  ...service,
  cacheIdentity: service.type,
  enabled: (query) =>
    myPreferences[service.preference] &&
    (service.type !== DictionaryType.Youdao || (getYoudaoWebDictionaryURL(query) !== undefined && checkIsWord(query))),
  createProvider: () => new builtinProviderClasses[service.type](),
  canTriggerAutomaticAudio: true,
}));

export function resolveDictionaryServices(
  profiles: AIProviderProfile[],
  onNativeJSONUnsupported?: NativeJSONUnsupportedHandler,
): DictionaryServiceConfig[] {
  const dynamicServices = profiles
    .filter((profile) => profile.wordResultMode === "dictionary")
    .map((profile): DictionaryServiceConfig => ({
      id: `profile:${profile.id}:dictionary`,
      label: profile.name,
      providerKey: getAIProviderKey(profile),
      order: profile.order,
      type: DictionaryType.AI,
      icon: resolveAIProviderIcon(profile),
      cacheIdentity: getAIProviderCacheIdentity(profile, 1),
      enabled: (queryWordInfo) => getAIProviderQueryMode(profile, queryWordInfo) === "dictionary",
      createProvider: () => createAIDictionaryProvider(profile, onNativeJSONUnsupported),
      canTriggerAutomaticAudio: false,
    }));
  return [...builtinServices, ...dynamicServices];
}
