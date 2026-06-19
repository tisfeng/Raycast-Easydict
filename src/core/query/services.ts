/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/preferences";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { requestAppleTranslate } from "@/providers/translation/apple";
import { requestBaiduTextTranslate } from "@/providers/translation/baidu";
import { requestWebBingTranslate } from "@/providers/translation/bing";
import { requestCaiyunTextTranslate } from "@/providers/translation/caiyun";
import { requestDeepLTranslate } from "@/providers/translation/deepL";
import { requestDeepLXTranslate } from "@/providers/translation/deepLX";
import { requestGeminiTranslate } from "@/providers/translation/gemini";
import { requestGoogleTranslate } from "@/providers/translation/google";
import { requestTencentTranslate } from "@/providers/translation/tencent";
import { requestVolcanoTranslate } from "@/providers/translation/volcano";
import { requestYoudaoWebTranslate } from "@/providers/translation/youdao";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { checkIsWord } from "@/utils/text";

export interface TranslationServiceConfig {
  type: TranslationType;
  preference: keyof Preferences;
  requestFn: (queryWordInfo: QueryWordInfo, signal?: AbortSignal) => Promise<QueryTypeResult>;
  isEnabled?: (queryWordInfo: QueryWordInfo) => boolean;
}

/** Static registry — same values as current DataManager.translationServices. */
export const translationServices: TranslationServiceConfig[] = [
  { type: TranslationType.Bing, preference: "enableBingTranslate", requestFn: requestWebBingTranslate },
  { type: TranslationType.Baidu, preference: "enableBaiduTranslate", requestFn: requestBaiduTextTranslate },
  { type: TranslationType.Tencent, preference: "enableTencentTranslate", requestFn: requestTencentTranslate },
  { type: TranslationType.Volcano, preference: "enableVolcanoTranslate", requestFn: requestVolcanoTranslate },
  { type: TranslationType.Caiyun, preference: "enableCaiyunTranslate", requestFn: requestCaiyunTextTranslate },
  { type: TranslationType.Gemini, preference: "enableGeminiTranslate", requestFn: requestGeminiTranslate },
  { type: TranslationType.Google, preference: "enableGoogleTranslate", requestFn: requestGoogleTranslate },
  { type: TranslationType.DeepL, preference: "enableDeepLTranslate", requestFn: requestDeepLTranslate },
  { type: TranslationType.DeepLX, preference: "enableDeepLXTranslate", requestFn: requestDeepLXTranslate },
  { type: TranslationType.Apple, preference: "enableAppleTranslate", requestFn: requestAppleTranslate },
  {
    type: TranslationType.Youdao,
    preference: "enableYoudaoTranslate",
    isEnabled: (q) =>
      myPreferences.enableYoudaoTranslate ||
      (myPreferences.enableYoudaoDictionary && getYoudaoWebDictionaryURL(q) !== undefined && checkIsWord(q)),
    requestFn: requestYoudaoWebTranslate,
  },
];
