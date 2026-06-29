/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { LingueeListItemType } from "@/providers/dictionary/linguee/types";
import type { YoudaoDictionaryListItemType } from "@/providers/dictionary/youdao/types";

import type { DictionaryType, TranslationType } from "./api";
import type { QueryType, QueryWordInfo } from "./query";

export type DictionaryDisplayType = LingueeListItemType | YoudaoDictionaryListItemType;

export interface DisplaySection<T = unknown> {
  type: DictionaryDisplayType | TranslationType;
  sectionTitle?: string;
  items: ListDisplayItem<T>[];
}

interface ListDisplayItemBase<T = unknown> {
  queryType: QueryType;
  queryWordInfo: QueryWordInfo;
  key: string;
  title: string;
  subtitle?: string;
  copyText: string;
  tooltip?: string;
  speech?: string;
  detailsMarkdown?: string;
  sourceData?: T;
  accessoryItem?: ListAccessoryItem;
}

export type ListDisplayItem<T = unknown> = ListDisplayItemBase<T> &
  (
    | { displayCategory: "dictionary"; queryType: DictionaryType.Linguee; displayType: LingueeListItemType }
    | { displayCategory: "dictionary"; queryType: DictionaryType.Youdao; displayType: YoudaoDictionaryListItemType }
    | { displayCategory: "translation"; queryType: TranslationType; displayType: TranslationType }
  );

export interface ListAccessoryItem {
  phonetic?: string;
  examTypes?: string[];
  example?: string;
}
