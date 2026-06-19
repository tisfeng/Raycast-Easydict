/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import querystring from "node:querystring";

import { runAppleScript } from "@raycast/utils";

import { getLangCode } from "@/core/language/utils";
import { TranslationType } from "@/types/api";
import { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { logTrace, logWarn } from "@/utils/logger";

export interface AppleTranslateResult {
  translatedText: string;
}

const execCommandTimeout = 10000; // 10s

/**
 * Get shortcuts script template string.
 */
function getShortcutsScript(shortcutName: string, input: string): string {
  const escapedInput = input.replace(/'/g, '"').replace(/"/g, '\\"');
  return `
    tell application "Shortcuts Events"
      run the shortcut named "${shortcutName}" with input "${escapedInput}"
    end tell
  `;
}

/**
 * Request Apple Translate via macOS Shortcuts.
 * Returns the translated text, or undefined if the language is not supported.
 */
export async function requestAppleTranslate(
  queryWordInfo: QueryWordInfo,
  signal?: AbortSignal,
): Promise<QueryTypeResult> {
  logTrace("apple", "start Apple translate");
  const startTime = Date.now();
  const { word, fromLanguage, toLanguage } = queryWordInfo;
  const type = TranslationType.Apple;

  if (process.platform !== "darwin") {
    logWarn("apple", "Apple Translate is only supported on macOS.");
    return { type, queryWordInfo, translations: [], result: undefined };
  }

  const appleFromLanguageId = getLangCode(fromLanguage, "appleLangCode");
  const appleToLanguageId = getLangCode(toLanguage, "appleLangCode");

  if (!appleFromLanguageId || !appleToLanguageId) {
    logWarn("apple", `language not support: ${fromLanguage} -> ${toLanguage}`);
    return { type, queryWordInfo, translations: [], result: undefined };
  }

  if (appleFromLanguageId === "auto") {
    logWarn("apple", `auto detect not supported for this language: ${word}`);
    return { type, queryWordInfo, translations: [], result: undefined };
  }

  const map = new Map([
    ["text", word],
    ["from", appleFromLanguageId],
    ["to", appleToLanguageId],
  ]);

  const queryString = querystring.stringify(Object.fromEntries(map.entries()));
  const appleScript = getShortcutsScript("Easydict-Translate-V1.2.0", queryString);

  logTrace("apple", "before exec appleScript");

  const translatedText = await runAppleScript(appleScript, { timeout: execCommandTimeout, signal });
  const trimmed = translatedText.trim();
  logTrace("apple", `Apple translate cost: ${Date.now() - startTime}ms`);

  const translations = trimmed.split("\n").filter((line) => line.length > 0);

  return {
    type,
    queryWordInfo,
    translations,
    result: { translatedText: trimmed },
  };
}
