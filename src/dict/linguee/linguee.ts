/*
 * @author: tisfeng
 * @createTime: 2022-07-24 17:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-28 14:33
 * @fileName: linguee.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment } from "@raycast/api";
import axios, { AxiosRequestConfig, AxiosRequestHeaders } from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import * as htmlparser2 from "htmlparser2";
import { HttpsProxyAgent } from "https-proxy-agent";
import { parse } from "node-html-parser";
import util from "util";
import { RequestTypeResult } from "../../types";
import { getLanguageItemFromYoudaoId } from "../../utils";
import { DicionaryType, ListDisplayItem, QueryWordInfo, RequestErrorInfo, SectionDisplayResult } from "./../../types";
import { ValidLanguagePairKey, validLanguagePairs } from "./consts";
import {
  LingueeDictionaryResult,
  LingueeDisplayType,
  LingueeExample,
  LingueeWordExplanation,
  LingueeWordItem,
} from "./types";

const htmlPath = `${environment.supportPath}/linguee.html`;

export async function rquestLingueeDictionary(
  queryText: string,
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
  console.log(`---> languagePairKey: ${languagePairKey}`);
  if (targetLanguageTitle === englishLanguageLowerTitle) {
    languagePairKey = `${targetLanguageTitle}-${fromLanguageTitle}` as ValidLanguagePairKey;
  }

  const languagePairItem = validLanguagePairs[languagePairKey];
  if (!languagePairItem) {
    console.warn(`----> ${languagePairKey} is not a valid language pair`);
    return Promise.resolve({
      type: DicionaryType.Linguee,
      result: null,
    });
  }

  const languagePair = languagePairItem.pair;

  return new Promise((resolve, reject) => {
    const lingueeUrl = `https://www.linguee.com/${languagePair}/search?source=${fromLanguageTitle}&query=${encodeURIComponent(
      queryText
    )}`;
    console.log(`---> linguee request: ${lingueeUrl}`);
    // * avoid linguee's anti-spider, otherwise it will reponse very slowly or even error.
    const proxy = process.env.http_proxy || "http://127.0.0.1:6152"; // your proxy server
    // console.log(`---> env https proxy: ${JSON.stringify(process.env)}`);
    const httpsAgent = new HttpsProxyAgent(proxy);
    const headers: AxiosRequestHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
      // withCredentials: true,
    };
    const config: AxiosRequestConfig = {
      headers: headers,
      httpsAgent: enableProxy ? httpsAgent : undefined,
    };

    axios
      .get(lingueeUrl, config)
      .then((response) => {
        console.warn(`---> linguee cost: ${response.headers["x-request-cost"]} ms`);
        console.log(`--- headers: ${util.inspect(response.config.headers, { depth: null })}`);
        console.log(`--- httpsAgent: ${util.inspect(response.config.httpsAgent, { depth: null })}`);
        const lingueeTypeResult = parseLingueeHTML(response.data);
        resolve(lingueeTypeResult);
      })
      .catch((error) => {
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
 * Parse Linguee html.
 */
export function parseLingueeHTML(html: string): RequestTypeResult {
  const rootElement = parse(html);
  const dictionaryElement = rootElement.querySelector("#dictionary");
  const exactLemmaElement = dictionaryElement?.querySelectorAll(".exact .lemma") as unknown as HTMLElement[];

  // 1. get the exact word list
  const lingueeWordItems = getWordItemList(exactLemmaElement);

  /**
   * Try search examples and see also words
   *
   * Example: <div class='example_lines inexact'> <h3>Examples:</h3>
   * See also: <div class='inexact'> <h3>See also:</h3>
   */
  const inexactElement = dictionaryElement?.querySelectorAll(".inexact");
  let examplesElement, seeAlsoWordsElement: HTMLElement[] | undefined;
  for (const element of inexactElement as unknown as HTMLElement[]) {
    const h3TextContent = element?.querySelector("h3")?.textContent;
    const inexactLemma = element.querySelectorAll(".lemma") as unknown as HTMLElement[];
    if (h3TextContent === "Examples:") {
      examplesElement = inexactLemma;
      continue;
    }
    if (h3TextContent === "See also:") {
      seeAlsoWordsElement = inexactLemma;
      continue;
    }
  }
  // 2. get examples
  const exampleItems = getExampleList(examplesElement);
  // 3. get related words
  const relatedWords = getWordItemList(seeAlsoWordsElement);

  // 4. get word infos
  const queryWord = rootElement?.querySelector(".l_deepl_ad__querytext");
  const textJavascript = rootElement?.querySelectorAll("script[type='text/javascript']")[0];
  const sourceLanguage = textJavascript?.textContent?.split("sourceLang:")[1]?.split(",")[0];
  const targetLanguage = textJavascript?.textContent?.split("targetLang:")[1]?.split(",")[0];
  console.log(`---> sourceLanguage: ${sourceLanguage}, targetLanguage: ${targetLanguage}`);

  const queryWordInfo: QueryWordInfo = {
    word: queryWord?.textContent ?? "",
    fromLanguage: sourceLanguage,
    toLanguage: targetLanguage,
  };
  const lingueeResult: LingueeDictionaryResult = {
    queryWordInfo: queryWordInfo,
    wordItems: lingueeWordItems,
    examples: exampleItems,
    relatedWords: relatedWords,
  };
  const lingueeTypeResult = {
    type: DicionaryType.Linguee,
    result: lingueeResult,
  };
  return lingueeTypeResult;
}

