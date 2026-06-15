/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { closeMainWindow, open, showHUD } from "@raycast/api";
import { recognizeText } from "@/recognizeText";
import { logTrace, logError } from "@/devLog";

export default async function command() {
  if (process.platform !== "darwin") {
    return await showHUD("❌ OCR feature is currently only supported on macOS.");
  }

  await closeMainWindow();

  try {
    const recognizedText = await recognizeText();
    if (!recognizedText) {
      return await showHUD("❌ No text detected!");
    }
    logTrace("ocr", `recognized text: ${recognizedText}`);

    const encodedQueryText = encodeURIComponent(recognizedText);
    const easyDictUrl = `raycast://extensions/isfeng/easydict/easydict?fallbackText=${encodedQueryText}`;
    try {
      await open(easyDictUrl);
    } catch (error) {
      logError("ocr", `open easyDictUrl error: ${error}`);
      await showHUD("⚠️ Failed to query Easy Dictionary");
    }
  } catch (e) {
    logError("ocr", `recognize text error: ${e}`);
    await showHUD("❌ Failed detecting text");
  }
}
