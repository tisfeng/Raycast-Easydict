/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { hasImportedLegacyAIProvider } from "@/ai-providers/legacy";
import { getAIProviderProfileValidationError } from "@/ai-providers/profile";
import type { AIProviderProfile, ProviderIconConfig } from "@/ai-providers/types";
import { myPreferences } from "@/consts";
import { getLangCode } from "@/core/language/utils";
import { getLingueeWebDictionaryURL } from "@/providers/dictionary/linguee/parse";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { checkIsWord } from "@/providers/shared/utils";
import { TranslationType } from "@/types/api";
import type { BooleanPreferenceKey } from "@/types/preferences";
import type { QueryInput } from "@/types/query";

import { AppleTranslateProvider } from "./apple";
import { BaiduTranslateProvider } from "./baidu";
import type { BaseTranslateProvider } from "./base";
import { BingTranslateProvider } from "./bing";
import { CaiyunTranslateProvider } from "./caiyun";
import { DeepLTranslateProvider } from "./deepL";
import { DeepLXTranslateProvider } from "./deepLX";
import { GoogleTranslateProvider } from "./google";
import { GeminiTranslateProvider, OpenAITranslateProvider } from "./openai-compatible";
import { ConfiguredOpenAICompatibleTranslateProvider } from "./openai-compatible/configured";
import { getRaycastAIModel, RaycastAITranslateProvider } from "./raycast-ai";
import { TencentTranslateProvider } from "./tencent";
import { VolcanoTranslateProvider } from "./volcano";
import { YoudaoTranslateProvider } from "./youdao";

export interface TranslationServiceConfig {
  id: string;
  label: string;
  order: number;
  revision: string;
  type: TranslationType;
  icon?: ProviderIconConfig;
  enabled: (queryWordInfo: QueryInput) => boolean;
  createProvider: () => BaseTranslateProvider;
  getWebUrl?: (queryWordInfo: QueryInput) => string | undefined;
}

/** Static registry — provider classes, instantiated by the engine. */
const staticTranslationServices: Array<
  Omit<TranslationServiceConfig, "id" | "label" | "order" | "revision" | "enabled" | "createProvider"> & {
    preference: BooleanPreferenceKey;
    provider: new () => BaseTranslateProvider;
    isEnabled?: (queryWordInfo: QueryInput) => boolean;
  }
