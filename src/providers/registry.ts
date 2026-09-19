/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { StoredAIProviderState } from "@/ai-providers/types";
import { myPreferences } from "@/consts";

import { type DictionaryServiceConfig, resolveDictionaryServices } from "./dictionary";
import type { NativeJSONUnsupportedHandler } from "./dictionary/ai";
import { assignGlobalServiceOrder, getCombinedProviderOrder } from "./order";
import { resolveTranslationServices, type TranslationServiceConfig } from "./translation";

export interface ProviderServiceSnapshot {
  translationServices: TranslationServiceConfig[];
  dictionaryServices: DictionaryServiceConfig[];
}

export function resolveProviderServices(
  state: StoredAIProviderState,
  onNativeJSONUnsupported?: NativeJSONUnsupportedHandler,
): ProviderServiceSnapshot {
  const { profiles, providerOrder: savedOrder } = state;
  const providerOrder = getCombinedProviderOrder(
    profiles,
    savedOrder,
    myPreferences.servicesOrder ? myPreferences.servicesOrder.split(",") : [],
  );
  return {
    translationServices: assignGlobalServiceOrder(resolveTranslationServices(profiles), providerOrder),
    dictionaryServices: assignGlobalServiceOrder(
      resolveDictionaryServices(profiles, onNativeJSONUnsupported),
      providerOrder,
    ),
  };
}

const builtinSnapshot = resolveProviderServices({ version: 2, profiles: [], migratedLegacyProviders: [] });
export const builtinDictionaryProviderServices = builtinSnapshot.dictionaryServices;
export const builtinTranslationServices = builtinSnapshot.translationServices;
