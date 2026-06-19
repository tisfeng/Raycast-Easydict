/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { LingueeListItemType } from "@/providers/dictionary/linguee/types";
import { YoudaoDictionaryListItemType } from "@/providers/dictionary/youdao/types";

import { DictionaryType, TranslationType } from "./api";
import type { QueryWordInfo } from "./query";
import { QueryType } from "./query";
import type { QueryResponse } from "./queryResponse";

export type DictionaryDisplayType = LingueeListItemType | YoudaoDictionaryListItemType;

export interface DisplaySection {
  type: DictionaryDisplayType | TranslationType;
  sectionTitle?: string;
  items: ListDisplayItem[];
}

interface ListDisplayItemBase {
  queryType: QueryType;
  queryWordInfo: QueryWordInfo;
  key: string;
  title: string;
  subtitle?: string;
  copyText: string;
  tooltip?: string;
  speech?: string;
  detailsMarkdown?: string;
  sourceData?: QueryResponse;
  accessoryItem?: ListAccessoryItem;
}

export type ListDisplayItem = ListDisplayItemBase &
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
