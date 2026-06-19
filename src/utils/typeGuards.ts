/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LingueeListItemType } from "@/providers/dictionary/linguee/types";
import { YoudaoDictionaryListItemType } from "@/providers/dictionary/youdao/types";
import { DictionaryType, TranslationType } from "@/types/api";
import type { ListDisplayItem } from "@/types/display";
import { QueryType } from "@/types/query";

import { checkIsTranslationType } from "./text";

/**
 * Factory: create a type guard that checks both queryType and displayType.
 */
function createListItemTypeGuard<T extends string>(
  queryTypeCheck: (queryType: QueryType) => boolean,
  displayTypeValues: readonly T[],
) {
  const displayTypeSet = new Set(displayTypeValues);
  return (listItem: ListDisplayItem): listItem is ListDisplayItem & { displayType: T } =>
    queryTypeCheck(listItem.queryType) && displayTypeSet.has(listItem.displayType as T);
}

/**
 * Check if list item is a Youdao dictionary item.
 */
export const checkIsYoudaoDictionaryListItem = createListItemTypeGuard(
  (qt) => qt === DictionaryType.Youdao,
  Object.values(YoudaoDictionaryListItemType),
);

/**
 * Check if list item is a Linguee dictionary item.
 */
export const checkIsLingueeListItem = createListItemTypeGuard(
  (qt) => qt === DictionaryType.Linguee,
  Object.values(LingueeListItemType),
);

/**
 * Check if list item is a translation item.
 */
export const checkIsTranslationListItem = createListItemTypeGuard(
  checkIsTranslationType,
  Object.values(TranslationType),
);
