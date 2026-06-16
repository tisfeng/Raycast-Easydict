/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { parse } from "node-html-parser";
import { getLanguageEnglishName, getLanguageItemFromDeepLSourceCode } from "@/language/languages";
import { DictionaryType, DisplaySection, ListDisplayItem, QueryTypeResult } from "@/types";
import { checkIsWord } from "@/utils";
import { logTrace, logWarn } from "@/devLog";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getValidLingueeLanguagePair } from "./languages";
import {
  LingueeDictionaryResult,
  LingueeExample,
  LingueeListItemType,
  LingueePosText,
  LingueeWikipedia,
  LingueeWordExplanation,
  LingueeWordItem,
} from "./types";

/**
 * Parse Linguee html. node-html-parser cost: ~40ms
 *
 * Todo: use cheerio to parse html.
 *
 * Reference: https://github.com/felipe-augusto/linguee/blob/master/src/responseTransformer/word.js
 *
 * https://github.com/javierdwd/linguee-client/blob/master/lib/extractors/WordExtractor.js
 */
export function parseLingueeHTML(html: string): QueryTypeResult {
  const rootElement = parse(html);
  const dictionaryElement = rootElement.querySelector("#dictionary");
  const exactLemmaElement = dictionaryElement?.querySelectorAll(".exact .lemma");

  // 1. get word infos.
  const queryWord = rootElement.querySelector(".l_deepl_ad__querytext");
  const sourceLanguage = getYoudaoLanguageId("sourceLang", rootElement as unknown as HTMLElement);
  const targetLanguage = getYoudaoLanguageId("targetLang", rootElement as unknown as HTMLElement);
  logTrace("parse", `sourceLanguage: ${sourceLanguage}, targetLanguage: ${targetLanguage}`);

  // 2. get the exact word list
  const wordItems = getWordItemList(exactLemmaElement as unknown as HTMLElement[]);

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

  let speakUrl = "";
  if (wordItems?.length) {
    speakUrl = wordItems[0].audioUrl;
  }

  const queryWordInfo: QueryWordInfo = {
    word: queryWord?.textContent ?? "",
    fromLanguage: sourceLanguage ?? "",
    toLanguage: targetLanguage ?? "",
    speechUrl: speakUrl,
  };
  const lingueeResult: LingueeDictionaryResult = {
    queryWordInfo: queryWordInfo,
    wordItems: wordItems,
    examples: exampleItems,
    relatedWords: relatedWords,
    wikipedias: wikipedia,
  };
  const hasEntries = hasLingueeDictionaryEntries(lingueeResult);
  if (!hasEntries) {
    logWarn("parse", "no entries found in Linguee dictionary");
  }

  queryWordInfo.hasDictionaryEntries = hasEntries;
  queryWordInfo.isWord = hasEntries;
  const result = hasEntries ? lingueeResult : undefined;
  const lingueeTypeResult: QueryTypeResult = {
    type: DictionaryType.Linguee,
    result: result,
    translations: [],
    queryWordInfo: queryWordInfo,
  };
  return lingueeTypeResult;
}

/**
 * Check linguee has dictionary entries.
 */
export function hasLingueeDictionaryEntries(lingueeResult: LingueeDictionaryResult): boolean {
  return (
    lingueeResult.wordItems.length > 0 ||
    lingueeResult.examples.length > 0 ||
    lingueeResult.relatedWords.length > 0 ||
    lingueeResult.wikipedias.length > 0
  );
}

/**
 * Get word item list.  > .exact .lemma
 */
