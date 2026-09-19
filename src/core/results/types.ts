/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

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
  role?: string;
}

export interface QueryInput {
  readonly word: string;
  readonly fromLanguage: string; // ! must be Youdao language id.
  readonly toLanguage: string;
  readonly isWord?: boolean; // * Dictionary Type should has value, show web url need this value.
}

export interface QueryWordInfo extends QueryInput {
  phonetic?: string; // [ɡʊd]
  examTypes?: string[];
  speechUrl?: string; // word audio url. some language not have tts url, such as "ຂາດ"
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

interface ProviderResult<T, TType extends QueryType> {
  type: TType;
  queryWordInfo: QueryWordInfo;
  result?: T;
}

export interface TranslationResult<T = unknown> extends ProviderResult<T, TranslationType> {
  translations: string[];
}

export interface DictionaryResult<T = unknown> extends ProviderResult<T, DictionaryType> {
  displaySections?: DisplaySection[];
}

export interface TranslationQueryResult<T = unknown> extends TranslationResult<T>, RuntimeServiceMetadata {
  displaySections: DisplaySection[];
  hideDisplay: boolean;
  fromCache?: boolean;
}

export interface DictionaryQueryResult<T = unknown> extends DictionaryResult<T>, RuntimeServiceMetadata {
  displaySections: DisplaySection[];
  fromCache?: boolean;
}

export type QueryResult<T = unknown> = TranslationQueryResult<T> | DictionaryQueryResult<T>;

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
  examTypes?: string[];
  example?: string;
}

export interface TranslationItem {
  type: TranslationType;
  text: string;
}
