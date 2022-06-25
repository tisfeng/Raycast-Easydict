import { getPreferenceValues } from "@raycast/api";
import { tencentLanguageDetect } from "./request";
import { appleLanguageDetect } from "./script";
import { LanguageItem, MyPreferences } from "./types";
import {
  defaultLanguage1,
  defaultLanguage2,
  getLanguageItemFromAppleChineseTitle,
  getLanguageItemFromTencentId,
  myPreferences,
} from "./utils";

// enum language detect type
export enum LanguageDetectType {
  Local = "Local",
  Apple = "Apple",
  Tencent = "Tencent",
}

export interface LanguageDetectTypeResult {
  type: LanguageDetectType;
  languageId: string | undefined;
}

/**
 For a better user experience, a maximum of 1 second is set to request the Tencent language identification interface, and the local language check is used for timeout.
If the result of the local language test is not a preferred language, use the interface query instead.
If Apple language detection is enabled, both Apple language test and Tencent language test will be initiated, and which first-out result will be used.
If the language of the asynchronous check is the preferred language, use it directly. If not, continue to invoke local language detection.
 */
const delayDetectLanguageInterval = 2000;
let isDetectedLanguage = false;
let delayDetectLanguageTimer: NodeJS.Timeout;

/**
 * function: detect language with the given text, callback with language detect type and language id
 */
export function detectLanguage(text: string, callback: (result: LanguageDetectTypeResult) => void): void {
  // covert the input text to lowercase, because tencentLanguageDetect API is case sensitive, such as 'Section' is detected as 'fr' 😑
  const lowerCaseText = text.toLowerCase();
  console.log("queryText:", text);
  console.log("lowerCaseText:", lowerCaseText);

  clearTimeout(delayDetectLanguageTimer);

  const localDetectLanguageId = localDetectTextLanguageId(lowerCaseText);
  delayDetectLanguageTimer = setTimeout(() => {
    if (isPreferredLanguage(localDetectLanguageId)) {
      isDetectedLanguage = true;
      console.log(`use detect language --->: ${localDetectLanguageId}`);
      callback({ type: LanguageDetectType.Local, languageId: localDetectLanguageId });
    }
  }, delayDetectLanguageInterval);

  // new a action map, key is LanguageDetectType, value is Promise<LanguageDetectTypeResult>
  const actionMap = new Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>();
  actionMap.set(LanguageDetectType.Tencent, tencentLanguageDetect(lowerCaseText));
  if (myPreferences.enableAppleLanguageDetect) {
    actionMap.set(LanguageDetectType.Apple, appleLanguageDetect(lowerCaseText));
  }

  raceDetectTextLanguage(lowerCaseText, actionMap, (detectLanguageId) => {
    console.warn(`raceDetectTextLanguage: ${detectLanguageId}`);
    const fromLanguageItem = getPreferredLanguageAccordingToLocalTextDetect(lowerCaseText, detectLanguageId);
    callback({ type: LanguageDetectType.Local, languageId: fromLanguageItem });
  });
}

/**
    get language according to the input text and detect language, 
    if the detect language is the preferred language, or local detect language is "auto", use it directly.
    else use local language detect.
   */
function getPreferredLanguageAccordingToLocalTextDetect(text: string, detectLanguageId: string) {
  if (isPreferredLanguage(detectLanguageId)) {
    return detectLanguageId;
  }
  const localDetectLanguageId = localDetectTextLanguageId(text);
  if (localDetectLanguageId === "auto") {
    return detectLanguageId;
  }
  return localDetectLanguageId;
}

/**
 * promise race to detect language
 * @param text
 * @param detectLanguageActionMap
 * @param callback fromLanguageId => {}
 */
