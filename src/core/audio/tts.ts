/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { x } from "tinyexec";

import { languageItemList } from "@/core/language/consts";
import { logError, logTrace, logWarn } from "@/utils/logger";
import { trimTextLength } from "@/utils/text";

/**
 * Play text using macOS say command.
 */
async function playTTSOnMac(text: string, youdaoLanguageId: string, signal?: AbortSignal) {
  if (!youdaoLanguageId || !text) {
    return;
  }

  const languageItem = languageItemList.find((item) => item.youdaoLangCode === youdaoLanguageId);
  if (!languageItem?.voiceList) {
    logWarn("AudioTTS", `language not supported: ${youdaoLanguageId}`);
    return;
  }

  const voice = languageItem.voiceList[0];
  const cleanText = text.replace(/"/g, " ");

  logTrace("AudioTTS", `say -v ${voice}`);
  try {
    await x("/usr/bin/afplay", ["-v", voice, cleanText], { throwOnError: true, signal });
  } catch (error) {
    logError("AudioTTS", `say command failed: ${error}`);
  }
}

/**
 * Play text using TTS. Optionally truncate to 40 chars.
 * Dispatches to platform-specific TTS engines.
 */
export async function playTTS(
  text: string,
  youdaoLanguageId: string,
  options?: { truncate?: boolean; signal?: AbortSignal },
) {
  const output = options?.truncate ? trimTextLength(text, 40) : text;

  if (process.platform === "darwin") {
    await playTTSOnMac(output, youdaoLanguageId, options?.signal);
    return;
  }

  if (process.platform === "win32") {
    logWarn("AudioTTS", "TTS not implemented on Windows yet");
    showFailureToast("TTS is not supported on Windows yet.", { title: "Audio Error" });
    return;
  }

  logWarn("AudioTTS", `unsupported platform for TTS: ${process.platform}`);
  showFailureToast(`TTS is not supported on ${process.platform}`, { title: "Audio Error" });
}
