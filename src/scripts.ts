/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { runAppleScript, showFailureToast } from "@raycast/utils";
import { open } from "@raycast/api";

import querystring from "node:querystring";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getAppleLangCode } from "@/language/languages";
import { RequestErrorInfo, TranslationType } from "@/types";

const execCommandTimeout = 10000; // 10s

/**
 * Run apple Translate shortcuts with the given QueryWordInfo. Cost time: ~0.5s.
 *
 * * Since this is an experimental feature, may be sucked in long time, so we set a max time to cancel it.
 */
export function appleTranslate(
  queryTextInfo: QueryWordInfo,
  abortController?: AbortController,
  timeout = execCommandTimeout,
): Promise<string | undefined> {
  console.log(`---> start Apple translate`);

  const { word, fromLanguage, toLanguage } = queryTextInfo;
  const startTime = new Date().getTime();
  const appleFromLanguageId = getAppleLangCode(fromLanguage);
  const appleToLanguageId = getAppleLangCode(toLanguage);
  const type = TranslationType.Apple;

  if (!appleFromLanguageId || !appleToLanguageId) {
    console.warn(`apple translate language not support: ${fromLanguage} -> ${toLanguage}`);
    return Promise.resolve(undefined);
  }

  if (process.platform !== "darwin") {
    console.warn("Apple Translate is only supported on macOS.");
    return Promise.resolve(undefined);
  }

  const map = new Map([
    ["text", word],
    ["from", appleFromLanguageId], // * NOTE: if no from language, it will auto detect
    ["to", appleToLanguageId],
  ]);

  /**
   * * NOTE: thought apple translate support auto detect language, but it seems only support 12 languages currently that listed in consts.ts.
   * * If use auto detect and detected language is outside of 12 languages, it will throw language not support error.
   *
   * ? execution error: “Shortcuts Events”遇到一个错误：“翻译”可能不支持所提供文本的语言。 (-1753)
   * ? execution error: “Shortcuts Events”遇到一个错误：Translation from 英语（美国） to 中文（台湾） is not supported. (-1753)\n"
   */
  if (appleFromLanguageId === "auto") {
    map.delete("from"); // means use apple language auto detect
    console.warn(`Apple translate currently not support auto detect this language: ${word}`);
    return Promise.resolve(undefined);
  }

  const object = Object.fromEntries(map.entries());
  /**
   *  const jsonString = JSON.stringify(object); // {"text":"jsonString","from":"en_US","to":"zh_CN"}
   *  It seems that this method cannot handle special characters.: you're so beautiful, my "unfair" girl
   */
  const queryString = querystring.stringify(object);
  // console.log(`queryString: ${queryString}`); // text=girl&from=en_US&to=zh_CN

  const appleScript = getShortcutsScript("Easydict-Translate-V1.2.0", queryString);

  console.log(`before execa appleScript`);

  return runAppleScript(appleScript, { timeout, signal: abortController?.signal })
    .then((result) => {
      const translateText = result.trim();
      console.warn(`Apple translate: ${translateText}, cost: ${new Date().getTime() - startTime} ms`);
      return translateText;
    })
    .catch((error) => {
      if (error.name === "AbortError" || error.killed || error.message?.includes("timed out")) {
        console.warn(`---> apple translate canceled or timeout`);
        return Promise.reject(undefined);
      } else {
        console.error(`apple translate error: ${JSON.stringify(error, null, 4)}`);
        console.warn(`Apple translate error: ${appleScript}`);
        const errorInfo: RequestErrorInfo = {
          type: type,
          message: error.message,
        };
        return Promise.reject(errorInfo);
      }
    })
    .finally(() => {
      console.log(`---> end Apple translate, cost: ${new Date().getTime() - startTime} ms`);
    });
}

/**
 * Get shortcuts script template string according to shortcut name and input.
 *
 * * NOTE: To run a shortcut in the background, without opening the Shortcuts app, tell 'Shortcuts Events' instead of 'Shortcuts'.
 */
function getShortcutsScript(shortcutName: string, input: string): string {
  /**
   * * NOTE: First, exec osascript -e 'xxx', internal param only allow double quote, so single quote have to be instead of double quote.
   * * Then, the double quote in the input must be escaped.
   */
  const escapedInput = input.replace(/'/g, '"').replace(/"/g, '\\"'); // test: oh girl you're so beautiful, my "unfair" girl
  const appleScriptContent = `
        tell application "Shortcuts Events"
          run the shortcut named "${shortcutName}" with input "${escapedInput}"
        end tell
      `;
  // console.log(`apple script: ${appleScriptContent}`);
  return appleScriptContent;
}

/**
 * Open Eudic App with queryText.
 *
 * eudic://dict/good
 */
export const openInEudic = (queryText: string) => {
  const url = `eudic://dict/${queryText}`;
  open(url).catch((error) => {
    logError("scripts", `open in eudic error: ${error}`);
    showFailureToast(String(error), {
      title: "Eudic is not installed.",
    });
  });
};