/**
 * Get word item list.
 */
export function getWordItemList(lemma: HTMLElement[] | undefined): LingueeWordItem[] {
  console.log(`---> getWordItemList: ${lemma?.length}`);
  const wordItemList: LingueeWordItem[] = [];
  if (lemma) {
    for (const element of lemma) {
      // 1. get top word and part of speech
      const word = element?.querySelector(".dictLink");
      const tag_wordtype = element?.querySelector(".tag_wordtype");
      const placeholder = element?.querySelector(".tag_lemma_context") ?? element?.querySelector(".placeholder");
      console.log(`--> ${word?.textContent} ${placeholder?.textContent ?? ""} : ${tag_wordtype?.textContent}`);

      const translations = element?.querySelectorAll(".featured");
      // 2. get word featured explanation
      const explanations = getWordExplanationList(translations as unknown as HTMLElement[], true);
      // remove featured explanation to get unfeatured explanation
      translations?.forEach((element) => {
        element.remove();
      });

      // 3. get less common explanation
      const translation_group = element?.querySelector(".lemma_content");
      // console.log(`---> less common: ${translation_group?.textContent}`);
      const notascommon = translation_group?.querySelector(".line .notascommon");
      const frequency = notascommon ? LingueeDisplayType.LessCommon : LingueeDisplayType.Common;
      const lessCommonTranslations = translation_group?.querySelectorAll(".translation") as unknown as HTMLElement[];
      const lessCommonExplanations = getWordExplanationList(lessCommonTranslations, false, frequency);

      let allExplanations = explanations;
      if (!explanations || !lessCommonExplanations) {
        allExplanations = explanations ?? lessCommonExplanations;
      } else {
        allExplanations = explanations.concat(lessCommonExplanations);
      }

      const lingueeWordItem: LingueeWordItem = {
        word: word?.textContent ?? "",
        partOfSpeech: tag_wordtype?.textContent ?? "",
        placeholder: placeholder?.textContent ?? "",
        explanationItems: allExplanations,
      };
      console.log(`---> word item: ${JSON.stringify(lingueeWordItem, null, 2)}`);
      wordItemList.push(lingueeWordItem);
    }
  }
  return wordItemList;
}

/**
 * Get word explanation list.
 */
function getWordExplanationList(
  translations: HTMLElement[] | undefined,
  isFeatured = false,
  designatedFrequencey?: LingueeDisplayType
) {
  const explanationItems = [];
  if (translations) {
    for (const translation of translations) {
      // console.log(`---> translation text: ${translation?.textContent}`);
      const explanationElement = translation?.querySelector(".dictLink");
      const tag_type = translation?.querySelector(".tag_type");
      const tag_c = translation?.querySelector(".tag_c");

      if (explanationElement) {
        const frequencey =
          tag_c?.textContent === `(${LingueeDisplayType.OftenUsed})`
            ? LingueeDisplayType.OftenUsed
            : LingueeDisplayType.Common;
        const explanation: LingueeWordExplanation = {
          explanation: explanationElement?.textContent ?? "",
          partOfSpeech: tag_type?.textContent ?? "",
          frequency: designatedFrequencey ?? frequencey,
          isFeatured: isFeatured,
        };
        // console.log(`---> ${JSON.stringify(explanation, null, 2)}`);
        explanationItems.push(explanation);
      }
    }
  }

  return explanationItems;
}

/**
 * Get example list.
 */
function getExampleList(exmapleLemma: HTMLElement[] | undefined) {
  const exampleItems = [];
  if (exmapleLemma) {
    for (const inexact of exmapleLemma) {
      const exampleElement = inexact?.querySelector(".line .dictLink");
      const translationElement = inexact?.querySelector(".tag_trans .dictLink");
      const lingueeExample: LingueeExample = {
        example: exampleElement?.textContent ?? "",
        translation: translationElement?.textContent ?? "",
      };
      exampleItems.push(lingueeExample);
    }
  }
  return exampleItems;
}

