/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { closeMainWindow, environment, launchCommand, LaunchType, showHUD } from "@raycast/api";
import { chmod } from "fs/promises";
import { join } from "path";
import { x } from "tinyexec";

import { recognizeTextWindows } from "@/core/ocr/windows";
import { CancelledError } from "@/shared/errors";
import { logError, logTrace } from "@/shared/logger";

const recognizeTextMac = async () => {
  const command = join(environment.assetsPath, "recognizeText");
  await chmod(command, "755");
  const result = await x(command, [], {
    throwOnError: true,
  });
  return result.stdout.trim();
};

export default async function command() {
  const platform = process.platform;
  if (platform !== "darwin" && platform !== "win32") {
    return await showHUD("❌ OCR feature is currently only supported on macOS and Windows.");
  }

  await closeMainWindow();

  try {
    const recognizedText = platform === "win32" ? await recognizeTextWindows() : await recognizeTextMac();
    if (!recognizedText) {
      return await showHUD("❌ No text detected!");
    }
    logTrace("OCR", `recognized text: ${recognizedText}`);

    try {
      await launchCommand({
        name: "easydict",
        type: LaunchType.UserInitiated,
        arguments: {
          queryText: recognizedText,
        },
      });
    } catch (error) {
      logError("OCR", `launch easydict error: ${error}`);
      await showHUD("⚠️ Failed to query Easy Dictionary");
    }
  } catch (e) {
    if (e instanceof CancelledError) {
      logTrace("OCR", "recognition cancelled");
      return;
    }
    logError("OCR", `recognize text error: ${e}`);
    const message = platform === "win32" && e instanceof Error && e.message ? e.message : "Failed detecting text";
    await showHUD(`❌ ${message}`);
  }
}
