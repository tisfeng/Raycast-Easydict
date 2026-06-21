/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import type { Voice } from "native-say";
import { getVoices, killRunningSay, say } from "native-say";

import { languageItemList } from "@/core/language/consts";
import type { LanguageItem } from "@/core/language/types";
import { logError, logTrace, logWarn } from "@/utils/logger";
import { trimTextLength } from "@/utils/text";

let cachedVoices: Voice[] | null = null;

/**
 * Dynamically finds the best matching voice for a given language item.
 * Prioritizes preferred voices configured in voiceList, gracefully falling back
 * to strict culture matches, and finally fuzzy language prefix matches.
 */
async function getBestMatchVoice(languageItem: LanguageItem): Promise<string | undefined> {
  if (!cachedVoices) {
    try {
      cachedVoices = await getVoices();
    } catch (e) {
      logError("AudioTTS", `failed to get voices: ${e}`);
      cachedVoices = [];
    }
  }

  const isWindows = process.platform === "win32";

  // 1. Try to use a preferred voice if it's installed on the system
  const preferredVoices = isWindows ? languageItem.voiceList?.Windows : languageItem.voiceList?.macOS;
  const matchedPreferred = preferredVoices
    ?.map((pref) => cachedVoices!.find((v) => v.name.toLowerCase() === pref.toLowerCase()))
    .find(Boolean);

  if (matchedPreferred) {
    return matchedPreferred.name;
  }

  // 2. If no preferred voice is found (or none installed), dynamically find by language code
  const langCode = languageItem.appleLangCode?.replace("_", "-") || languageItem.googleLangCode;
  if (!langCode) return undefined;

  const targetCulture = langCode.toLowerCase();

  // Helper to extract a normalized language code from a voice object
  const getVoiceLang = (v: Voice) =>
    "culture" in v ? v.culture.toLowerCase() : v.languageCode.toLowerCase().replace("_", "-");

  // 3. Exact culture match (e.g. "zh-cn" === "zh-cn")
  const exactVoice = cachedVoices.find((v) => getVoiceLang(v) === targetCulture);
  if (exactVoice) return exactVoice.name;

  // 4. Fuzzy language prefix match (e.g. "zh-cn" -> "zh")
  const langPrefix = targetCulture.split("-")[0];
  const fuzzyVoice = cachedVoices.find((v) => getVoiceLang(v).startsWith(langPrefix));

  return fuzzyVoice?.name;
}

/**
 * Play text using native-say. Optionally truncate to 40 chars.
 * Dispatches to platform-specific TTS engines.
 */
export async function playTTS(
  text: string,
  youdaoLanguageId: string,
  options?: { truncate?: boolean; signal?: AbortSignal },
) {
  const output = options?.truncate ? trimTextLength(text, 40) : text;

  if (process.platform !== "darwin" && process.platform !== "win32") {
    logWarn("AudioTTS", `unsupported platform for TTS: ${process.platform}`);
    showFailureToast(`TTS is not supported on ${process.platform}`, { title: "Audio Error" });
    return;
  }

  if (!youdaoLanguageId || !output) {
    return;
  }

  const languageItem = languageItemList.find((item) => item.youdaoLangCode === youdaoLanguageId);
  if (!languageItem) {
    logWarn("AudioTTS", `language not supported: ${youdaoLanguageId}`);
    return;
  }

  const cleanText = output.replace(/"/g, " ");

  // Handle AbortSignal to kill running process
  const onAbort = async () => {
    try {
      await killRunningSay();
    } catch (e) {
      logError("AudioTTS", `failed to kill say: ${e}`);
    }
  };

  options?.signal?.addEventListener("abort", onAbort);

  try {
    const voiceName = await getBestMatchVoice(languageItem);
    logTrace("AudioTTS", `say (${process.platform})${voiceName ? ` -v ${voiceName}` : ""}`);
    await say(cleanText, voiceName ? { voice: voiceName } : undefined);
  } catch (error) {
    logError("AudioTTS", `say command failed: ${error}`);
  } finally {
    options?.signal?.removeEventListener("abort", onAbort);
  }
}
