import { getPreferenceValues } from "@raycast/api";
import { languageItemList } from "./consts";
import { LanguageItem, MyPreferences } from "./types";
import { defaultLanguage1, defaultLanguage2 } from "./utils";

// function: get the language type represented by the string, priority to use English and Chinese, and then auto
export function detectInputTextLanguageId(inputText: string): string {
  let fromYoudaoLanguageId = "auto";
  const englishLanguageId = "en";
  const chineseLanguageId = "zh-CHS";
  if (isEnglishOrNumber(inputText) && isPreferredLanguagesContainedEnglish()) {
    fromYoudaoLanguageId = englishLanguageId;
  } else if (isContainChinese(inputText) && isPreferredLanguagesContainedChinese()) {
    fromYoudaoLanguageId = chineseLanguageId;
  }
  console.warn("detect fromLanguage-->:", fromYoudaoLanguageId);
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

export function getLanguageItemFromYoudaoId(youdaoLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.youdaoLanguageId === youdaoLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

export function getLanguageItemFromTencentDetectId(tencentLanguageId: string): LanguageItem {
  for (const langItem of languageItemList) {
    const tencentDetectLanguageId = langItem.tencentDetectLanguageId || langItem.tencentLanguageId;
    if (tencentDetectLanguageId === tencentLanguageId) {
      return langItem;
    }
  }
  return languageItemList[0];
}

export function getLanguageItemFromAppleChineseTitle(chineseTitle: string): LanguageItem {
  for (const langItem of languageItemList) {
    if (langItem.appleChineseLanguageTitle === chineseTitle) {
      return langItem;
    }
  }
  return languageItemList[0];
}

// function: get another language item expcept chinese
export function getLanguageItemExpceptChinese(from: LanguageItem, to: LanguageItem): LanguageItem {
  if (from.youdaoLanguageId === "zh-CHS") {
    return to;
  } else {
    return from;
  }
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
