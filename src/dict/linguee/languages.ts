/*
 * @author: tisfeng
 * @createTime: 2022-07-25 23:04
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-12 17:42
 * @fileName: languages.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { getLanguageItemFromYoudaoId } from "../../language/languages";

/**
 * This is the list of general languages supported by Linguee dictionary, they can query each other at will.
 *
 * eg. english <-> german <-> french
 */
const lingueeGeneralLanguages = [
  "english",
  "german",
  "french",
  "italian",
  "spanish",
  "portuguese",
  "dutch",
  "polish",
  "dannish",
  "finnish",
  "swedish",
  "greek",
  "czech",
  "hungarian",
  "romanian",
  "slovak",
];

/**
 * These languages can only query each other between them.
 *
 * eg. english <-> chinese, english <-> japanese
 */
const validLanguagePairKeys = ["english-chinese", "english-japanese", "english-russian"];

/**
 * Get valid language pair keys.
 */
export function getValidLingueeLanguagePair(fromLanguage: string, toLanguage: string): string | undefined {
  let fromLanguageTitle = getLanguageItemFromYoudaoId(fromLanguage).languageTitle;
  let targetLanguageTitle = getLanguageItemFromYoudaoId(toLanguage).languageTitle;
  const ChineseLanguageTitle = "Chinese";
  if (fromLanguageTitle.startsWith(ChineseLanguageTitle)) {
    fromLanguageTitle = ChineseLanguageTitle;
  }
  fromLanguageTitle = fromLanguageTitle.toLowerCase();
  if (targetLanguageTitle.startsWith(ChineseLanguageTitle)) {
    targetLanguageTitle = ChineseLanguageTitle;
  }
  targetLanguageTitle = targetLanguageTitle.toLowerCase();

  const englishLanguageLowercaseTitle = "english";
  let languagePairKey = `${fromLanguageTitle}-${targetLanguageTitle}`;
  if (targetLanguageTitle === englishLanguageLowercaseTitle) {
    languagePairKey = `${targetLanguageTitle}-${fromLanguageTitle}`;
  }

  const validLanguagePair = `${fromLanguageTitle}-${targetLanguageTitle}`;

  if (validLanguagePairKeys.includes(languagePairKey)) {
    return validLanguagePair;
  }

  if (lingueeGeneralLanguages.includes(fromLanguageTitle) && lingueeGeneralLanguages.includes(targetLanguageTitle)) {
    return validLanguagePair;
  }
}
