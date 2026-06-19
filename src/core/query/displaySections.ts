/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { TranslationItem, TranslationType } from "@/types/api";
import type { DisplaySection } from "@/types/display";
import type { QueryType, QueryTypeResult } from "@/types/query";
import { checkIsDictionaryType, checkIsTranslationType } from "@/utils/text";

import type { QueryState } from "./queryReducer";
import { getFromToLanguageTitle, getTranslationMarkdown } from "./utils";

export function computeDisplaySections(state: QueryState): DisplaySection[] {
  const { queryResults, isShowDetail } = state;

  const translations: TranslationItem[] = [];
  for (const qr of queryResults) {
    if (qr.hideDisplay) continue;
    if (qr.sourceResult && checkIsTranslationType(qr.type)) {
      const markdown = getTranslationMarkdown(qr.sourceResult);
      translations.push({ type: qr.sourceResult.type as TranslationType, text: markdown });
    }
  }

  let isPreviousSectionTranslationType = false;
  const displaySections: DisplaySection[] = [];

  for (const queryResult of queryResults) {
    if (queryResult.hideDisplay || !queryResult.displaySections?.length) continue;

    const { type, sourceResult } = queryResult;
    const isDict = checkIsDictionaryType(type);
    const isTrans = checkIsTranslationType(type);

    for (const section of queryResult.displaySections) {
      let sectionTitle = `${sourceResult?.type ?? type}`;
      if (sourceResult) {
        const wordInfo = sourceResult.queryWordInfo;
        const fromTo = getFromToLanguageTitle(wordInfo.fromLanguage, wordInfo.toLanguage, isShowDetail);
        if (isTrans) {
          sectionTitle = isPreviousSectionTranslationType ? sectionTitle : `${sectionTitle}   (${fromTo})`;
          isPreviousSectionTranslationType = true;
        } else if (isDict) {
          sectionTitle = `${sectionTitle}   (${fromTo})`;
          isPreviousSectionTranslationType = false;
        } else {
          isPreviousSectionTranslationType = false;
        }
      }

      const detailsMarkdown =
        isTrans && sourceResult
          ? buildDetailMarkdown(translations, type, sourceResult)
          : section.items?.[0]?.detailsMarkdown;

      displaySections.push({
        ...section,
        sectionTitle,
        items: section.items?.map((item, idx) => (idx === 0 ? { ...item, detailsMarkdown } : item)),
      });
    }
  }

  return displaySections;
}

/**
 * Build detail markdown for translation type. Puts current type's translation first.
 */
function buildDetailMarkdown(
  translations: TranslationItem[],
  currentType: QueryType,
  sourceResult: QueryTypeResult,
): string {
  const sorted = [...translations];
  const idx = sorted.findIndex((t) => t.type === sourceResult.type);
  if (idx > 0) {
    const [item] = sorted.splice(idx, 1);
    sorted.unshift(item);
  }
  return sorted.map((t) => t.text).join("\n");
}