function getWordItemList(lemmas: HTMLElement[] | undefined): LingueeWordItem[] {
  logTrace("parse", "getWordItemList");
  const wordItemList: LingueeWordItem[] = [];
  if (lemmas?.length) {
    for (const lemma of lemmas) {
      // Todo: clean lemma?
      // 1. get top word and part of speech
      const placeholder = lemma?.querySelector(".dictLink .placeholder");
      let placeholderText = "";
      if (placeholder) {
        placeholderText = placeholder.textContent ?? "";
        logTrace("parse", `placeholder: ${placeholderText}`);
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
        logTrace("parse", `tag_lemma_context: ${placeholderText}`);
      }
      const tag_wordtype = lemma?.querySelector(".lemma_desc .tag_wordtype"); // "noun, feminine"
      const tag_forms = lemma?.querySelector(".lemma_desc .tag_forms"); // eg. "good" in French, "(bonne f sl, bons m pl, bonnes f pl)"
      const tag_forms_text = getTagFormsText(tag_forms);
      const tag_area = lemma?.querySelector(".lemma_desc .tag_area"); // eg. heel in German, "heel. verb (nautical science)"
      const tag_area_text = tag_area ? `${tag_area?.textContent}` : "";
      const posText = `${tag_wordtype?.textContent ?? ""} ${tag_forms_text} ${tag_area_text}`;
      const tag_type = lemma?.querySelector(".tag_type"); // related word pos
      const pos = tag_wordtype ? posText : (tag_type?.textContent ?? "");
      const featured = lemma.getAttribute("class")?.includes("featured") ?? false;
      // * note: audio is not always exist.
      const audio = tag_lemma?.querySelector(".audio")?.getAttribute("id");
      const audioUrl = audio ? `https://www.linguee.com/mp3/${audio}` : "";

      const featuredTranslations = lemma?.querySelectorAll(".translation.sortablemg.featured"); // <div class='translation sortablemg featured'>

      // 2. get word featured explanation
      const explanations = getWordExplanationList(featuredTranslations as unknown as HTMLElement[], true);
      // remove featured explanation to get unfeatured explanation
      featuredTranslations?.forEach((element) => {
        element.remove();
      });

      // 3. get less common explanation
      const lemmaContent = lemma?.querySelector(".lemma_content");
      const notascommon = lemmaContent?.querySelector(".line .notascommon");
      const frequency = notascommon ? LingueeListItemType.LessCommon : LingueeListItemType.Common;
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
        pos: pos,
        placeholder: placeholderText,
        translationItems: allExplanations,
        audioUrl: audioUrl,
      };
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
  designatedFrequency?: LingueeListItemType,
) {
  const explanationItems: LingueeWordExplanation[] = [];
  if (translations?.length) {
    for (const translation of translations) {
      const explanationElement = translation?.querySelector(".dictLink");
      const tag_type = translation?.querySelector(".tag_type"); // adj
      const tag_c = translation?.querySelector(".tag_c"); // (often used)
      const tag_forms = translation?.querySelector(".tag_forms"); // french forms, english-french
      const tag_forms_text = getTagFormsText(tag_forms);
      const tagText = `${tag_c?.textContent ?? ""} ${tag_forms_text}`;
      const audio = translation?.querySelector(".audio")?.getAttribute("id");
      const audioUrl = audio ? `https://www.linguee.com/mp3/${audio}` : "";
      const examples = translation?.querySelectorAll(".example");
      const exampleItems: LingueeExample[] = [];
      if (examples?.length) {
        examples.forEach((example) => {
          const tag_s = example?.querySelector(".tag_s");
          const tag_t = example?.querySelector(".tag_t");
          const exampleItem: LingueeExample = {
            example: { text: tag_s?.textContent ?? "", pos: "" },
            translations: [{ text: tag_t?.textContent ?? "", pos: "" }],
          };
          exampleItems.push(exampleItem);
        });
      }
      const tag = tagText.trim();
      const wordFrequency = getExplanationDisplayType(tag);
      const explanation: LingueeWordExplanation = {
        translation: explanationElement?.textContent ?? "",
        pos: tag_type?.textContent ?? "",
        featured: isFeatured,
        audioUrl: audioUrl,
        examples: exampleItems,
        frequencyTag: {
          tagForms: tag,
          displayType: designatedFrequency ?? wordFrequency,
        },
      };
      explanationItems.push(explanation);
    }
  }
  return explanationItems;
}

/**
 * Get linguee display type according to word frequency.
 */
function getExplanationDisplayType(wordFrequency: string): LingueeListItemType {
  let wordDisplayType: LingueeListItemType;
  if (wordFrequency.includes("(often used)")) {
    wordDisplayType = LingueeListItemType.OftenUsed;
  } else if (wordFrequency.includes("(almost always used)")) {
    wordDisplayType = LingueeListItemType.AlmostAlwaysUsed;
  } else if (wordFrequency.length > 0) {
    wordDisplayType = LingueeListItemType.SpecialForms;
  } else {
    wordDisplayType = LingueeListItemType.Common;
  }
  return wordDisplayType;
}

/**
 * Get tag forms text.
 */
function getTagFormsText(tagForms: Element | null): string {
  let tag_forms_text = tagForms?.textContent ?? "";

  // try remove blank (), <span class='tag_forms forms_t:pinyin'> ()</span>
  const tag_forms_trimText = tagForms?.textContent?.replace(/\(/g, "").replace(/\)/g, "").trim();
  if (!tag_forms_trimText) {
    tag_forms_text = "";
  }
  return tag_forms_text;
}

/**
 * Get example list.  | .inexact  Examples:  .lemma
 */
function getExampleList(exampleLemma: HTMLElement[] | undefined) {
  logTrace("parse", "getExampleList");
  const exampleItems: LingueeExample[] = [];
  if (exampleLemma?.length) {
    for (const lemma of exampleLemma) {
      const exampleElement = lemma.querySelector(".line .dictLink");
      const tagType = lemma.querySelector(".line .tag_type");
      const example: LingueePosText = {
        pos: tagType?.textContent ?? "",
        text: exampleElement?.textContent ?? "",
      };

      // * may have multiple translations.
      const translationElement = lemma.querySelectorAll(".lemma_content .dictLink");
      const translations: LingueePosText[] = [];
      translationElement.forEach((element) => {
        if (element.textContent) {
          const translation: LingueePosText = {
            text: element.textContent,
            pos: tagType?.textContent ?? "",
          };
          translations.push(translation);
        }
      });
      const lingueeExample: LingueeExample = {
        example: example,
        translations: translations,
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
  logTrace("parse", "getWikipedia");
  const wikipedias: LingueeWikipedia[] = [];
  if (abstractElement?.length) {
    for (const element of abstractElement as unknown as HTMLElement[]) {
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
    const sourceLanguage = sourceLang.replace(/'/g, ""); // remove "'"
    return getLanguageItemFromDeepLSourceCode(sourceLanguage).youdaoLangCode;
  }
}

/**
 * Get linguee web url.
 */
export function getLingueeWebDictionaryURL(queryWordInfo: QueryWordInfo): string | undefined {
  const { fromLanguage, toLanguage } = queryWordInfo;
  const validLanguagePair = getValidLingueeLanguagePair(fromLanguage, toLanguage);
  const isWord = checkIsWord(queryWordInfo);

  if (!validLanguagePair || !isWord) {
    return;
  }
  const sourceLanguage = getLanguageEnglishName(fromLanguage).toLowerCase();
  const lingueeUrl = `https://www.linguee.com/${validLanguagePair}/search?source=${sourceLanguage}&query=${encodeURIComponent(
    queryWordInfo.word,
  )}`;
  return lingueeUrl;
}

/**
 * Format linguee display result
 */
export function formatLingueeDisplaySections(lingueeTypeResult: QueryTypeResult): DisplaySection[] {
  const displayResults: DisplaySection[] = [];
  if (!lingueeTypeResult.result) {
    return displayResults;
  }

  const { queryWordInfo, wordItems, examples, relatedWords, wikipedias } =
    lingueeTypeResult.result as LingueeDictionaryResult;
  const lingueeType = DictionaryType.Linguee;

  // add a Linguee flag section
  const word = queryWordInfo.word;
  let translation = word;
  if (wordItems.length > 0) {
    const translations = wordItems[0].translationItems;
    if (translations.length > 0) {
      translation = translations[0].translation;
    }
  }

  const copyText = `${translation} ${word}`;
  const displayType = LingueeListItemType.Translation;
  const lingueeTitleSection: DisplaySection = {
    type: LingueeListItemType.Translation,
    sectionTitle: lingueeType,
    items: [
      {
        key: copyText,
        title: translation,
        subtitle: word,
        copyText: copyText,
        displayCategory: "dictionary",
        displayType: displayType,
        queryType: lingueeType,
        queryWordInfo: queryWordInfo,
        tooltip: displayType,
      },
    ],
  };
  displayResults.push(lingueeTitleSection);

  if (wordItems.length) {
    for (const wordItem of wordItems) {
      // check if placeholder end with .
      const checkIfEndsWithDot = wordItem.placeholder.endsWith("."); // "good at"
      let wordPos = `  ${wordItem.pos}`;
      if (wordItem.pos && !checkIfEndsWithDot) {
        wordPos = `.${wordPos}`;
      }
      const placeholderText = wordItem.placeholder ? ` ${wordItem.placeholder}` : "";
      const sectionTitle = `${wordItem.word}${placeholderText}${wordPos}`;
      const displayItems: ListDisplayItem[] = [];
      if (wordItem.translationItems) {
        for (const explanationItem of wordItem.translationItems) {
          // 1. iterate featured explanation
          if (explanationItem.featured) {
            const title = `${explanationItem.translation}`;
            const isCommon = explanationItem.frequencyTag.displayType === LingueeListItemType.Common;
            const tagText = isCommon ? "" : `  ${explanationItem.frequencyTag.tagForms}`;
            let translation = "";
            if (explanationItem.examples.length) {
              translation = explanationItem.examples[0].translations[0].text;
            }
            let pos = explanationItem.pos;
            if (pos && (tagText || translation)) {
              pos = `${pos}.`;
            }
            const subtitle = `${pos}${tagText}       ${translation}`;
            const copyText = `${title} ${subtitle}`;
            const displayType = explanationItem.frequencyTag.displayType;
            const displayItem: ListDisplayItem = {
              key: copyText,
              title: title,
              subtitle: subtitle,
              copyText: copyText,
              queryWordInfo: queryWordInfo,
              displayCategory: "dictionary",
              displayType: displayType,
              queryType: lingueeType,
              tooltip: displayType,
            };
            displayItems.push(displayItem);
          }
        }

        // 2. iterate unfeatured explanation, and put them to array
        const unfeaturedExplanations: string[] = [];
        if (wordItem.translationItems) {
          for (const explanationItem of wordItem.translationItems) {
            if (!explanationItem.featured) {
              const explanation = `${explanationItem.translation}`;
              unfeaturedExplanations.push(explanation);
            }
          }
        }
        if (unfeaturedExplanations.length > 0) {
          const lastExplanationItem = wordItem.translationItems.at(-1);
          const pos = lastExplanationItem?.pos ? `${lastExplanationItem.pos}.` : "";
          const subtitleText = unfeaturedExplanations.join(";  ");
          const copyText = `${pos} ${subtitleText}`;
          const lessCommonNote =
            lastExplanationItem?.frequencyTag.displayType === LingueeListItemType.LessCommon
              ? `(${LingueeListItemType.LessCommon})`
              : "";
          const displayType =
            lessCommonNote.length > 0 ? LingueeListItemType.LessCommon : LingueeListItemType.Unfeatured;
          const unFeaturedDisplayItem: ListDisplayItem = {
            key: copyText,
            title: pos,
            subtitle: `${subtitleText}  ${lessCommonNote.toLowerCase()}`,
            copyText: copyText,
            queryWordInfo: queryWordInfo,
            displayCategory: "dictionary",
            displayType: displayType,
            queryType: lingueeType,
            tooltip: displayType,
          };
          displayItems.push(unFeaturedDisplayItem);
        }
      }
      const displayResult: DisplaySection = {
        type: LingueeListItemType.Common,
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
      const title = `${example.example.text}`;
      const pos = example.example.pos ? `${example.example.pos}.  ` : "";
      const translations = example.translations.map((translation) => `${translation.text}`).join(";  ");
      const subtitle = `${pos}—  ${translations}`;
      const copyText = `${title} ${subtitle}`;
      const displayItem: ListDisplayItem = {
        key: copyText,
        title: title,
        subtitle: subtitle,
        copyText: copyText,
        queryWordInfo: queryWordInfo,
        displayCategory: "dictionary",
        displayType: displayType,
        queryType: lingueeType,
        tooltip: displayType,
      };
      return displayItem;
    });
    const exampleSection: DisplaySection = {
      type: LingueeListItemType.Example,
      sectionTitle: sectionTitle,
      items: displayItems.slice(0, 3), // show up to 3 examples.
    };
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
        displayCategory: "dictionary",
        displayType: displayType,
        queryType: lingueeType,
        tooltip: displayType,
      };
      return displayItem;
    });

    const displayResult: DisplaySection = {
      type: LingueeListItemType.RelatedWord,
      sectionTitle: sectionTitle,
      items: displayItems.slice(0, 3), // only show 3 related words
    };
    displayResults.push(displayResult);
  }

  // 5. iterate wikipedia
  if (wikipedias) {
    const sectionTitle = "Wikipedia";
    const displayItems = wikipedias.map((wikipedia) => {
      const displayType = LingueeListItemType.Wikipedia;
      const title = `${wikipedia.title}`;
      const subtitle = `${wikipedia.explanation}`;
      const copyText = `${title} ${subtitle}`;
      const displayItem: ListDisplayItem = {
        key: copyText,
        title: copyText,
        copyText: copyText,
        queryWordInfo: queryWordInfo,
        displayCategory: "dictionary",
        displayType: displayType,
        queryType: lingueeType,
        tooltip: displayType,
      };
      return displayItem;
    });
    const displayResult: DisplaySection = {
      type: LingueeListItemType.Wikipedia,
      sectionTitle: sectionTitle,
      items: displayItems,
    };
    displayResults.push(displayResult);
  }

  return displayResults;
}
