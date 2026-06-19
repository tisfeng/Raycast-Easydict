/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LanguageDetectType } from "@/core/detect/types";

import { BaiduDetectProvider } from "./baidu";
import type { BaseDetectProvider } from "./base";
import { BingDetectProvider } from "./bing";
import { FrancDetectProvider } from "./franc";
import { TencentDetectProvider } from "./tencent";
import { VolcanoDetectProvider } from "./volcano";

export interface DetectServiceConfig {
  type: LanguageDetectType;
  preference?: keyof Preferences;
  provider: new () => BaseDetectProvider;
}

/** Static registry — detect provider classes, instantiated by the engine. */
export const detectServices: DetectServiceConfig[] = [
  { type: LanguageDetectType.Bing, provider: BingDetectProvider },
  { type: LanguageDetectType.Baidu, preference: "enableBaiduLanguageDetect", provider: BaiduDetectProvider },
  { type: LanguageDetectType.Tencent, preference: "enableTencentTranslate", provider: TencentDetectProvider },
  { type: LanguageDetectType.Volcano, preference: "enableVolcanoTranslate", provider: VolcanoDetectProvider },
  { type: LanguageDetectType.Franc, provider: FrancDetectProvider },
];
