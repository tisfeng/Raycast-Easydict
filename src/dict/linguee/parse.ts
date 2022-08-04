/*
 * @author: tisfeng
 * @createTime: 2022-08-01 10:44
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-04 21:32
 * @fileName: parse.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { parse } from "node-html-parser";
import { DicionaryType, QueryWordInfo, RequestTypeResult } from "../../types";
import { getLanguageItemFromDeepLSourceId } from "../../utils";
import {
  LingueeDictionaryResult,
  LingueeDisplayType,
  LingueeExample,
  LingueeWikipedia,
  LingueeWordItem,
  LingueeWordTranslation,
} from "./types";

/**
 * Parse Linguee html. node-html-parser cost: ~40ms
 *
 * Todo: use cheerio to parse html.
 */
export function parseLingueeHTML(html: string): RequestTypeResult {
  const rootElement = parse(html);
  const dictionaryElement = rootElement.querySelector("#dictionary");
  const exactLemmaElement = dictionaryElement?.querySelectorAll(".exact .lemma");

  // 1. get word infos.
  const queryWord = rootElement.querySelector(".l_deepl_ad__querytext");
  const sourceLanguage = getYoudaoLanguageId("sourceLang", rootElement as unknown as HTMLElement);
  const targetLanguage = getYoudaoLanguageId("targetLang", rootElement as unknown as HTMLElement);
  console.log(`---> sourceLanguage: ${sourceLanguage}, targetLanguage: ${targetLanguage}`);

  // 2. get the exact word list
  const lingueeWordItems = getWordItemList(exactLemmaElement as unknown as HTMLElement[]);

  /**
   * try search examples, and related words if have.
   *
   * Example: <div class='example_lines inexact'> <h3>Examples:</h3>
   * See also: <div class='inexact'> <h3>See also:</h3>
   */
  const inexactElement = dictionaryElement?.querySelectorAll(".inexact");
  let examplesElement, relatedWordsElement;
  if (inexactElement) {
    for (const element of inexactElement) {
      const h3TextContent = element?.querySelector("h3")?.textContent;
      const inexactLemma = element.querySelectorAll(".lemma");
      if (h3TextContent === "Examples:") {
        examplesElement = inexactLemma;
        continue;
      }
      if (h3TextContent === "See also:") {
        relatedWordsElement = inexactLemma;
        continue;
      }
    }
  }

  // 3. get examples
  const exampleItems = getExampleList(examplesElement as unknown as HTMLElement[]);

  // 4. get related words
  const relatedWords = getWordItemList(relatedWordsElement as unknown as HTMLElement[]);

  // 5. get wikipedia
  const wikipediaElement = dictionaryElement?.querySelectorAll(".wikipedia .abstract");
  const wikipedia = getWikipedia(wikipediaElement as unknown as HTMLElement[]);

  const queryWordInfo: QueryWordInfo = {
    word: queryWord?.textContent ?? "",
    fromLanguage: sourceLanguage ?? "",
    toLanguage: targetLanguage ?? "",
    isWord: lingueeWordItems.length > 0,
  };
  const lingueeResult: LingueeDictionaryResult = {
    queryWordInfo: queryWordInfo,
    wordItems: lingueeWordItems,
    examples: exampleItems,
    relatedWords: relatedWords,
    wikipedias: wikipedia,
  };
  const result = isLingueeDictionaryEmpty(lingueeResult) ? null : lingueeResult;
  const lingueeTypeResult = {
    type: DicionaryType.Linguee,
    result: result,
    translations: [],
  };
  return lingueeTypeResult;
}

/**
 * Check linguee result is empty.
 */
export function isLingueeDictionaryEmpty(lingueeResult: LingueeDictionaryResult): boolean {
  return (
    lingueeResult === null ||
    lingueeResult.wordItems.length === 0 ||
    lingueeResult.examples.length === 0 ||
    lingueeResult.relatedWords.length === 0 ||
    lingueeResult.wikipedias.length === 0
  );
}

/**
 * Get word item list.  > .exact .lemma
 */
