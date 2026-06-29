/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { parse } from "node-html-parser";
import type { default as HtmlNode } from "node-html-parser/dist/nodes/html";

import { getLanguageEnglishName, getLanguageItemFromDeepLSourceCode } from "@/core/language/utils";
import { checkIsWord } from "@/providers/shared/utils";
import { DictionaryType } from "@/types/api";
import type { DisplaySection, ListDisplayItem } from "@/types/display";
import type { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { logWarn } from "@/utils/logger";

import { getValidLingueeLanguagePair } from "./languages";
import type {
  LingueeDictionaryResult,
  LingueeExample,
  LingueeWikipedia,
  LingueeWordExplanation,
  LingueeWordItem,
} from "./types";
import { LingueeListItemType } from "./types";

const AUDIO_URL_BASE = "https://www.linguee.com/mp3";
const MAX_EXAMPLES = 3;
const MAX_RELATED_WORDS = 3;

function createDisplayItem(
  queryWordInfo: QueryWordInfo,
  displayType: LingueeListItemType,
  title: string,
  subtitle: string,
): ListDisplayItem {
  const copyText = `${title} ${subtitle}`;
  return {
    key: copyText,
    title,
    subtitle,
    copyText,
    queryWordInfo,
    displayCategory: "dictionary",
    displayType,
    queryType: DictionaryType.Linguee,
    tooltip: displayType,
    detailsMarkdown: copyText,
  };
}

function getAudioUrl(element: HtmlNode | null, selector: string): string {
  const id = element?.querySelector(selector)?.getAttribute("id");
  return id ? `${AUDIO_URL_BASE}/${id}.mp3` : "";
}

function getTagFormsText(tagForms: HtmlNode | null): string {
  const text = tagForms?.textContent ?? "";
  const stripped = text.replace(/[()]/g, "").trim();
  return stripped ? text : "";
}

function getExplanationDisplayType(wordFrequency: string): LingueeListItemType {
  if (wordFrequency.includes("(often used)")) return LingueeListItemType.OftenUsed;
  if (wordFrequency.includes("(almost always used)")) return LingueeListItemType.AlmostAlwaysUsed;
  if (wordFrequency.length > 0) return LingueeListItemType.SpecialForms;
  return LingueeListItemType.Common;
}

function getYoudaoLanguageId(language: string, rootElement: HtmlNode): string | undefined {
  const textJavascript = rootElement.querySelector("script[type=text/javascript]");
  const sourceLang = textJavascript?.textContent?.split(`${language}:`)[1]?.split(",")[0];
  if (!sourceLang) return undefined;
  return getLanguageItemFromDeepLSourceCode(sourceLang.replace(/'/g, "")).youdaoLangCode;
}

function partitionFeatured(items: LingueeWordExplanation[]): [LingueeWordExplanation[], LingueeWordExplanation[]] {
  const featured: LingueeWordExplanation[] = [];
  const unfeatured: LingueeWordExplanation[] = [];
  for (const item of items) {
    (item.featured ? featured : unfeatured).push(item);
  }
  return [featured, unfeatured];
}

function parseExamples(examples: HtmlNode[]): LingueeExample[] {
  if (!examples?.length) return [];
  return examples.map((example) => ({
    example: { text: example?.querySelector(".tag_s")?.textContent ?? "", pos: "" },
    translations: [{ text: example?.querySelector(".tag_t")?.textContent ?? "", pos: "" }],
  }));
}

function parseExplanation(
  translation: HtmlNode,
  isFeatured: boolean,
  designatedFrequency?: LingueeListItemType,
): LingueeWordExplanation {
  const tagC = translation.querySelector(".tag_c");
  const tagForms = translation.querySelector(".tag_forms");
  const tagText = `${tagC?.textContent ?? ""} ${getTagFormsText(tagForms)}`.trim();

  return {
    translation: translation.querySelector(".dictLink")?.textContent ?? "",
    pos: translation.querySelector(".tag_type")?.textContent ?? "",
    featured: isFeatured,
    audioUrl: getAudioUrl(translation, ".audio"),
    examples: parseExamples(translation.querySelectorAll(".example")),
    frequencyTag: { tagForms: tagText, displayType: designatedFrequency ?? getExplanationDisplayType(tagText) },
  };
}

function parseExplanations(
  translations: HtmlNode[] | undefined,
  isFeatured: boolean,
  designatedFrequency?: LingueeListItemType,
): LingueeWordExplanation[] {
  if (!translations?.length) return [];
  return translations.map((t) => parseExplanation(t, isFeatured, designatedFrequency));
}

function parseWordItem(lemma: HtmlNode): LingueeWordItem {
  const placeholder = lemma.querySelector(".dictLink .placeholder");
  let placeholderText = placeholder?.textContent ?? "";
  placeholder?.remove();

  const dictLinks = lemma.querySelectorAll(".lemma_desc .dictLink");
  const words = dictLinks.map((link) => link?.textContent ?? "").join(" ");

  const tagLemma = lemma.querySelector(".tag_lemma");
  const tagLemmaContext = lemma.querySelector(".tag_lemma_context");
  if (tagLemmaContext) {
    placeholderText = tagLemmaContext.textContent ?? "";
  }

  const tagWordtype = lemma.querySelector(".lemma_desc .tag_wordtype");
  const tagFormsText = getTagFormsText(lemma.querySelector(".lemma_desc .tag_forms"));
  const tagArea = lemma.querySelector(".lemma_desc .tag_area");
  const posText = `${tagWordtype?.textContent ?? ""} ${tagFormsText} ${tagArea?.textContent ?? ""}`.trim();
  const pos = tagWordtype ? posText : (lemma.querySelector(".tag_type")?.textContent ?? "");
  const featured = lemma.getAttribute("class")?.includes("featured") ?? false;

  const featuredTranslations = lemma.querySelectorAll(".translation.sortablemg.featured");
  const explanations = parseExplanations(featuredTranslations, true);
  featuredTranslations.forEach((el) => el.remove());

  const lemmaContent = lemma.querySelector(".lemma_content");
  const isLessCommon = !!lemmaContent?.querySelector(".line .notascommon");
  const frequency = isLessCommon ? LingueeListItemType.LessCommon : LingueeListItemType.Common;
  const lessCommonTranslations = lemmaContent?.querySelectorAll(".translation");
  const lessCommonExplanations = parseExplanations(lessCommonTranslations, false, frequency);

  return {
    word: words,
    title: tagLemma?.textContent ?? "",
    featured,
    pos,
    placeholder: placeholderText,
    translationItems: [...explanations, ...lessCommonExplanations],
    audioUrl: getAudioUrl(tagLemma, ".audio"),
  };
}

function parseWordItems(lemmas: HtmlNode[] | undefined): LingueeWordItem[] {
  if (!lemmas?.length) return [];
  return lemmas.map(parseWordItem);
}

function parseExampleItems(lemmas: HtmlNode[] | undefined): LingueeExample[] {
  if (!lemmas?.length) return [];
  return lemmas.map((lemma) => {
    const tagType = lemma.querySelector(".line .tag_type");
    const pos = tagType?.textContent ?? "";
    return {
      example: { text: lemma.querySelector(".line .dictLink")?.textContent ?? "", pos },
      translations: lemma
        .querySelectorAll(".lemma_content .dictLink")
        .filter((el) => el.textContent)
        .map((el) => ({ text: el.textContent, pos })),
    };
  });
}

function parseWikipediaItems(elements: HtmlNode[] | undefined): LingueeWikipedia[] {
  if (!elements?.length) return [];
  return elements.map((element) => {
    const h2Title = element.querySelector("h2");
    return {
      title: h2Title?.textContent ?? "",
      explanation: h2Title?.nextSibling?.textContent?.trim() ?? "",
      source: element.querySelector(".source_url_spacer")?.textContent ?? "",
      sourceUrl: element.querySelector("a")?.getAttribute("href") ?? "",
    };
  });
}

function buildTitleSection(queryWordInfo: QueryWordInfo, wordItems: LingueeWordItem[]): DisplaySection {
  const word = queryWordInfo.word;
  const translation = wordItems[0]?.translationItems[0]?.translation ?? word;
  return {
    type: LingueeListItemType.Translation,
    sectionTitle: DictionaryType.Linguee,
    items: [createDisplayItem(queryWordInfo, LingueeListItemType.Translation, translation, word)],
  };
}

function buildFeaturedExplanationItems(
  queryWordInfo: QueryWordInfo,
  explanations: LingueeWordExplanation[],
): ListDisplayItem[] {
  return explanations
    .filter((item) => item.featured)
    .map((item) => {
      const isCommon = item.frequencyTag.displayType === LingueeListItemType.Common;
      const tagText = isCommon ? "" : `  ${item.frequencyTag.tagForms}`;
      const exampleTranslation = item.examples[0]?.translations[0]?.text ?? "";
      let pos = item.pos;
      if (pos && (tagText || exampleTranslation)) {
        pos = `${pos}.`;
      }
      const subtitle = `${pos}${tagText}       ${exampleTranslation}`;
      return createDisplayItem(queryWordInfo, item.frequencyTag.displayType, item.translation, subtitle);
    });
}

function buildUnfeaturedExplanationItem(
  queryWordInfo: QueryWordInfo,
  unfeatured: LingueeWordExplanation[],
): ListDisplayItem | undefined {
  if (unfeatured.length === 0) return undefined;
  const lastItem = unfeatured.at(-1)!;
  const pos = lastItem.pos ? `${lastItem.pos}.` : "";
  const subtitleText = unfeatured.map((item) => item.translation).join(";  ");
  const isLessCommon = lastItem.frequencyTag.displayType === LingueeListItemType.LessCommon;
  const lessCommonNote = isLessCommon ? `(${LingueeListItemType.LessCommon})` : "";
  const displayType = isLessCommon ? LingueeListItemType.LessCommon : LingueeListItemType.Unfeatured;
  return createDisplayItem(queryWordInfo, displayType, pos, `${subtitleText}  ${lessCommonNote.toLowerCase()}`);
}

function buildWordItemSections(queryWordInfo: QueryWordInfo, wordItems: LingueeWordItem[]): DisplaySection[] {
  return wordItems.map((wordItem) => {
    const endsWithDot = wordItem.placeholder.endsWith(".");
    const wordPos = wordItem.pos ? (endsWithDot ? `  ${wordItem.pos}` : `.${wordItem.pos}`) : "";
    const placeholderText = wordItem.placeholder ? ` ${wordItem.placeholder}` : "";
    const sectionTitle = `${wordItem.word}${placeholderText}${wordPos}`;

    const [featured, unfeatured] = partitionFeatured(wordItem.translationItems ?? []);
    const featuredItems = buildFeaturedExplanationItems(queryWordInfo, featured);
    const unfeaturedItem = buildUnfeaturedExplanationItem(queryWordInfo, unfeatured);

    return {
      type: LingueeListItemType.Common,
      sectionTitle,
      items: unfeaturedItem ? [...featuredItems, unfeaturedItem] : featuredItems,
    };
  });
}

function buildExampleSection(queryWordInfo: QueryWordInfo, examples: LingueeExample[]): DisplaySection | undefined {
  if (!examples?.length) return undefined;
  const items = examples.slice(0, MAX_EXAMPLES).map((example) => {
    const pos = example.example.pos ? `${example.example.pos}.  ` : "";
    const translations = example.translations.map((t) => t.text).join(";  ");
    return createDisplayItem(
      queryWordInfo,
      LingueeListItemType.Example,
      example.example.text,
      `${pos}—  ${translations}`,
    );
  });
  return { type: LingueeListItemType.Example, sectionTitle: "Examples:", items };
}

function buildRelatedWordSection(
  queryWordInfo: QueryWordInfo,
  relatedWords: LingueeWordItem[],
): DisplaySection | undefined {
  if (!relatedWords?.length) return undefined;
  const items = relatedWords.slice(0, MAX_RELATED_WORDS).map((word) => {
    const explanations =
      word.translationItems?.map((item) => item.translation).join(";  ") ?? `${word.placeholder} ${word.pos}`;
    const pos = word.pos ? `${word.pos}.  ` : "";
    return createDisplayItem(queryWordInfo, LingueeListItemType.RelatedWord, word.word, `${pos}${explanations}`);
  });
  return { type: LingueeListItemType.RelatedWord, sectionTitle: "Related words:", items };
}

function buildWikipediaSection(
  queryWordInfo: QueryWordInfo,
  wikipedias: LingueeWikipedia[],
): DisplaySection | undefined {
  if (!wikipedias?.length) return undefined;
  const items = wikipedias.map((wiki) => {
    const text = `${wiki.title} ${wiki.explanation}`;
    return createDisplayItem(queryWordInfo, LingueeListItemType.Wikipedia, text, "");
  });
  return { type: LingueeListItemType.Wikipedia, sectionTitle: "Wikipedia", items };
}

export function parseLingueeHTML(html: string): QueryTypeResult {
  const root = parse(html);
  const dictionary = root.querySelector("#dictionary");
  const exactLemmas = dictionary?.querySelectorAll(".exact .lemma");

  const queryWord = root.querySelector(".l_deepl_ad__querytext");
  const sourceLanguage = getYoudaoLanguageId("sourceLang", root);
  const targetLanguage = getYoudaoLanguageId("targetLang", root);

  const wordItems = parseWordItems(exactLemmas);

  // Split inexact elements into examples vs related words by h3 label
  let examplesElement: HtmlNode[] | undefined;
  let relatedWordsElement: HtmlNode[] | undefined;
  for (const element of dictionary?.querySelectorAll(".inexact") ?? []) {
    const h3Text = element.querySelector("h3")?.textContent;
    const lemmas = element.querySelectorAll(".lemma");
    if (h3Text === "Examples:") {
      examplesElement = lemmas;
      continue;
    }
    if (h3Text === "See also:") {
      relatedWordsElement = lemmas;
      continue;
    }
  }

  const examples = parseExampleItems(examplesElement);
  const relatedWords = parseWordItems(relatedWordsElement);
  const wikipedias = parseWikipediaItems(dictionary?.querySelectorAll(".wikipedia .abstract"));

  const queryWordInfo: QueryWordInfo = {
    word: queryWord?.textContent ?? "",
    fromLanguage: sourceLanguage ?? "",
    toLanguage: targetLanguage ?? "",
    speechUrl: wordItems[0]?.audioUrl ?? "",
  };

  const hasEntries = wordItems.length > 0 || examples.length > 0 || relatedWords.length > 0 || wikipedias.length > 0;
  if (!hasEntries) {
    logWarn("LingueeParse", "no entries found in Linguee dictionary");
  }

  queryWordInfo.hasDictionaryEntries = hasEntries;
  queryWordInfo.isWord = hasEntries;

  return {
    type: DictionaryType.Linguee,
    result: hasEntries ? { queryWordInfo, wordItems, examples, relatedWords, wikipedias } : undefined,
    translations: [],
    queryWordInfo,
  };
}

export function formatLingueeDisplaySections(lingueeTypeResult: QueryTypeResult): DisplaySection[] {
  if (!lingueeTypeResult.result) return [];

  const { queryWordInfo, wordItems, examples, relatedWords, wikipedias } =
    lingueeTypeResult.result as LingueeDictionaryResult;

  return [
    buildTitleSection(queryWordInfo, wordItems),
    ...buildWordItemSections(queryWordInfo, wordItems),
    buildExampleSection(queryWordInfo, examples),
    buildRelatedWordSection(queryWordInfo, relatedWords),
    buildWikipediaSection(queryWordInfo, wikipedias),
  ].filter((section): section is DisplaySection => section !== undefined);
}

export function getLingueeWebDictionaryURL(queryWordInfo: QueryWordInfo): string | undefined {
  const { fromLanguage, toLanguage } = queryWordInfo;
  const validLanguagePair = getValidLingueeLanguagePair(fromLanguage, toLanguage);
  const isWord = checkIsWord(queryWordInfo);

  if (!validLanguagePair || !isWord) return undefined;

  const sourceLanguage = getLanguageEnglishName(fromLanguage).toLowerCase();
  return `https://www.linguee.com/${validLanguagePair}/search?source=${sourceLanguage}&query=${encodeURIComponent(queryWordInfo.word)}`;
}
