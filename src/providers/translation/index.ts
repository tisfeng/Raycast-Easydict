/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { TranslationType } from "@/core/results/kinds";
import type { QueryInput, RuntimeServiceConfig } from "@/core/results/types";
import { builtinTranslationProviders, getBuiltinProviderPreferenceStatus } from "@/providers/catalog";
import { getLingueeWebDictionaryURL } from "@/providers/dictionary/linguee/url";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import type { BuiltinEnabledOverrides } from "@/providers/profiles/types";
import { checkIsWord } from "@/providers/shared/utils";

import { AppleTranslateProvider } from "./apple";
import { BaiduTranslateProvider } from "./baidu";
import type { BaseTranslateProvider } from "./base";
import { BingTranslateProvider } from "./bing";
import { CaiyunTranslateProvider } from "./caiyun";
import { DeepLTranslateProvider } from "./deepL";
import { DeepLXTranslateProvider } from "./deepLX";
import { GoogleTranslateProvider } from "./google";
import { VolcanoTranslateProvider } from "./volcano";
import { YoudaoTranslateProvider } from "./youdao";

export interface TranslationServiceConfig extends RuntimeServiceConfig {
  type: TranslationType;
  enabled: (queryWordInfo: QueryInput) => boolean;
  createProvider: () => BaseTranslateProvider;
}

function getBuiltinTranslationCacheIdentity(type: TranslationType): string {
  switch (type) {
    case TranslationType.Bing:
      return JSON.stringify({ type, host: myPreferences.bingHost });
    case TranslationType.DeepL:
      return JSON.stringify({ type, endpoint: myPreferences.deepLEndpoint, credential: myPreferences.deepLAuthKey });
    case TranslationType.Baidu:
      return JSON.stringify({ type, appId: myPreferences.baiduAppId, credential: myPreferences.baiduAppSecret });
    case TranslationType.Volcano:
      return JSON.stringify({
        type,
        accessKeyId: myPreferences.volcanoAccessKeyId,
        credential: myPreferences.volcanoAccessKeySecret,
      });
    case TranslationType.Caiyun:
      return JSON.stringify({ type, credential: myPreferences.caiyunToken });
    default:
      return type;
  }
}

const builtinProviderClasses = {
  [TranslationType.Bing]: BingTranslateProvider,
  [TranslationType.Baidu]: BaiduTranslateProvider,
  [TranslationType.Volcano]: VolcanoTranslateProvider,
  [TranslationType.Caiyun]: CaiyunTranslateProvider,
  [TranslationType.Google]: GoogleTranslateProvider,
  [TranslationType.DeepL]: DeepLTranslateProvider,
  [TranslationType.DeepLX]: DeepLXTranslateProvider,
  [TranslationType.Apple]: AppleTranslateProvider,
  [TranslationType.Youdao]: YoudaoTranslateProvider,
} satisfies Record<(typeof builtinTranslationProviders)[number]["type"], new () => BaseTranslateProvider>;

export function isBuiltinTranslationEnabled(
  service: { providerKey: string; type: TranslationType },
  query: QueryInput,
  preferences: Preferences,
  overrides?: BuiltinEnabledOverrides,
): boolean {
  const provider = builtinTranslationProviders.find((candidate) => candidate.providerKey === service.providerKey);
  if (!provider) return false;
  const status = getBuiltinProviderPreferenceStatus(provider, preferences, overrides);
  if (status.enabledInPreferences) return true;
  if (service.type === TranslationType.DeepL) {
    return Boolean(status.implicitlyEnabledBy) && getLingueeWebDictionaryURL(query) !== undefined;
  }
  if (service.type === TranslationType.Youdao) {
    return Boolean(status.implicitlyEnabledBy) && getYoudaoWebDictionaryURL(query) !== undefined && checkIsWord(query);
  }
  return false;
}

export const builtinTranslationServices: TranslationServiceConfig[] = builtinTranslationProviders.map((service) => ({
  ...service,
  cacheIdentity: getBuiltinTranslationCacheIdentity(service.type),
  enabled: (query) => isBuiltinTranslationEnabled(service, query, myPreferences),
  createProvider: () => new builtinProviderClasses[service.type](),
}));
