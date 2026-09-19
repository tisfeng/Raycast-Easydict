/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DictionaryContent, TranslationContent } from "@/core/content/types";

import type {
  AIDictionaryListItemType,
  DictionaryType,
  LingueeListItemType,
  TranslationType,
  YoudaoDictionaryListItemType,
} from "./kinds";

export const PROVIDER_ICON_NAMES = [
  "openai",
  "gemini",
  "deepseek",
  "openrouter",
  "siliconflow",
  "zhipu",
  "kimi",
  "minimax",
  "mimo",
  "raycast",
] as const;

export type ProviderIconName = (typeof PROVIDER_ICON_NAMES)[number];

export type ProviderIconConfig =
  | { kind: "preset"; name: ProviderIconName }
  | { kind: "remote"; url: string }
  | { kind: "favicon"; website?: string }
  | { kind: "initials" };

/**
 * Runtime execution options for a query.
 * Passed separately from the data payload (QueryInput).
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StreamChunk {
  content: string;
}

export interface QueryInput {
  readonly word: string;
  readonly fromLanguage: string; // ! must be Youdao language id.
  readonly toLanguage: string;
  readonly isWord?: boolean; // * Dictionary Type should has value, show web url need this value.
}

export interface QueryWordInfo extends QueryInput {
  readonly phonetic?: string; // [ɡʊd]
  readonly examTypes?: readonly string[];
  readonly speechUrl?: string; // word audio url. some language not have tts url, such as "ຂາດ"
}

export type QueryType = TranslationType | DictionaryType;

export interface RuntimeServiceConfig {
  id: string;
  label: string;
  providerKey: string;
  order: number;
  icon?: ProviderIconConfig;
  /** Stable fingerprint of request-affecting configuration. Used only as input to a hashed cache key. */
  cacheIdentity?: string;
}

export interface RuntimeServiceMetadata {
  serviceId: string;
  serviceLabel: string;
  serviceOrder: number;
  serviceIcon?: ProviderIconConfig;
}

export interface TranslationResult {
  readonly type: TranslationType;
  readonly content: TranslationContent;
}

export interface DictionaryResult {
  readonly type: DictionaryType;
  readonly content: DictionaryContent;
}

export type ProviderResult = TranslationResult | DictionaryResult;

export type QueryResult = ProviderResult & RuntimeServiceMetadata & { readonly fromCache?: boolean };

export type DictionaryDisplayType = AIDictionaryListItemType | LingueeListItemType | YoudaoDictionaryListItemType;

export interface DisplaySection {
  serviceId?: string;
  type: DictionaryDisplayType | TranslationType;
  sectionTitle?: string;
  items: ListDisplayItem[];
}

interface ListDisplayItemBase {
  serviceId?: string;
  serviceLabel?: string;
  serviceIcon?: ProviderIconConfig;
  queryType: QueryType;
  queryWordInfo: QueryWordInfo;
  key: string;
  title: string;
  subtitle?: string;
  copyText: string;
  tooltip?: string;
  detailsMarkdown?: string;
  accessoryItem?: ListAccessoryItem;
  fromCache?: boolean;
}

export type ListDisplayItem = ListDisplayItemBase &
  (
    | { queryType: DictionaryType.Linguee; displayType: LingueeListItemType }
    | { queryType: DictionaryType.Youdao; displayType: YoudaoDictionaryListItemType }
    | { queryType: DictionaryType.AI; displayType: AIDictionaryListItemType }
    | { queryType: TranslationType; displayType?: never }
  );

export interface ListAccessoryItem {
  phonetic?: string;
  readonly examTypes?: readonly string[];
  example?: string;
}