function getWordItemList(lemmas: HTMLElement[] | undefined): LingueeWordItem[] {
  console.log(`---> getWordItemList`);
  const wordItemList: LingueeWordItem[] = [];
  if (lemmas?.length) {
    for (const lemma of lemmas) {
      // console.log(`---> lemma: ${element}`);

      // 1. get top word and part of speech
      const placeholder = lemma?.querySelector(".dictLink .placeholder");
      let placeholderText = "";
      if (placeholder) {
        placeholderText = placeholder.textContent ?? "";
        console.log(`---> placeholder: ${placeholderText}`);
        placeholder.remove(); // * .dictLink contains .placeholder
      }

      // * dictLink maybe more than one, "good at"
      const dictLinks = lemma?.querySelectorAll(".lemma_desc .dictLink");
      let words = "";
      if (dictLinks?.length) {
        const wordArray: string[] = [];
        dictLinks.forEach((dictLink) => {
          const wordText = dictLink?.textContent ?? "";
          wordArray.push(wordText);
        });
        words = wordArray.join(" ");
      }

      const tag_lemma = lemma?.querySelector(".tag_lemma");
      const tag_lemma_context = lemma?.querySelector(".tag_lemma_context");
      if (tag_lemma_context) {
        placeholderText = tag_lemma_context.textContent ?? "";
        console.log(`---> tag_lemma_context placeholder: ${placeholderText}`);
      }
      const tag_wordtype = lemma?.querySelector(".tag_wordtype");
      const tag_type = lemma?.querySelector(".tag_type"); // related word pos
      const pos = tag_wordtype ?? tag_type;
      const featured = lemma.getAttribute("class")?.includes("featured") ?? false;
      // * note: audio is not always exist.
      const audio = lemma.querySelector("h2[class=line] .audio")?.getAttribute("id");
      const audioUrl = audio ? `https://www.linguee.com/mp3/${audio}` : "";
      console.log(`--> ${words} ${placeholderText} : ${pos?.textContent}`);

      const featuredTranslations = lemma?.querySelectorAll(".translation.sortablemg.featured"); // <div class='translation sortablemg featured'>
      // 2. get word featured explanation
      const explanations = getWordExplanationList(featuredTranslations as unknown as HTMLElement[], true);
      // remove featured explanation to get unfeatured explanation
      featuredTranslations?.forEach((element) => {
        element.remove();
      });

      // 3. get less common explanation
      const lemmaContent = lemma?.querySelector(".lemma_content");
      // console.log(`---> less common: ${translation_group?.textContent}`);
      const notascommon = lemmaContent?.querySelector(".line .notascommon");
      const frequency = notascommon ? LingueeDisplayType.LessCommon : LingueeDisplayType.Common;
      const lessCommonTranslations = lemmaContent?.querySelectorAll(".translation") as unknown as HTMLElement[];
      const lessCommonExplanations = getWordExplanationList(lessCommonTranslations, false, frequency);

      let allExplanations = explanations;
      if (!explanations || !lessCommonExplanations) {
        allExplanations = explanations ?? lessCommonExplanations;
      } else {
        allExplanations = explanations.concat(lessCommonExplanations);
      }

      const lingueeWordItem: LingueeWordItem = {
        word: words,
        title: tag_lemma?.textContent ?? "",
        featured: featured,
        pos: pos?.textContent ?? "",
        placeholder: placeholderText,
        translationItems: allExplanations,
        audioUrl: audioUrl,
      };
      console.log(`---> word item: ${JSON.stringify(lingueeWordItem, null, 2)}`);
      wordItemList.push(lingueeWordItem);
    }
  }
  return wordItemList;
}

/**
 * Get word explanation list. | .exact .lemma .featured
 */
function getWordExplanationList(
  translations: HTMLElement[] | undefined,
  isFeatured = false,
  designatedFrequencey?: LingueeDisplayType
) {
  console.log(`---> getWordExplanationList, length: ${translations?.length} , isFeatured: ${isFeatured}`);
  const explanationItems = [];
  if (translations?.length) {
    for (const translation of translations) {
      // console.log(`---> translation: ${translation}`);

      const explanationElement = translation?.querySelector(".dictLink");
      const tag_type = translation?.querySelector(".tag_type"); // adj
      const tag_c = translation?.querySelector(".tag_c"); // (often used)
      const tag_forms = translation?.querySelector(".tag_forms"); // french forms, english-french
      const tagText = tag_c?.textContent ?? tag_forms?.textContent ?? "";
      const audio = translation?.querySelector(".audio")?.getAttribute("id");
      const audioUrl = audio ? `https://www.linguee.com/mp3/${audio}` : "";
      const examples = translation?.querySelectorAll(".example");
      const exampleItems: LingueeExample[] = [];
      if (examples?.length) {
        examples.forEach((example) => {
          const tag_s = example?.querySelector(".tag_s");
          const tag_t = example?.querySelector(".tag_t");
          const exampleItem: LingueeExample = {
            example: tag_s?.textContent ?? "",
            translation: tag_t?.textContent ?? "",
            pos: "",
          };
          exampleItems.push(exampleItem);
        });
      }
      const tag = tagText.trim();
      const wordFrequency = getExplanationDisplayType(tag);
      const explanation: LingueeWordTranslation = {
        translation: explanationElement?.textContent ?? "",
        pos: tag_type?.textContent ?? "",
        featured: isFeatured,
        audioUrl: audioUrl,
        examples: exampleItems,
        frequencyTag: {
          tagText: tag,
          displayType: designatedFrequencey ?? wordFrequency,
        },
      };
      // console.log(`---> ${JSON.stringify(explanation, null, 2)}`);
      explanationItems.push(explanation);
    }
  }
  return explanationItems;
}