/**
 * Formate linguee display result
 */
export function formatLingueeDisplayResult(lingueeTypeResult: RequestTypeResult): SectionDisplayResult[] {
  const displayResults: SectionDisplayResult[] = [];
  if (lingueeTypeResult.result) {
    const { queryWordInfo, wordItems, examples, relatedWords } = lingueeTypeResult.result as LingueeDictionaryResult;
    if (wordItems) {
      for (const wordItem of wordItems) {
        let partOfSpeech = wordItem.partOfSpeech ? `.  ${wordItem.partOfSpeech}` : "";
        const palaceholder = wordItem.placeholder ? ` ${wordItem.placeholder}` : "";
        if (palaceholder) {
          partOfSpeech = wordItem.partOfSpeech ? `  ${wordItem.partOfSpeech}` : "";
        }
        const sectionTitle = `${queryWordInfo.word}${palaceholder}${partOfSpeech}`;
        const displayItems = [];
        if (wordItem.explanationItems) {
          for (const explanationItem of wordItem.explanationItems) {
            // 1. iterate featured explanation
            if (explanationItem.isFeatured) {
              const title = `${explanationItem.explanation}`;
              const isCommon = explanationItem.frequency === LingueeDisplayType.Common;
              const subtitle = `${explanationItem.partOfSpeech}  ${isCommon ? "" : `(${explanationItem.frequency})`}`;
              const copyText = `${title} ${subtitle}`;
              const displayType = isCommon ? LingueeDisplayType.Common : LingueeDisplayType.OftenUsed;
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
          if (wordItem.explanationItems) {
            for (const explanationItem of wordItem.explanationItems) {
              if (!explanationItem.isFeatured) {
                const explanation = `${explanationItem.explanation}`;
                unfeaturedExplanations.push(explanation);
              }
            }
          }
          if (unfeaturedExplanations.length > 0) {
            const copyText = `${wordItem.partOfSpeech} ${unfeaturedExplanations.join(" ")}`;
            const lastExplanationItem = wordItem.explanationItems.at(-1);
            const lessCommonNote =
              lastExplanationItem?.frequency === LingueeDisplayType.LessCommon
                ? `(${LingueeDisplayType.LessCommon})`
                : "";
            const displayType =
              lessCommonNote.length > 0 ? LingueeDisplayType.LessCommon : LingueeDisplayType.Unfeatured;
            const unFeaturedDisplayItem: ListDisplayItem = {
              key: copyText,
              title: `${lastExplanationItem?.partOfSpeech}`,
              subtitle: `${unfeaturedExplanations.join(";  ")}  ${lessCommonNote}`,
              copyText: copyText,
              queryWordInfo: queryWordInfo,
              displayType: displayType,
              tooltip: displayType,
            };
            displayItems.push(unFeaturedDisplayItem);
          }
        }

        const displayResult: SectionDisplayResult = {
          type: DicionaryType.Linguee,
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
        const title = `${example.example}`;
        const subtitle = `—  ${example.translation}`;
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
      const displayResult: SectionDisplayResult = {
        type: DicionaryType.Linguee,
        sectionTitle: sectionTitle,
        items: displayItems.slice(0, 3), // only show 3 examples
      };
      displayResults.push(displayResult);
    }

    // 4. iterate related words
    if (relatedWords) {
      const sectionTitle = "See also:";
      const displayItems = relatedWords.map((relatedWord) => {
        const displayType = LingueeDisplayType.RelatedWord;
        const title = `${relatedWord.word}`;
        const relatedWordItems = relatedWord.explanationItems?.map((explanationItem) => {
          const explanation = `${explanationItem.explanation}`;
          const partOfSpeech = explanationItem.partOfSpeech ? `  ${explanationItem.partOfSpeech}` : "";
          return `${explanation}${partOfSpeech}`;
        });
        const subtitle = relatedWordItems
          ? relatedWordItems.join("  ·  ")
          : `${relatedWord.placeholder} ${relatedWord.partOfSpeech}`;
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

      const displayResult: SectionDisplayResult = {
        type: DicionaryType.Linguee,
        sectionTitle: sectionTitle,
        items: displayItems.slice(0, 3), // only show 3 related words
      };
      displayResults.push(displayResult);
    }
  }

  return displayResults;
}

/**
 * Get linguee associative word phrases
 */
export const parseDOMResult = (dom: ReturnType<typeof parse>) => {
  const list = dom.querySelectorAll(".autocompletion_item");

  return Array.from(list).map((item) => {
    const $mainItem = item.querySelector(".main_row .main_item");
    const word = $mainItem?.textContent;
    const href = $mainItem?.attributes.href;
    const lid = $mainItem?.attributes.lid;
    const wordType = item.querySelector(".main_row .main_wordtype")?.textContent;
    const translationDOMList = item.querySelectorAll(".translation_item");
    const translations = Array.from(translationDOMList).map((item) => {
      const lid = item.attributes.lid;
      const wordType = item.querySelector(".wordtype")?.textContent;
      item.querySelector(".sep")?.replaceWith("");
      item.querySelector(".wordtype")?.replaceWith("");

      const word = item.textContent?.trim();

      if (!word || !wordType || !href || !lid) return;

      return {
        word,
        wordType,
        lid,
      };
    });

    if (!word || !wordType || !lid || !href) return;

    return {
      word: word,
      wordType: wordType,
      lid,
      href,
      translations: translations,
    };
  });
};

export function rquestLingueeWord0() {
  console.log("---> requesting linguee word");

  //  read html file async
  fs.readFile(htmlPath, "utf8", (err, data) => {
    if (err) {
      console.error(`read linguee html file error: ${err}`);
      return;
    }
    console.log("---> read linguee html file success");

    const parser = new htmlparser2.Parser(
      {
        onattribute(name, value, quote?) {
          console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          // if (name === "class" && value === "tag_wordtype") {
          //   console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          // }
        },
        onopentag(name, attributes) {
          console.log(`name: ${name}, attributes: ${JSON.stringify(attributes)}`);
          // if (name === "span" && attributes.class === "tag_lemma") {
          //   console.log(`name: ${name}, attributes: ${JSON.stringify(attributes)}`);
          // }
        },
        ontext(text) {
          /*
           * Fires whenever a section of text was processed.
           *
           * Note that this can fire at any point within text and you might
           * have to stitch together multiple pieces.
           */
          console.log("-->", text);
        },
        onprocessinginstruction(name, data) {
          console.log(`name: ${name}, data: ${data}`);
        },
      },
      { xmlMode: true }
    );
    parser.write(data);
    parser.end();
  });
}

export function rquestLingueeWord1() {
  console.log("---> requesting linguee word");
  const url = "https://www.linguee.com/english-chinese/search?source=auto&query=good";

  axios
    .get(url)
    .then((res) => {
      console.warn(`cost: ${res.headers["x-request-cost"]} ms`);

      const parser = new htmlparser2.Parser({
        onattribute(name, value, quote?) {
          if (name === "class" && value === "tag_lemma") {
            console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          }
        },
      });
      parser.write(res.data);
      parser.end();

      //   const dom = htmlparser2.parseDocument(res.data);
    })
    .catch((err) => {
      console.log(err);
    });
}

export function rquestLingueeWord2() {
  console.log("---> requesting linguee word");
  const url = "https://www.linguee.com/english-chinese/search?source=auto&query=good";
  //   const url = "https://cn.linguee.com/chinese-english/search?source=english&query=good";
  //   const url = "https://www.linguee.com/search?source=english&qe=good";
  axios
    .get(url)
    .then((res) => {
      console.warn(`cost: ${res.headers["x-request-cost"]} ms`);

      // use cheerio to parse html
      const $ = cheerio.load(res.data);
      //   const pronounceText = $(".hd_p1_1>.hd_prUS").text(); // '美 [ɡʊd]'
      //   for (const element of $(".qdef>ul>li")) {
      // const titles = $(".dis", "#pos_0").map((i, element) => {

      // get class 'exact' > 'line lemma_desc'
      const lemma_desc = $(".exact>.lemma>");
      console.log(`tag_lemma text: ${lemma_desc.find(".tag_lemma").text()}`);

      const tag_lemma = lemma_desc.find(".tag_lemma");
      console.log(`tag_lemma length: ${tag_lemma.length}, first: ${tag_lemma.first().text()}`);

      for (const element of tag_lemma) {
        const word = $(element).find(".dictLink").text();
        const part = $(element).find(".tag_wordtype").text();
        console.log(`tag_lemma: ${word}: ${part}`);
      }

      const translation_lines = lemma_desc.find(".translation_lines");
      console.log(`translation_lines length: ${translation_lines.length}, first: ${translation_lines.first().text()}`);

      console.warn(`translation_lines: ${$("div .translation_lines").text()}}`);

      for (const element of translation_lines.find(".tag_trans")) {
        console.log(`translation: ${$(element).text()}`);
        // const word = $(element).find(".dictLink").text();
        // const part = $(element).find(".tag_wordtype").text();
        // console.log(`${word}: ${part}`);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}

/**
 <ul id="fruits">
  <li class="apple">Apple</li>
  <li class="orange">Orange</li>
  <li class="pear">Pear</li>
</ul>


$('.apple', '#fruits').text()
//=> Apple

$('ul .pear').attr('class')
//=> pear

$('li[class=orange]').html()
//=> Orange
*/
