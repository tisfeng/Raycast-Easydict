import { Clipboard, closeMainWindow, showHUD, open } from "@raycast/api";
import { recognizeText } from "./recognizeText";

// export default async function command() {
//   await closeMainWindow();

//   try {
//     const recognizedText = await recognizeText();

//     if (!recognizedText) {
//       return await showHUD("❌ No text detected!");
//     }
//     await Clipboard.copy(recognizedText);
//     await showHUD("✅ Copied text to clipboard");
//   } catch (e) {
//     console.error(e);
//     await showHUD("❌ Failed detecting text");
//   }
// }

export default async function command() {
  await closeMainWindow();

  try {
    const recognizedText = await recognizeText();

    if (!recognizedText) {
      return await showHUD("❌ No text detected!");
    }
    console.log(recognizedText);

    const encodedQueryText = encodeURIComponent(recognizedText);
    const easyDictUrl = `raycast://extensions/isfeng/easydict/easydict?fallbackText=${encodedQueryText}`;
    try {
      await open(easyDictUrl);
    } catch (error) {
      console.error(error);
      await showHUD("⚠️ Failed to query Easy Dictionary");
    }
  } catch (e) {
    console.error(e);
    await showHUD("❌ Failed detecting text");
  }
}