> = [
  { type: TranslationType.Bing, preference: "enableBingTranslate", provider: BingTranslateProvider },
  {
    type: TranslationType.Baidu,
    preference: "enableBaiduTranslate",
    provider: BaiduTranslateProvider,
    getWebUrl: (q) => {
      const text = encodeURIComponent(q.word);
      const from = getLangCode(q.fromLanguage, "baiduLangCode");
      const to = getLangCode(q.toLanguage, "baiduLangCode");
      return from && to ? `https://fanyi.baidu.com/#${from}/${to}/${text}` : undefined;
    },
  },
  { type: TranslationType.Tencent, preference: "enableTencentTranslate", provider: TencentTranslateProvider },
  { type: TranslationType.Volcano, preference: "enableVolcanoTranslate", provider: VolcanoTranslateProvider },
  { type: TranslationType.Caiyun, preference: "enableCaiyunTranslate", provider: CaiyunTranslateProvider },
  { type: TranslationType.Gemini, preference: "enableGeminiTranslate", provider: GeminiTranslateProvider },
  {
    type: TranslationType.Google,
    preference: "enableGoogleTranslate",
    provider: GoogleTranslateProvider,
    getWebUrl: (q) => {
      const text = encodeURIComponent(q.word);
      const from = getLangCode(q.fromLanguage, "googleLangCode");
      const to = getLangCode(q.toLanguage, "googleLangCode");
      return from && to ? `https://translate.google.com/?sl=${from}&tl=${to}&text=${text}&op=translate` : undefined;
    },
  },
  {
    type: TranslationType.DeepL,
    preference: "enableDeepLTranslate",
    isEnabled: (q) => {
      const explicitlyEnabled = myPreferences.enableDeepLTranslate;
      const implicitlyEnabledByLinguee =
        myPreferences.enableLingueeDictionary &&
        !!myPreferences.deepLAuthKey &&
        getLingueeWebDictionaryURL(q) !== undefined;
      return explicitlyEnabled || implicitlyEnabledByLinguee;
    },
    provider: DeepLTranslateProvider,
    getWebUrl: (q) => {
      const text = encodeURIComponent(q.word);
      const from = getLangCode(q.fromLanguage, "deepLSourceId")?.toLowerCase();
      const to = getLangCode(q.toLanguage, "deepLSourceId")?.toLowerCase();
      return from && to ? `https://www.deepl.com/translator#${from}/${to}/${text}` : undefined;
    },
  },
  {
    type: TranslationType.DeepLX,
    preference: "enableDeepLXTranslate",
    provider: DeepLXTranslateProvider,
    getWebUrl: (q) => {
      const text = encodeURIComponent(q.word);
      const from = getLangCode(q.fromLanguage, "deepLSourceId")?.toLowerCase();
      const to = getLangCode(q.toLanguage, "deepLSourceId")?.toLowerCase();
      return from && to ? `https://www.deepl.com/translator#${from}/${to}/${text}` : undefined;
    },
  },
  { type: TranslationType.Apple, preference: "enableAppleTranslate", provider: AppleTranslateProvider },
  {
    type: TranslationType.Youdao,
    preference: "enableYoudaoTranslate",
    isEnabled: (q) => {
      const explicitlyEnabled = myPreferences.enableYoudaoTranslate;
      const implicitlyEnabledByDictionary =
        myPreferences.enableYoudaoDictionary && getYoudaoWebDictionaryURL(q) !== undefined && checkIsWord(q);
      return explicitlyEnabled || implicitlyEnabledByDictionary;
    },
    provider: YoudaoTranslateProvider,
  },
  {
    type: TranslationType.OpenAI,
    preference: "enableOpenAITranslate",
    provider: OpenAITranslateProvider,
  },
];

export const translationServices: TranslationServiceConfig[] = staticTranslationServices.map((service, order) => ({
  id: `static:${service.type}`,
  label: service.type,
  order,
  revision: `static:${service.type}`,
  type: service.type,
  enabled: service.isEnabled ?? (() => myPreferences[service.preference]),
  createProvider: () => new service.provider(),
  getWebUrl: service.getWebUrl,
}));

export const translationServicesBeforeAIProfilesLoad = translationServices.filter(
  (service) => service.type !== TranslationType.OpenAI && service.type !== TranslationType.Gemini,
);

export function resolveTranslationServices(profiles: AIProviderProfile[]): TranslationServiceConfig[] {
  const dynamicServices = profiles.map((profile): TranslationServiceConfig => {
    const icon =
      profile.icon.kind === "favicon" && !profile.icon.website && profile.adapter === "openai-compatible"
        ? { kind: "favicon" as const, website: profile.website ?? profile.endpoint }
        : profile.icon;
    const common = {
      id: `profile:${profile.id}`,
      label: profile.name,
      order: profile.order,
      revision: JSON.stringify(profile),
      type: TranslationType.OpenAI,
      icon,
      enabled: () => profile.enabled && isAIProviderProfileRunnable(profile),
    };

    return {
      ...common,
      createProvider: () => createAITranslationProvider(profile),
    };
  });
  const legacyServices = translationServices.filter((service) => {
    if (service.type === TranslationType.OpenAI) {
      return !hasImportedLegacyAIProvider(profiles, "openai");
    }
    if (service.type === TranslationType.Gemini) {
      return !hasImportedLegacyAIProvider(profiles, "gemini");
    }
    return true;
  });
  return [...legacyServices, ...dynamicServices];
}

export function createAITranslationProvider(profile: AIProviderProfile): BaseTranslateProvider {
  return profile.adapter === "raycast-ai"
    ? new RaycastAITranslateProvider(profile)
    : new ConfiguredOpenAICompatibleTranslateProvider(profile);
}

export function isAIProviderProfileRunnable(profile: AIProviderProfile): boolean {
  if (getAIProviderProfileValidationError(profile)) return false;
  if (profile.adapter === "raycast-ai") {
    return getRaycastAIModel(profile.model) !== undefined;
  }
  return true;
}
