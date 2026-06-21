/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { myPreferences } from "@/consts";
import { TranslationType } from "@/types/api";
import type { QueryType } from "@/types/query";

export interface HideRule {
  /** Query types that trigger this rule. */
  triggers: QueryType[];
  /** Returns true if the result should be hidden from display. */
  shouldHide: (type: QueryType) => boolean;
}

export const HIDE_RULES: HideRule[] = [
  {
    triggers: [TranslationType.DeepL],
    shouldHide: () => !myPreferences.enableDeepLTranslate,
  },
  {
    triggers: [TranslationType.Youdao],
    shouldHide: () => myPreferences.enableYoudaoDictionary && !myPreferences.enableYoudaoTranslate,
  },
];

/** Apply hide rules to a query result, returning the updated hideDisplay flag. */
export function computeHideDisplay(type: QueryType): boolean {
  for (const rule of HIDE_RULES) {
    if (rule.triggers.includes(type) && rule.shouldHide(type)) {
      return true;
    }
  }
  return false;
}