function raceDetectTextLanguage(
  text: string,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>,
  callback: (fromLanguageId: string) => void
) {
  console.log(`start raceDetectTextLanguage: ${[...detectLanguageActionMap.keys()]}`);
  isDetectedLanguage = false;
  const detectLanguageActionList = detectLanguageActionMap.values();
  Promise.race(detectLanguageActionList)
    .then((typeResult) => {
      if (isDetectedLanguage) {
        console.warn(`promise race detect over time: ${JSON.stringify(typeResult, null, 4)}`);
        return;
      }

      isDetectedLanguage = true;
      clearTimeout(delayDetectLanguageTimer);

      if (typeResult.type === LanguageDetectType.Apple) {
        const appleLanguageId = typeResult.languageId as string;
        const languageItem = getLanguageItemFromAppleChineseTitle(appleLanguageId);
        console.warn(`apple detect language: ${appleLanguageId}, youdao: ${languageItem?.youdaoLanguageId}`);

        const checkIsPreferredLanguage = checkDetectedLanguageIsPreferred(
          LanguageDetectType.Apple,
          languageItem,
          detectLanguageActionMap
        );
        if (checkIsPreferredLanguage || detectLanguageActionMap.size === 0) {
          callback((languageItem as LanguageItem).youdaoLanguageId);
        } else {
          raceDetectTextLanguage(text, detectLanguageActionMap, callback);
        }
      }

      if (typeResult.type === LanguageDetectType.Tencent) {
        const tencentLanguageId = typeResult.languageId || "";
        const languageItem = getLanguageItemFromTencentId(tencentLanguageId);
        console.warn(`tencent detect language: ${tencentLanguageId}, youdao: ${languageItem?.youdaoLanguageId}`);

        const checkIsPreferredLanguage = checkDetectedLanguageIsPreferred(
          LanguageDetectType.Tencent,
          languageItem,
          detectLanguageActionMap
        );
        if (checkIsPreferredLanguage || detectLanguageActionMap.size === 0) {
          callback((languageItem as LanguageItem).youdaoLanguageId);
        } else {
          raceDetectTextLanguage(text, detectLanguageActionMap, callback);
        }
      }
    })
    .catch((error) => {
      console.error(`detect language error: ${error}`);
      callback(localDetectTextLanguageId(text));
    });
}

// function check if the language is preferred language, if not, remove it from the action map
function checkDetectedLanguageIsPreferred(
  detectType: LanguageDetectType,
  languageItem: LanguageItem | undefined,
  detectLanguageActionMap: Map<LanguageDetectType, Promise<LanguageDetectTypeResult>>
) {
  if (!languageItem || !isPreferredLanguage(languageItem.youdaoLanguageId)) {
    for (const [type] of detectLanguageActionMap) {
      if (type === detectType) {
        detectLanguageActionMap.delete(type);
      }
    }
    console.warn(`${detectType} check not preferred language: ${languageItem?.youdaoLanguageId}`);
    return false;
  }
  return true;
}

/**
  get local detect language id according to inputText, priority to use English and Chinese, and then auto
 */
export function localDetectTextLanguageId(inputText: string): string {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(inputText) && isPreferredLanguagesContainedEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isContainChinese(inputText) && isPreferredLanguagesContainedChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.log("detect fromLanguage -->:", fromYoudaoLanguageId);
  return fromYoudaoLanguageId;
}

// function: check if the language is preferred language
export function isPreferredLanguage(languageId: string): boolean {
  return languageId === defaultLanguage1.youdaoLanguageId || languageId === defaultLanguage2.youdaoLanguageId;
}

// function: check if preferred languages contains English language
export function isPreferredLanguagesContainedEnglish(): boolean {
  return defaultLanguage1.youdaoLanguageId === "en" || defaultLanguage2.youdaoLanguageId === "en";
}

// function: check if preferred languages contains Chinese language
export function isPreferredLanguagesContainedChinese(): boolean {
  const lanuguageIdPrefix = "zh";
  const preferences: MyPreferences = getPreferenceValues();
  if (preferences.language1.startsWith(lanuguageIdPrefix) || preferences.language2.startsWith(lanuguageIdPrefix)) {
    return true;
  }
  return false;
}

// function: remove all punctuation from the text
export function removeEnglishPunctuation(text: string) {
  return text.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~·]/g, "");
}

// function: remove all Chinese punctuation and blank space from the text
export function removeChinesePunctuation(text: string) {
  return text.replace(
    /[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g,
    ""
  );
}

// function: remove all punctuation from the text
export function removePunctuation(text: string) {
  return removeEnglishPunctuation(removeChinesePunctuation(text));
}

// function: remove all blank space from the text
export function removeBlankSpace(text: string) {
  return text.replace(/\s/g, "");
}

// function: check if the text contains Chinese characters
export function isContainChinese(text: string) {
  return /[\u4e00-\u9fa5]/g.test(text);
}

// function: check if text isEnglish or isNumber
export function isEnglishOrNumber(text: string) {
  const pureText = removePunctuation(removeBlankSpace(text));
  console.log("pureText: " + pureText);
  return /^[a-zA-Z0-9]+$/.test(pureText);
}
