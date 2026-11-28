/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Cache } from "@raycast/api";

import type { LanguageCode } from "@/core/language/types";
import { isLanguageCode } from "@/core/language/utils";
import { isRecord } from "@/shared/validation";

const cache = new Cache({ namespace: "search-word" });
const key = "last-query-state";

interface LastQuery {
  text: string;
  manualTargetLanguage?: LanguageCode;
}

export function getLastQuery(): LastQuery | undefined {
  const stored = cache.get(key);
  if (stored === undefined) return undefined;

  try {
    const entry: unknown = JSON.parse(stored);
    if (!isRecord(entry) || typeof entry.text !== "string" || !entry.text) return undefined;
    const { text, manualTargetLanguage } = entry;
    return isLanguageCode(manualTargetLanguage) ? { text, manualTargetLanguage } : { text };
  } catch {
    return undefined;
  }
}

export function setLastQuery(text: string, manualTargetLanguage?: LanguageCode) {
  if (text) {
    cache.set(key, JSON.stringify({ text, manualTargetLanguage }));
  } else {
    cache.remove(key);
  }
}