/**
 * Get linguee display type according to word frequency.
 */
function getExplanationDisplayType(wordFrequency: string): LingueeDisplayType {
  // console.log(`---> word frequency: ${wordFrequency}`);
  // remove parentheses
  const wordFrequencyWithoutParentheses = wordFrequency.trim().replace(/\(|\)/g, "").toLowerCase();
  let wordDisplayType: LingueeDisplayType;
  switch (wordFrequencyWithoutParentheses) {
    case LingueeDisplayType.AlmostAlwaysUsed.toLowerCase(): {
      wordDisplayType = LingueeDisplayType.AlmostAlwaysUsed;
      break;
    }
    case LingueeDisplayType.OftenUsed.toLowerCase(): {
      wordDisplayType = LingueeDisplayType.OftenUsed;
      break;
    }
    case LingueeDisplayType.LessCommon.toLowerCase(): {
      wordDisplayType = LingueeDisplayType.LessCommon;
      break;
    }
    default: {
      if (wordFrequencyWithoutParentheses.length) {
        wordDisplayType = LingueeDisplayType.SpecialForms;
        break;
      }
      wordDisplayType = LingueeDisplayType.Common;
      break;
    }
  }
  // console.log(`---> word display type: ${wordDisplayType}`);
  return wordDisplayType;
}

/**
 * Get example list.  | .inexact  Examples:  .lemma
 */
function getExampleList(exampleLemma: HTMLElement[] | undefined) {
  console.log(`---> getExampleList`);
  const exampleItems = [];
  if (exampleLemma?.length) {
    for (const lemma of exampleLemma) {
      const exampleElement = lemma.querySelector(".line .dictLink");
      const tagType = lemma.querySelector(".line .tag_type");
      // * may have multiple translations.
      const translationElement = lemma.querySelectorAll(".lemma_content .dictLink");
      const translations: string[] = [];
      translationElement.forEach((element) => {
        if (element.textContent) {
          translations.push(element.textContent);
        }
      });
      // console.log(`---> translations: ${JSON.stringify(translations, null, 2)}`);
      const lingueeExample: LingueeExample = {
        example: exampleElement?.textContent ?? "",
        pos: tagType?.textContent ?? "",
        translation: translations.join(";  "),
      };
      exampleItems.push(lingueeExample);
    }
  }
  return exampleItems;
}

/**
 * Get LingueeWikipedia from wikipedia HTMLElement. | .wikipedia .abstract
 */
function getWikipedia(abstractElement: HTMLElement[] | undefined) {
  console.log(`---> getWikipedia`);
  const wikipedias: LingueeWikipedia[] = [];
  if (abstractElement?.length) {
    for (const element of abstractElement as unknown as HTMLElement[]) {
      // console.log(`---> element: ${element}`);
      const h2Title = element.querySelector("h2");
      const content = h2Title?.nextSibling;
      const sourceUrl = element.querySelector("a")?.getAttribute("href");
      const source = element.querySelector(".source_url_spacer");
      const wikipedia: LingueeWikipedia = {
        title: h2Title?.textContent ?? "",
        explanation: content?.textContent?.trim() ?? "",
        source: source?.textContent ?? "",
        sourceUrl: sourceUrl ?? "",
      };
      // console.log(`---> wikipedia: ${JSON.stringify(wikipedia, null, 2)}`);
      wikipedias.push(wikipedia);
    }
  }
  return wikipedias;
}

/**
 * Get Youdao language id from html.
 *
 * <script type='text/javascript'> sourceLang:'EN'
 * return EN
 */
function getYoudaoLanguageId(language: string, rootElement: HTMLElement): string | undefined {
  const textJavascript = rootElement.querySelector("script[type=text/javascript]");
  const sourceLang = textJavascript?.textContent?.split(`${language}:`)[1]?.split(",")[0];
  if (sourceLang) {
    // remove "'"
    const sourceLanguage = sourceLang.replace(/'/g, "");
    return getLanguageItemFromDeepLSourceId(sourceLanguage).youdaoLanguageId;
  }
}

/**
 * Get linguee associative word phrases
 */
export const parseGuessWord = (dom: ReturnType<typeof parse>) => {
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
