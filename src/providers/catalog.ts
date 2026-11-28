/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { DictionaryType, TranslationType } from "@/core/results/kinds";
import type { BuiltinEnabledOverrides } from "@/providers/profiles/types";
import type { BooleanPreferenceKey } from "@/types/preferences";

type BuiltinProviderCategory = "dictionary" | "translation";

export const defaultTypeOrder = [
  DictionaryType.Youdao,
  DictionaryType.Linguee,
  DictionaryType.Wiktionary,
  DictionaryType.AI,
  TranslationType.OpenAI,
  TranslationType.Gemini,
  TranslationType.DeepL,
  TranslationType.DeepLX,
  TranslationType.Google,
  TranslationType.Bing,
  TranslationType.Apple,
  TranslationType.Baidu,
  TranslationType.Volcano,
  TranslationType.Youdao,
  TranslationType.Caiyun,
];

export function getBuiltinProviderKey(category: BuiltinProviderCategory, type: string): string {
  return `builtin:${category}:${type}`;
}

const definitions = [
  { category: "dictionary", type: DictionaryType.Youdao, preference: "enableYoudaoDictionary" },
  { category: "dictionary", type: DictionaryType.Linguee, preference: "enableLingueeDictionary" },
  { category: "dictionary", type: DictionaryType.Wiktionary, preference: "enableWiktionaryDictionary" },
  { category: "translation", type: TranslationType.Bing, preference: "enableBingTranslate" },
  { category: "translation", type: TranslationType.Baidu, preference: "enableBaiduTranslate" },
  { category: "translation", type: TranslationType.Volcano, preference: "enableVolcanoTranslate" },
  { category: "translation", type: TranslationType.Caiyun, preference: "enableCaiyunTranslate" },
  { category: "translation", type: TranslationType.Google, preference: "enableGoogleTranslate" },
  { category: "translation", type: TranslationType.DeepL, preference: "enableDeepLTranslate" },
  { category: "translation", type: TranslationType.DeepLX, preference: "enableDeepLXTranslate" },
  { category: "translation", type: TranslationType.Apple, preference: "enableAppleTranslate" },
  { category: "translation", type: TranslationType.Youdao, preference: "enableYoudaoTranslate" },
] as const satisfies ReadonlyArray<{
  category: BuiltinProviderCategory;
  type: DictionaryType | TranslationType;
  preference: BooleanPreferenceKey;
}>;

export const builtinProviderCatalog = definitions.map((definition) => ({
  ...definition,
  id: `static:${definition.type}`,
  label: definition.type,
  providerKey: getBuiltinProviderKey(definition.category, definition.type),
  order: defaultTypeOrder.indexOf(definition.type),
}));

export type BuiltinProvider = (typeof builtinProviderCatalog)[number];
export const builtinDictionaryProviders = builtinProviderCatalog.filter(
  (provider) => provider.category === "dictionary",
);
export const builtinTranslationProviders = builtinProviderCatalog.filter(
  (provider) => provider.category === "translation",
);

export function getEffectiveBuiltinPreference(
  provider: BuiltinProvider,
  preferences: Preferences,
  overrides?: BuiltinEnabledOverrides,
): boolean {
  const override = overrides?.[provider.providerKey];
  if (override !== undefined) return override;
  return preferences[provider.preference];
}

export function getBuiltinProviderPreferenceStatus(
  provider: BuiltinProvider,
  preferences: Preferences,
  overrides?: BuiltinEnabledOverrides,
) {
  const override = overrides?.[provider.providerKey];
  if (override !== undefined) {
    return { enabledInPreferences: override, implicitlyEnabledBy: undefined as string | undefined, hasOverride: true };
  }

  const enabledInPreferences = preferences[provider.preference];
  if (enabledInPreferences) {
    return { enabledInPreferences: true, implicitlyEnabledBy: undefined, hasOverride: false };
  }

  if (provider.type === TranslationType.DeepL) {
    const linguee = builtinProviderCatalog.find((candidate) => candidate.type === DictionaryType.Linguee);
    if (linguee && getEffectiveBuiltinPreference(linguee, preferences, overrides) && preferences.deepLAuthKey) {
      return { enabledInPreferences: false, implicitlyEnabledBy: "Linguee", hasOverride: false };
    }
  }

  if (provider.type === TranslationType.Youdao) {
    const youdaoDictionary = builtinProviderCatalog.find((candidate) => candidate.type === DictionaryType.Youdao);
    if (youdaoDictionary && getEffectiveBuiltinPreference(youdaoDictionary, preferences, overrides)) {
      return { enabledInPreferences: false, implicitlyEnabledBy: "Youdao Dictionary", hasOverride: false };
    }
  }

  return { enabledInPreferences: false, implicitlyEnabledBy: undefined, hasOverride: false };
}

export function withBuiltinEnabledOverride(
  overrides: BuiltinEnabledOverrides | undefined,
  providerKey: string,
  enabled: boolean | undefined,
): BuiltinEnabledOverrides | undefined {
  const next = { ...overrides };
  if (enabled === undefined) {
    delete next[providerKey];
  } else {
    next[providerKey] = enabled;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
