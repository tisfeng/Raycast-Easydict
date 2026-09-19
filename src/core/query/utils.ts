/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { config } from "@/core/config";
import type { LanguageItem } from "@/core/language/types";
import { logTrace } from "@/shared/logger";

/**
 * Get auto select target language according to the LangCode.
 */
export function getAutoSelectedTargetLanguageItem(fromLangCode: string): LanguageItem {
  const targetLanguageItem = config.preferredLanguages.find(
    (languageItem) => languageItem.youdaoLangCode !== fromLangCode,
  ) as LanguageItem;
  logTrace("QueryUtils", `fromLangCode: ${fromLangCode}, auto selected target: ${targetLanguageItem.youdaoLangCode}`);
  return targetLanguageItem;
}
