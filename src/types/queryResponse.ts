/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { LingueeDictionaryResult } from "@/providers/dictionary/linguee/types";
import type {
  YoudaoDictionaryFormatResult,
  YoudaoTranslateResponse,
  YoudaoWebTranslateResult,
} from "@/providers/dictionary/youdao/types";
import type { AppleTranslateResult } from "@/providers/translation/apple";
import type { BaiduTranslateResult, BaiduWebLanguageDetect } from "@/providers/translation/baidu";
import type { BingTranslateResult } from "@/providers/translation/bing";
import type { CaiyunTranslateResult } from "@/providers/translation/caiyun";
import type { DeepLTranslateResult } from "@/providers/translation/deepL";
import type { GeminiTranslateResult } from "@/providers/translation/gemini";
import type { GoogleTranslateResult } from "@/providers/translation/google";
import type { OpenAITranslateResult } from "@/providers/translation/openai";
import type { TencentTranslateResult } from "@/providers/translation/tencent";
import type { VolcanoDetectResult, VolcanoTranslateResult } from "@/providers/translation/volcano";

export type QueryResponse =
  | YoudaoDictionaryFormatResult
  | YoudaoWebTranslateResult
  | YoudaoTranslateResponse
  | LingueeDictionaryResult
  | BaiduTranslateResult
  | BaiduWebLanguageDetect
  | BingTranslateResult
  | TencentTranslateResult
  | CaiyunTranslateResult
  | DeepLTranslateResult
  | AppleTranslateResult
  | VolcanoTranslateResult
  | VolcanoDetectResult
  | GoogleTranslateResult
  | OpenAITranslateResult
  | GeminiTranslateResult;
