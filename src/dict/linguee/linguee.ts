/*
 * @author: tisfeng
 * @createTime: 2022-07-24 17:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-02 17:07
 * @fileName: linguee.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment } from "@raycast/api";
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import util from "util";
import { RequestTypeResult } from "../../types";
import { getLanguageItemFromYoudaoId } from "../../utils";
import { dictionarySeparator, userAgent } from "./../../consts";
import { DicionaryType, ListDisplayItem, RequestErrorInfo, SectionDisplayItem } from "./../../types";
import { ValidLanguagePairKey, validLanguagePairs } from "./consts";
import { parseLingueeHTML } from "./parse";
import { LingueeDictionaryResult, LingueeDisplayType } from "./types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const htmlPath = `${environment.supportPath}/linguee.html`;

/**
 * Get linguee dictionary result.
 *
 * eg. good: https://www.linguee.com/english-chinese/search?source=auto&query=good
 */
export async function rquestLingueeDictionary(
  queryWord: string,
  fromLanguage: string,
  targetLanguage: string,
  enableProxy = false
): Promise<RequestTypeResult> {
  let fromLanguageTitle = getLanguageItemFromYoudaoId(fromLanguage).languageTitle;
  let targetLanguageTitle = getLanguageItemFromYoudaoId(targetLanguage).languageTitle;
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
  console.log(`---> language pair key: ${languagePairKey}`);
  if (targetLanguageTitle === englishLanguageLowerTitle) {
    languagePairKey = `${targetLanguageTitle}-${fromLanguageTitle}` as ValidLanguagePairKey;
  }

  const languagePairItem = validLanguagePairs[languagePairKey];
  if (!languagePairItem) {
    console.warn(`----> linguee: ${languagePairKey} is not a valid language pair`);
    return Promise.resolve({
      type: DicionaryType.Linguee,
      result: null,
      translation: "",
    });
  }

  const languagePair = languagePairItem.pair;

  return new Promise((resolve, reject) => {
    // Todo: source should be fromLanguage, but current detected fromLanguage may be inaccurate, so have to use auto...
    const lingueeUrl = `https://www.linguee.com/${languagePair}/search?source=auto&query=${encodeURIComponent(
      queryWord
    )}`;
    console.log(`---> linguee request: ${lingueeUrl}`);

    // * avoid linguee's anti-spider, otherwise it will reponse very slowly or even error.
    const proxy = process.env.http_proxy || "http://127.0.0.1:6152"; // your proxy server
    // console.log(`---> env https proxy: ${JSON.stringify(process.env)}`);
    const httpsAgent = new HttpsProxyAgent(proxy);
    const headers: AxiosRequestHeaders = {
      "User-Agent": userAgent,
      // accept: "*/*",
      // connection: "keep-alive",
      // withCredentials: true,
    };
    const config: AxiosRequestConfig = {
      headers: headers,
      httpsAgent: enableProxy ? httpsAgent : undefined,
      responseType: "arraybuffer", // handle French content-type iso-8859-15
    };

    axios
      .get(lingueeUrl, config)
      .then((response) => {
        console.warn(`---> linguee cost: ${response.headers["x-request-cost"]} ms`);
        console.log(`--- headers: ${util.inspect(response.config.headers, { depth: null })}`);
        console.log(`--- httpsAgent: ${util.inspect(response.config.httpsAgent, { depth: null })}`);
        const contentType = response.headers["content-type"];
        const data: Buffer = response.data;
        console.log(`---> content-type: ${contentType}`);
        const html = data.toString(contentType.includes("iso-8859-15") ? "latin1" : "utf-8");
        const lingueeTypeResult = parseLingueeHTML(html);
        resolve(lingueeTypeResult);
      })
      .catch((error) => {
        // Request failed with status code 503, this means your ip is banned by linguee for a few hours.
        console.error(`request linguee error: ${error}`);
        const errorInfo: RequestErrorInfo = {
          type: DicionaryType.Linguee,
          code: error.response?.status.toString(),
          message: error.response?.statusText,
        };
        reject(errorInfo);
      });
  });
}

/**
 * Formate linguee display result
 */
export function formatLingueeDisplayResult(lingueeTypeResult: RequestTypeResult): SectionDisplayItem[] {
  const displayResults: SectionDisplayItem[] = [];
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
      const displayType = LingueeDisplayType.Translation;

      const lingueeTitleSection: SectionDisplayItem = {
        type: lingueeType,
        sectionTitle: `${lingueeType} Dictionary ${dictionarySeparator}`,
        items: [
          {
            key: copyText,
            title: translation,
            subtitle: word,
            copyText: copyText,
            displayType: displayType,
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
              const isCommon = explanationItem.frequencyTag.displayType === LingueeDisplayType.Common;
              const tagText = isCommon ? "" : `  ${explanationItem.frequencyTag.tagText}`;
              const translation = explanationItem.examples.length ? explanationItem.examples[0].translation : "";
              let pos = explanationItem.pos;
              if (pos && (tagText || translation)) {
                pos = `${pos}.`;
              }
              const subtitle = `${pos}${tagText}     ${translation}`;
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
              lastExplanationItem?.frequencyTag.displayType === LingueeDisplayType.LessCommon
                ? `(${LingueeDisplayType.LessCommon})`
                : "";
            const displayType =
              lessCommonNote.length > 0 ? LingueeDisplayType.LessCommon : LingueeDisplayType.Unfeatured;
            const unFeaturedDisplayItem: ListDisplayItem = {
              key: copyText,
              title: pos,
              subtitle: `${unfeaturedExplanations.join(";  ")}  ${lessCommonNote}`,
              copyText: copyText,
              queryWordInfo: queryWordInfo,
              displayType: displayType,
              tooltip: displayType,
            };
            displayItems.push(unFeaturedDisplayItem);
          }
        }
        const displayResult: SectionDisplayItem = {
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
        const displayType = LingueeDisplayType.Example;
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
          tooltip: displayType,
        };
        return displayItem;
      });
      const exampleSection: SectionDisplayItem = {
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
        const displayType = LingueeDisplayType.RelatedWord;
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
          tooltip: displayType,
        };
        return displayItem;
      });

      const displayResult: SectionDisplayItem = {
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
        const displayType = LingueeDisplayType.Wikipedia;
        const title = `${wikipedia.title} ${wikipedia.explanation}`;
        const displayItem: ListDisplayItem = {
          key: title,
          title: title,
          copyText: title,
          queryWordInfo: queryWordInfo,
          displayType: displayType,
          tooltip: displayType,
        };
        return displayItem;
      });
      const displayResult: SectionDisplayItem = {
        type: lingueeType,
        sectionTitle: sectionTitle,
        items: displayItems,
      };
      displayResults.push(displayResult);
    }
  }
  return displayResults;
}
