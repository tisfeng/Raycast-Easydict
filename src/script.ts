import { LocalStorage, showToast, Toast } from "@raycast/api";
import querystring from "node:querystring";
import { exec, execFile } from "child_process";
import { QueryTextInfo } from "./types";
import { getLanguageItemFromYoudaoId, LanguageDetectType, LanguageDetectTypeResult } from "./detectLanguage";
import { eudicBundleId } from "./components";

// function: run DetectLanguage shortcuts with the given text, return promise
export function appleLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  const startTime = new Date().getTime();
  const appleScript = getShortcutsScript("Easydict-LanguageDetect-V1.2.0", text);
  return new Promise((resolve, reject) => {
    exec(`osascript -e '${appleScript}'`, (error, stdout) => {
      if (error) {
        reject(error);
      }
      resolve({
        type: LanguageDetectType.Apple,
        languageId: stdout.trim(), // NOTE: need trim()
      });
      const endTime = new Date().getTime();
      console.warn(`apple detect cost: ${endTime - startTime} ms`);
    });
  });
}

// function: run apple Translate shortcuts with the given QueryWordInfo, return promise
export function appleTranslate(queryTextInfo: QueryTextInfo): Promise<string | undefined> {
  const startTime = new Date().getTime();
  const appleFromLanguageId = getLanguageItemFromYoudaoId(queryTextInfo.fromLanguage).appleLanguageId;
  const appleToLanguageId = getLanguageItemFromYoudaoId(queryTextInfo.toLanguage).appleLanguageId;
  if (!appleFromLanguageId || !appleToLanguageId) {
    console.warn(`apple translate language not support: ${appleFromLanguageId} -> ${appleToLanguageId}`);
    return Promise.resolve(undefined);
  }

  const jsonString = querystring.stringify({
    text: queryTextInfo.queryText,
    from: appleFromLanguageId,
    to: appleToLanguageId,
  });
  const appleScript = getShortcutsScript("Easydict-Translate-V1.2.0", jsonString);
  return new Promise((resolve, reject) => {
    exec(`osascript -e '${appleScript}'`, (error, stdout) => {
      if (error) {
        reject(error);
      }
      resolve(stdout);
      const endTime = new Date().getTime();
      console.warn(`apple translate cost: ${endTime - startTime} ms`);
    });
  });
}

/**
 function: get shortcuts script template string according to shortcut name and input

 NOTE: To run a shortcut in the background, without opening the Shortcuts app, tell 'Shortcuts Events' instead of 'Shortcuts'.
 */
function getShortcutsScript(shortcutName: string, input: string): string {
  // replace " with \" in input, otherwise run the script will error
  const escapedInput = input.replace(/"/g, '\\"');
  const applescriptContent = `
        tell application "Shortcuts Events"
          run the shortcut named "${shortcutName}" with input "${escapedInput}"
        end tell
      `;
  return applescriptContent;
}

// open Eudic App with queryText
export const openInEudic = (queryText: string) => {
  const url = `eudic://dict/${queryText}`;
  execFile("open", [url], (error, stdout) => {
    if (error) {
      console.log("error:", error);
      LocalStorage.removeItem(eudicBundleId);

      showToast({
        title: "Eudic is not installed.",
        style: Toast.Style.Failure,
      });
    }
    console.log(`openInEudic: ${stdout}`);
  });
};
