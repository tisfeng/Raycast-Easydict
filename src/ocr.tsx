import { Clipboard, closeMainWindow, showHUD } from "@raycast/api";
import { recognizeText } from "./recognizeText";

export default async function command() {
  await closeMainWindow();

  try {
    const recognizedText = await recognizeText();

    if (!recognizedText) {
      return await showHUD("❌ No text detected!");
    }

    await Clipboard.copy(recognizedText);
    await showHUD("✅ Copied text to clipboard");
  } catch (e) {
    console.error(e);
    await showHUD("❌ Failed detecting text");
  }
}
