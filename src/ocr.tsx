/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { closeMainWindow, getPreferenceValues, launchCommand, LaunchType, showHUD } from "@raycast/api";

import { ocrSourceLanguage, recognizeMac } from "@/core/ocr/mac";
import { recognizeWindows } from "@/core/ocr/windows";
import { logError, logSummary, logTrace } from "@/shared/logger";

/** Returns the recognized text, an empty string when nothing was found, or null when the user cancelled. */
const recognizeTextWindows = async (): Promise<string | null> => {
  const outcome = await recognizeWindows("area");
  if (outcome.status === "cancelled") {
    logTrace("OCR", "recognition cancelled");
    return null;
  }
  if (outcome.status === "error") {
    throw new Error(outcome.message);
  }
  return outcome.status === "recognized" ? outcome.text : "";
};

export default async function command() {
  const platform = process.platform;
  if (platform !== "darwin" && platform !== "win32") {
    return await showHUD("❌ OCR feature is currently only supported on macOS and Windows.");
  }

  await closeMainWindow();

  try {
    let sourceLanguage: string | undefined;
    let recognizedText: string | null;
    if (platform === "darwin") {
      const preferences = getPreferenceValues<Preferences>();
      const result = await recognizeMac(preferences.ocrRecognitionMode);
      sourceLanguage = ocrSourceLanguage(result, preferences.ocrRecognitionMode);
      recognizedText = result.status === "recognized" ? result.text : result.status === "cancelled" ? null : "";
      logSummary(
        "OCR",
        `capture ${result.captureMs.toFixed(0)}ms (includes area selection), recognition ${result.recognitionMs.toFixed(0)}ms; source ${sourceLanguage ?? "needs detection"}`,
      );
    } else {
      recognizedText = await recognizeTextWindows();
    }
    if (recognizedText === null) {
      return;
    }
    if (!recognizedText) {
      return await showHUD("❌ No text detected!");
    }

    try {
      await launchCommand({
        name: "easydict",
        type: LaunchType.UserInitiated,
        arguments: {
          queryText: recognizedText,
        },
        ...(sourceLanguage ? { context: { ocrSourceLanguage: sourceLanguage } } : {}),
      });
    } catch (error) {
      logError("OCR", `launch easydict error: ${error}`);
      await showHUD("⚠️ Failed to query Easy Dictionary");
    }
  } catch (e) {
    logError("OCR", `recognize text error: ${e}`);
    const message = e instanceof Error && e.message ? e.message : "Failed detecting text";
    await showHUD(`❌ ${message}`);
  }
}
