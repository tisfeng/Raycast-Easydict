/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { composeContent, type ComposedService } from "@/core/content/compose";
import { legacyDictionarySections } from "@/core/content/legacyDictionary";
import type { PrimarySupplement } from "@/core/content/types";
import { lookupLanguageItem } from "@/core/language/utils";
import { TranslationType } from "@/core/results/kinds";
import { resultItemBody, translationResultsMarkdown } from "@/core/results/resultMarkdown";
import type {
  DisplaySection,
  ListDisplayItem,
  QueryResult,
  QueryWordInfo,
  TranslationResult,
} from "@/core/results/types";

type DisplayPreferences = Pick<
  Preferences,
  "enableDeepLTranslate" | "enableYoudaoDictionary" | "enableYoudaoTranslate" | "flagsAreNotLanguages"
>;

/** Temporary outgoing bridge for the UI and favorites consumers that still use display sections. */
export function projectQueryResults(
  queryResults: readonly QueryResult[],
  preferences: DisplayPreferences,
): { displaySections: DisplaySection[]; isShowDetail: boolean; hasVisibleItems: boolean } {
  const { services, isShowDetail } = composeContent(queryResults, preferences);
  const translations = services.filter(isTranslationService);

  let isPreviousSectionTranslationType = false;
  const displaySections: DisplaySection[] = [];

  for (const service of services) {
    const { serviceId, serviceLabel, serviceIcon } = service;
    const isTrans = isTranslationService(service);
    const sections = isTrans ? [translationSection(service)] : legacyDictionarySections(service.type, service.content);
    const translationPreview = isTrans ? buildDetailMarkdown(translations, service) : undefined;
    const fromTo = getFromToLanguageTitle(service.content.query, isShowDetail, preferences.flagsAreNotLanguages);

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
              ? supplementDictionaryItem(item, service.primarySupplement)
              : item;
          return {
            ...displayedItem,
            serviceId,
            serviceLabel,
            serviceIcon,
            fromCache: service.fromCache,
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

function isTranslationService(service: ComposedService): service is ComposedService & TranslationResult {
  return service.content.kind === "translation";
}

function translationSection(result: ComposedService & TranslationResult): DisplaySection {
  const { type, serviceId, content } = result;
  const title = content.paragraphs.join(", ");
  const isStreamingProvider = type === TranslationType.OpenAI || type === TranslationType.Gemini;
  return {
    type,
    items: [
      {
        queryType: type,
        queryWordInfo: content.query,
        key: isStreamingProvider ? serviceId : `${serviceId}:${title}`,
        title,
        copyText: content.paragraphs.join("\n"),
      },
    ],
  };
}

function supplementDictionaryItem(item: ListDisplayItem, supplement: PrimarySupplement | undefined): ListDisplayItem {
  const text = supplement?.translation;
  if (text) {
    // Non-translation dictionary entries may use this body instead of deriving it from their title.
    const detailsMarkdown = item.subtitle
      ? item.subtitle.startsWith(text)
        ? item.subtitle
        : `${text} ${item.subtitle}`
      : text;
    item = { ...item, title: text, copyText: text, detailsMarkdown };
  }
  if (supplement?.phonetic || supplement?.examTypes?.length) {
    item = {
      ...item,
      accessoryItem: {
        ...item.accessoryItem,
        phonetic: supplement.phonetic,
        examTypes: supplement.examTypes ? [...supplement.examTypes] : undefined,
      },
    };
  }
  return item;
}

function getFromToLanguageTitle(info: QueryWordInfo, onlyEmoji: boolean, flagsAreNotLanguages: boolean): string {
  const from = lookupLanguageItem(info.fromLanguage);
  const to = lookupLanguageItem(info.toLanguage);
  const fromName = from?.langEnglishName ?? info.fromLanguage;
  const toName = to?.langEnglishName ?? info.toLanguage;
  const fromEmoji = from?.emoji ?? "🌐";
  const toEmoji = to?.emoji ?? "🌐";
  if (flagsAreNotLanguages) return `${fromName} --> ${toName}`;
  return onlyEmoji ? `${fromEmoji} --> ${toEmoji}` : `${fromName}${fromEmoji} --> ${toName}${toEmoji}`;
}

/** Put the current service first in its translation comparison. */
function buildDetailMarkdown(
  translations: (ComposedService & TranslationResult)[],
  queryResult: ComposedService & TranslationResult,
): string {
  const sorted = [...translations];
  const idx = sorted.findIndex((translation) => translation.serviceId === queryResult.serviceId);
  if (idx > 0) {
    const [item] = sorted.splice(idx, 1);
    sorted.unshift(item);
  }
  return translationResultsMarkdown(
    queryResult.content.query,
    sorted.map((result) => ({
      label: result.serviceLabel,
      text: result.content.paragraphs.join("\n"),
      info: result.content.query,
    })),
  );
}
