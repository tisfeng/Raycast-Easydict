/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-27 14:11
 * @fileName: scripts.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage, showToast, Toast } from "@raycast/api";
import querystring from "node:querystring";
import { exec, execFile } from "child_process";
import { QueryTextInfo } from "./types";
import { LanguageDetectType, LanguageDetectTypeResult } from "./detectLanguage";
import { eudicBundleId } from "./components";
import { getLanguageItemFromYoudaoId } from "./utils";

/**
 * run DetectLanguage shortcuts with the given text, return promise
 */
export function appleLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  const startTime = new Date().getTime();
  const appleScript = getShortcutsScript("Easydict-LanguageDetect-V1.2.0", text);
  return new Promise((resolve, reject) => {
    // * NOTE: osascript -e param only support single quote 'xxx'
    exec(`osascript -e '${appleScript}'`, (error, stdout) => {
      if (error) {
        reject(error);
      }
      const detectTypeResult: LanguageDetectTypeResult = {
        type: LanguageDetectType.Apple,
        youdaoLanguageId: stdout.trim(), // NOTE: need trim()
      };
      resolve(detectTypeResult);
      const endTime = new Date().getTime();
      console.warn(`apple detect: ${detectTypeResult.youdaoLanguageId}, cost: ${endTime - startTime} ms`);
    });
  });
}

/**
 * run apple Translate shortcuts with the given QueryWordInfo, return promise
 */
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
      console.warn(`apple translate: ${stdout}, cost: ${endTime - startTime} ms`);
    });
  });
}

/**
 * get shortcuts script template string according to shortcut name and input
 *
 * * NOTE: To run a shortcut in the background, without opening the Shortcuts app, tell 'Shortcuts Events' instead of 'Shortcuts'.
 */
function getShortcutsScript(shortcutName: string, input: string): string {
  /**
   * * NOTE: First, exec osascript -e 'xxx', internal param only allow double quote, so single quote have to be instead of double quote.
   * * Then, the double quote in the input must be escaped.
   */
  const escapedInput = input.replace(/'/g, '"').replace(/"/g, '\\"'); // test: you're so beautiful, my "unfair" girl
  const appleScriptContent = `
        tell application "Shortcuts Events"
          run the shortcut named "${shortcutName}" with input "${escapedInput}"
        end tell
      `;
  return appleScriptContent;
}

/**
 * open Eudic App with queryText
 */
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
