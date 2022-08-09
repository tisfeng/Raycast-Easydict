/*
 * @author: tisfeng
 * @createTime: 2022-07-24 17:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-09 10:18
 * @fileName: linguee.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from "axios";
import util from "util";
import { requestCostTime } from "../../axiosConfig";
import { userAgent } from "../../consts";
import { getLanguageItemFromYoudaoId } from "../../language/languages";
import { DicionaryType, DisplaySection, ListDisplayItem, RequestErrorInfo, RequestTypeResult } from "../../types";
import { QueryWordInfo } from "../youdao/types";
import { ValidLanguagePairKey, validLanguagePairs } from "./consts";
import { parseLingueeHTML } from "./parse";
import { LingueeDictionaryResult, LingueeListItemType } from "./types";

export const lingueeRequestTimeKey = "lingueeRequestTimeKey";

/**
 * Get linguee dictionary result.
 *
 * eg. good: https://www.linguee.com/english-chinese/search?source=auto&query=good
 */
export async function rquestLingueeDictionary(
  queryWordInfo: QueryWordInfo,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Linguee`);

  const lingueeUrl = getLingueeWebDictionaryUrl(queryWordInfo);
  console.log(`---> linguee url: ${lingueeUrl}`);
  if (!lingueeUrl) {
    return Promise.resolve({
      type: DicionaryType.Linguee,
      result: null,
      translations: [],
    });
  }

  return new Promise((resolve, reject) => {
    // * avoid linguee's anti-spider, otherwise it will reponse very slowly or even error.
    const headers: AxiosRequestHeaders = {
      "User-Agent": userAgent,
      // accept: "*/*",
      // connection: "keep-alive",
      withCredentials: true,
    };
    const config: AxiosRequestConfig = {
      headers: headers,
      responseType: "arraybuffer", // handle French content-type iso-8859-15
      signal: signal,
    };

    axios
      .get(lingueeUrl, config)
      .then((response) => {
        recordLingueeRequestTime();

        console.warn(`---> linguee cost: ${response.headers[requestCostTime]} ms`);
        console.log(`--- headers: ${util.inspect(response.config.headers, { depth: null })}`);
        console.log(`--- httpsAgent: ${util.inspect(response.config.httpsAgent, { depth: null })}`);
        const contentType = response.headers["content-type"];
        const data: Buffer = response.data;
        const html = data.toString(contentType.includes("iso-8859-15") ? "latin1" : "utf-8");
        const lingueeTypeResult = parseLingueeHTML(html);
        resolve(lingueeTypeResult);
      })
      .catch((error) => {
        console.error(`---> linguee error: ${error}`);

        if (!error.response) {
          console.log(`---> linguee cancelled`);
          return;
        }

        // Request failed with status code 503, this means your ip is banned by linguee for a few hours.
        console.error(`---> request error: ${util.inspect(error.response, { depth: null })}`);

        let errorMessage = error.response?.statusText;
        const errorCode: number = error.response?.status;
        if (errorCode === 503) {
          errorMessage = "Your ip is banned by linguee for a few hours.";
          resetLingueeRequestTime();
        }
        const errorInfo: RequestErrorInfo = {
          type: DicionaryType.Linguee,
          code: errorCode.toString(),
          message: errorMessage,
        };
        reject(errorInfo);
      });
  });
}

/**
 * Get linguee web url.
 */
export function getLingueeWebDictionaryUrl(queryWordInfo: QueryWordInfo): string | undefined {
  let fromLanguageTitle = getLanguageItemFromYoudaoId(queryWordInfo.fromLanguage).languageTitle;
  let targetLanguageTitle = getLanguageItemFromYoudaoId(queryWordInfo.toLanguage).languageTitle;
  const ChineseLanguageTitle = "Chinese";
  if (fromLanguageTitle.startsWith(ChineseLanguageTitle)) {
    fromLanguageTitle = ChineseLanguageTitle;
  }
  fromLanguageTitle = fromLanguageTitle.toLowerCase();
  if (targetLanguageTitle.startsWith(ChineseLanguageTitle)) {
    targetLanguageTitle = ChineseLanguageTitle;
  }
  targetLanguageTitle = targetLanguageTitle.toLowerCase();

  const englishLanguageLowerTitle = "english";
  let languagePairKey = `${fromLanguageTitle}-${targetLanguageTitle}` as ValidLanguagePairKey;
  if (targetLanguageTitle === englishLanguageLowerTitle) {
    languagePairKey = `${targetLanguageTitle}-${fromLanguageTitle}` as ValidLanguagePairKey;
  }

  const languagePairItem = validLanguagePairs[languagePairKey];
  if (!languagePairItem) {
    console.log(`----> lingueeis not a valid language pair: ${languagePairKey}`);
    return;
  }
  const languagePair = languagePairItem.pair;
  // Todo: source should be fromLanguage, but current detected fromLanguage may be inaccurate, so have to use auto...
  const lingueeUrl = `https://www.linguee.com/${languagePair}/search?source=auto&query=${encodeURIComponent(
    queryWordInfo.word
  )}`;

  return lingueeUrl;
}

/**
 * Record linguee reqeust times.
 */
async function recordLingueeRequestTime() {
  const lingueeRequestTime = (await LocalStorage.getItem<number>(lingueeRequestTimeKey)) || 1;
  console.log(`---> linguee has requested times: ${lingueeRequestTime}`);
  LocalStorage.setItem(lingueeRequestTimeKey, lingueeRequestTime + 1);
}
/**
 * Reset linguee request times.
 */
export async function resetLingueeRequestTime() {
  LocalStorage.setItem(lingueeRequestTimeKey, 0);
}

/**
 * Formate linguee display result
 */
export function formatLingueeDisplaySections(lingueeTypeResult: RequestTypeResult): DisplaySection[] {
  const displayResults: DisplaySection[] = [];
  if (lingueeTypeResult.result) {
    const { queryWordInfo, wordItems, examples, relatedWords, wikipedias } =
      lingueeTypeResult.result as LingueeDictionaryResult;
    const lingueeType = DicionaryType.Linguee;

    // add a Linguee flag section
    if (wordItems.length) {
      const firstWordItem = wordItems[0];
      const word = queryWordInfo.word;
      const translations = firstWordItem.translationItems;
      let translation = "";
      if (translations.length) {
        translation = translations[0].translation;
      }

      const copyText = `${translation} ${word}`;
      const displayType = LingueeListItemType.Translation;
      const lingueeTitleSection: DisplaySection = {
        type: lingueeType,
        sectionTitle: lingueeType,
        items: [
          {
            key: copyText,
            title: translation,
            subtitle: word,
            copyText: copyText,
            displayType: displayType,
            queryType: lingueeType,
            queryWordInfo: queryWordInfo,
            tooltip: displayType,
          },
        ],
      };
      displayResults.push(lingueeTitleSection);

      for (const wordItem of wordItems) {
        // check if placeholder end with .
        const checkIfEndsWithDot = wordItem.placeholder.endsWith("."); // "good at"
        let wordPos = `  ${wordItem.pos}`;
        if (wordItem.pos && !checkIfEndsWithDot) {
          wordPos = `.${wordPos}`;
        }
        const placeholderText = wordItem.placeholder ? ` ${wordItem.placeholder}` : "";
        const sectionTitle = `${wordItem.word}${placeholderText}${wordPos}`;
        const displayItems = [];
        if (wordItem.translationItems) {
          for (const explanationItem of wordItem.translationItems) {
            // 1. iterate featured explanation
            if (explanationItem.featured) {
              const title = `${explanationItem.translation}`;
              const isCommon = explanationItem.frequencyTag.displayType === LingueeListItemType.Common;
              const tagText = isCommon ? "" : `  ${explanationItem.frequencyTag.tagText}`;
              const translation = explanationItem.examples.length ? explanationItem.examples[0].translation : "";
              let pos = explanationItem.pos;
              if (pos && (tagText || translation)) {
                pos = `${pos}.`;
              }
              const subtitle = `${pos}${tagText}       ${translation}`;
              const copyText = `${title} ${subtitle}`;
              const displayType = explanationItem.frequencyTag.displayType;
              // console.log(`---> linguee copyText: ${copyText}`);
              const displayItem: ListDisplayItem = {
                key: copyText,
                title: title,
                subtitle: subtitle,
                copyText: copyText,
                queryWordInfo: queryWordInfo,
                displayType: displayType,
                queryType: lingueeType,
                tooltip: displayType,
              };
              displayItems.push(displayItem);
            }
          }

          // 2. iterate unfeatured explanation, and put them to array
          const unfeaturedExplanations = [];
          if (wordItem.translationItems) {
            for (const explanationItem of wordItem.translationItems) {
              if (!explanationItem.featured) {
                const explanation = `${explanationItem.translation}`;
                unfeaturedExplanations.push(explanation);
              }
            }
          }
          if (unfeaturedExplanations.length > 0) {
            const copyText = `${wordItem.pos} ${unfeaturedExplanations.join(" ")}`;
            const lastExplanationItem = wordItem.translationItems.at(-1);
            const pos = lastExplanationItem?.pos ? `${lastExplanationItem.pos}.` : "";
            const lessCommonNote =
              lastExplanationItem?.frequencyTag.displayType === LingueeListItemType.LessCommon
                ? `(${LingueeListItemType.LessCommon})`
                : "";
            const displayType =
              lessCommonNote.length > 0 ? LingueeListItemType.LessCommon : LingueeListItemType.Unfeatured;
            const unFeaturedDisplayItem: ListDisplayItem = {
              key: copyText,
              title: pos,
              subtitle: `${unfeaturedExplanations.join(";  ")}  ${lessCommonNote.toLowerCase()}`,
              copyText: copyText,
              queryWordInfo: queryWordInfo,
              displayType: displayType,
              queryType: lingueeType,
              tooltip: displayType,
            };
            displayItems.push(unFeaturedDisplayItem);
          }
        }
        const displayResult: DisplaySection = {
          type: lingueeType,
          sectionTitle: sectionTitle,
          items: displayItems,
        };
        displayResults.push(displayResult);
      }
    }

    // 3. iterate examples
    if (examples) {
      const sectionTitle = `Examples:`;
      const displayItems = examples.map((example) => {
        const displayType = LingueeListItemType.Example;
        const pos = example.pos ? `${example.pos}.  ` : "";
        const title = `${example.example}`;
        const subtitle = `${pos}—  ${example.translation}`;
        const copyText = `${title} ${subtitle}`;
        const displayItem: ListDisplayItem = {
          key: copyText,
          title: title,
          subtitle: subtitle,
          copyText: copyText,
          queryWordInfo: queryWordInfo,
          displayType: displayType,
          queryType: lingueeType,
          tooltip: displayType,
        };
        return displayItem;
      });
      const exampleSection: DisplaySection = {
        type: DicionaryType.Linguee,
        sectionTitle: sectionTitle,
        items: displayItems.slice(0, 3), // show up to 3 examples.
      };
      console.log(`---> linguee exampleSection: ${JSON.stringify(exampleSection, null, 2)}`);
      displayResults.push(exampleSection);
    }

    // 4. iterate related words. 优雅
    if (relatedWords) {
      const sectionTitle = "Related words:";
      const displayItems = relatedWords.map((relatedWord) => {
        const displayType = LingueeListItemType.RelatedWord;
        const title = `${relatedWord.word}`;
        const relatedWordItems = relatedWord.translationItems?.map((explanationItem) => explanationItem.translation);
        const explanations = relatedWordItems
          ? relatedWordItems.join(";  ")
          : `${relatedWord.placeholder} ${relatedWord.pos}`;
        const pos = relatedWord.pos ? `${relatedWord.pos}.  ` : "";
        const subtitle = `${pos}${explanations}`;
        const copyText = `${title} ${subtitle}`;
        const displayItem: ListDisplayItem = {
          key: copyText,
          title: title,
          subtitle: subtitle,
          copyText: copyText,
          queryWordInfo: queryWordInfo,
          displayType: displayType,
          queryType: lingueeType,
          tooltip: displayType,
        };
        return displayItem;
      });

      const displayResult: DisplaySection = {
        type: lingueeType,
        sectionTitle: sectionTitle,
        items: displayItems.slice(0, 3), // only show 3 related words
      };
      displayResults.push(displayResult);
    }

    // 5. iterate wikipedia
    if (wikipedias) {
      const sectionTitle = "Wikipedia:";
      const displayItems = wikipedias.map((wikipedia) => {
        const displayType = LingueeListItemType.Wikipedia;
        const title = `${wikipedia.title} ${wikipedia.explanation}`;
        const displayItem: ListDisplayItem = {
          key: title,
          title: title,
          copyText: title,
          queryWordInfo: queryWordInfo,
          displayType: displayType,
          queryType: lingueeType,
          tooltip: displayType,
        };
        return displayItem;
      });
      const displayResult: DisplaySection = {
        type: lingueeType,
        sectionTitle: sectionTitle,
        items: displayItems,
      };
      displayResults.push(displayResult);
    }
  }
  return displayResults;
}
