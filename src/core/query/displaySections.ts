/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { chineseLanguageItem } from "@/core/language/consts";
import {
  getLanguageItem,
  maxLineLengthOfChineseTextDisplay,
  maxLineLengthOfEnglishTextDisplay,
} from "@/core/language/utils";
import { DictionaryType, TranslationType } from "@/core/results/kinds";
import { resultItemBody, translationResultsMarkdown } from "@/core/results/resultMarkdown";
import type {
  DisplaySection,
  ListDisplayItem,
  QueryResult,
  QueryWordInfo,
  TranslationQueryResult,
} from "@/core/results/types";

type DisplayPreferences = Pick<
  Preferences,
  "enableDeepLTranslate" | "enableYoudaoDictionary" | "enableYoudaoTranslate" | "flagsAreNotLanguages"
>;

/** Project current provider results without retaining cross-service supplements in query state or caches. */
export function projectQueryResults(
  queryResults: readonly QueryResult[],
  preferences: DisplayPreferences,
): { displaySections: DisplaySection[]; isShowDetail: boolean; hasVisibleItems: boolean } {
  const translations = queryResults.filter((result) => "translations" in result);
  const visibleTranslations = translations.filter((result) => !isHiddenTranslation(result.type, preferences));
  const deepLText = translations.find((result) => result.type === TranslationType.DeepL)?.translations.join(", ");
  const youdaoText = translations.find((result) => result.type === TranslationType.Youdao)?.translations.join(", ");
  const youdaoInfo = queryResults.find((result) => result.type === DictionaryType.Youdao)?.queryWordInfo;
  const isShowDetail =
    translations.length === queryResults.length &&
    translations.some((result) => {
      const limit =
        result.queryWordInfo.toLanguage === chineseLanguageItem.youdaoLangCode
          ? maxLineLengthOfChineseTextDisplay
          : maxLineLengthOfEnglishTextDisplay;
      return result.translations.join(", ").length > limit;
    });

  let isPreviousSectionTranslationType = false;
  const displaySections: DisplaySection[] = [];

  for (const queryResult of queryResults) {
    if ("translations" in queryResult && isHiddenTranslation(queryResult.type, preferences)) continue;

    const { serviceId, serviceLabel, serviceIcon } = queryResult;
    const isTrans = "translations" in queryResult;
    const sections = isTrans ? [translationSection(queryResult)] : queryResult.displaySections;
    const translationPreview = isTrans ? buildDetailMarkdown(visibleTranslations, queryResult) : undefined;
    const supplementalText =
      queryResult.type === DictionaryType.Linguee
        ? deepLText
        : queryResult.type === DictionaryType.Youdao && sections.length >= 2
          ? youdaoText
          : undefined;
    const supplementalInfo = queryResult.type === DictionaryType.Linguee ? youdaoInfo : undefined;
    const fromTo = getFromToLanguageTitle(queryResult.queryWordInfo, isShowDetail, preferences.flagsAreNotLanguages);

    for (const [sectionIndex, section] of sections.entries()) {
      let sectionTitle: string | undefined = serviceLabel;
      if (isTrans) {
        sectionTitle = isPreviousSectionTranslationType ? sectionTitle : `${sectionTitle}   (${fromTo})`;
        isPreviousSectionTranslationType = true;
      } else {
        sectionTitle = sectionIndex === 0 ? `${sectionTitle}   (${fromTo})` : section.sectionTitle;
        isPreviousSectionTranslationType = false;
      }

      displaySections.push({
        ...section,
        serviceId,
        sectionTitle,
        items: section.items.map((item, itemIndex) => {
          const displayedItem =
            !isTrans && sectionIndex === 0 && itemIndex === 0
              ? supplementDictionaryItem(item, supplementalText, supplementalInfo)
              : item;
          return {
            ...displayedItem,
            serviceId,
            serviceLabel,
            serviceIcon,
            fromCache: queryResult.fromCache,
            detailsMarkdown: isTrans ? translationPreview : resultItemBody(displayedItem),
          };
        }),
      });
    }
  }

  return {
    displaySections,
    isShowDetail,
    hasVisibleItems: displaySections.some((section) => section.items.length > 0),
  };
}

function isHiddenTranslation(type: TranslationType, preferences: DisplayPreferences): boolean {
  return (
    (type === TranslationType.DeepL && !preferences.enableDeepLTranslate) ||
    (type === TranslationType.Youdao && preferences.enableYoudaoDictionary && !preferences.enableYoudaoTranslate)
  );
}

function translationSection(result: TranslationQueryResult): DisplaySection {
  const { type, serviceId, translations, queryWordInfo } = result;
  const title = translations.join(", ");
  const isStreamingProvider = type === TranslationType.OpenAI || type === TranslationType.Gemini;
  return {
    type,
    items: [
      {
        queryType: type,
        queryWordInfo,
        key: isStreamingProvider ? serviceId : `${serviceId}:${title}`,
        title,
        copyText: translations.join("\n"),
      },
    ],
  };
}

function supplementDictionaryItem(
  item: ListDisplayItem,
  text: string | undefined,
  info: QueryWordInfo | undefined,
): ListDisplayItem {
  if (text) {
    // Non-translation dictionary entries may use this body instead of deriving it from their title.
    const detailsMarkdown = item.subtitle
      ? item.subtitle.startsWith(text)
        ? item.subtitle
        : `${text} ${item.subtitle}`
      : text;
    item = { ...item, title: text, copyText: text, detailsMarkdown };
  }
  if (info?.phonetic || info?.examTypes?.length) {
    item = { ...item, accessoryItem: { ...item.accessoryItem, phonetic: info.phonetic, examTypes: info.examTypes } };
  }
  return item;
}

function getFromToLanguageTitle(info: QueryWordInfo, onlyEmoji: boolean, flagsAreNotLanguages: boolean): string {
  const from = getLanguageItem(info.fromLanguage);
  const to = getLanguageItem(info.toLanguage);
  if (flagsAreNotLanguages) return `${from.langEnglishName} --> ${to.langEnglishName}`;
  return onlyEmoji
    ? `${from.emoji} --> ${to.emoji}`
    : `${from.langEnglishName}${from.emoji} --> ${to.langEnglishName}${to.emoji}`;
}

/** Put the current service first in its translation comparison. */
function buildDetailMarkdown(translations: TranslationQueryResult[], queryResult: TranslationQueryResult): string {
  const sorted = [...translations];
  const idx = sorted.findIndex((translation) => translation.serviceId === queryResult.serviceId);
  if (idx > 0) {
    const [item] = sorted.splice(idx, 1);
    sorted.unshift(item);
  }
  return translationResultsMarkdown(
    queryResult.queryWordInfo,
    sorted.map((result) => ({
      label: result.serviceLabel,
      text: result.translations.join("\n"),
      info: result.queryWordInfo,
    })),
  );
}
