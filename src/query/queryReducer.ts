/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

/**
 * Query Reducer — centralized state management for the translation/dictionary query system.
 *
 * Architecture:
 * - QueryState: the single source of truth for all query-related UI state
 * - QueryAction: discriminated union of all possible state transitions
 * - queryReducer: pure function that computes next state from current state + action
 * - Cross-service coupling helpers: pure functions that update display when related
 *   services return results (e.g., DeepL translation updates Linguee dictionary title)
 */

import { LanguageItem } from "@/language/type";
import { QueryResult, QueryType } from "@/types";
import { sortedQueryResults, checkIfShowTranslationDetail } from "@/query/utils";
import { DictionaryType, TranslationType } from "@/types";

export interface QueryState {
  /**
   * All query results, sorted by user preference order (via sortedQueryResults).
   * Each result contains the API response data and display sections for the UI.
   * Updated by SET_RESULT action; cleared by CLEAR_ALL.
   */
  queryResults: QueryResult[];

  /**
   * In-flight query types (e.g., ["Bing Translate", "Youdao Dictionary"]).
   * Used to track which queries are still pending. When this array is empty,
   * all queries have finished and isLoading becomes false.
   * Updated by START_QUERY / FINISH_QUERY actions.
   */
  queryRecordList: QueryType[];

  isLoading: boolean;

  /**
   * Whether to show detail view (right panel with full translation text).
   */
  isShowDetail: boolean;

  /**
   * Detected source language — updated after language detection completes.
   */
  currentFromLanguageItem: LanguageItem;

  /**
   * Auto-selected target language. May differ from user selection when
   * source and target languages conflict (e.g., translating English to English
   * auto-switches to Chinese).
   */
  autoSelectedTargetLanguageItem: LanguageItem;
}

/**
 * Discriminated union of all state transitions.
 * Each action type maps to a specific reducer case.
 */
export type QueryAction =
  /** A new query started (e.g., Bing Translate request fired). Add to pending list. */
  | { type: "START_QUERY"; queryType: QueryType }
  /** A query finished (success or error). Remove from pending list. */
  | { type: "FINISH_QUERY"; queryType: QueryType }
  /** API returned a result. Add/update in queryResults, trigger cross-service coupling. */
  | { type: "SET_RESULT"; queryResult: QueryResult }
  /** Language detection completed. Update source and target language display. */
  | { type: "SET_DETECTED_LANGUAGE"; fromLanguageItem: LanguageItem; targetLanguageItem: LanguageItem }
  /** User manually selected a target language. Update target language display. */
  | { type: "SET_TARGET_LANGUAGE"; targetLanguageItem: LanguageItem }
  /** Clear all results and reset loading state (e.g., when input is cleared). */
  | { type: "CLEAR_ALL" }
  /** Prepare for a new query: clear pending list, show loading spinner. */
  | { type: "RESET_FOR_NEW_QUERY" };

/**
 * Cross-Service Coupling
 *
 * When a translation service returns a result, it may need to update a related
 * dictionary's display. For example:
 * - DeepL translation → updates Linguee dictionary's title
 * - Youdao translation → updates Youdao dictionary's translation row
 *
 * All coupling follows the same pattern: find source result, find target result,
 * update target's first display item's title/copyText. So we use a single generic
 * function with a text extractor callback.
 */

/**
 * Generic: copy translation text from a source result to a target dictionary's display item.
 *
 * @param results - current query results array
 * @param sourceType - translation type to pull text from (e.g., DeepL)
 * @param targetType - dictionary type to update (e.g., Linguee)
 * @param getText - extracts display text from the source result
 * @param options.minSections - skip update if target has fewer sections (e.g., Youdao needs ≥2)
 */
function applyTranslationToDisplay(
  results: QueryResult[],
  sourceType: QueryType,
  targetType: QueryType,
  getText: (source: QueryResult) => string | undefined,
  options?: { minSections?: number },
): QueryResult[] {
  const source = results.find((r) => r.type === sourceType);
  const target = results.find((r) => r.type === targetType);

  if (!source || !target) return results;

  const text = getText(source);
  if (!text) return results;

  return results.map((r) => {
    if (r.type !== targetType || !r.displaySections?.length) return r;
    if (options?.minSections && r.displaySections.length < options.minSections) return r;

    const updatedSections = r.displaySections.map((section, idx) => {
      if (idx !== 0 || !section.items?.length) return section;
      const updatedItems = section.items.map((item, itemIdx) => {
        if (itemIdx !== 0) return item;
        return { ...item, title: text, copyText: text };
      });
      return { ...section, items: updatedItems };
    });
    return { ...r, displaySections: updatedSections };
  });
}

/**
 * Pure reducer function. Computes next state from current state + action.
 *
 * Rules:
 * - Must be pure: no side effects, no async operations
 * - Must return new state object (immutable updates via spread)
 * - May return current state if action is a no-op (e.g., duplicate START_QUERY)
 */
export function queryReducer(state: QueryState, action: QueryAction): QueryState {
  switch (action.type) {
    case "START_QUERY": {
      // Dedup: don't add if already tracking this query type
      if (state.queryRecordList.includes(action.queryType)) return state;
      return {
        ...state,
        queryRecordList: [...state.queryRecordList, action.queryType],
        isLoading: true,
      };
    }

    case "FINISH_QUERY": {
      // Remove from pending list; if list becomes empty, all queries finished
      const newList = state.queryRecordList.filter((t) => t !== action.queryType);
      if (newList.length === state.queryRecordList.length) return state;
      return { ...state, queryRecordList: newList, isLoading: newList.length > 0 };
    }

    case "SET_RESULT": {
      const { queryResult } = action;

      // Replace existing result of same type (or add new one)
      let results = state.queryResults.filter((r) => r.type !== queryResult.type);
      results.push(queryResult);

      // Sort by user preference order
      results = sortedQueryResults(results);

      // Apply cross-service coupling
      if (queryResult.type === TranslationType.DeepL || queryResult.type === DictionaryType.Linguee) {
        results = applyTranslationToDisplay(
          results,
          TranslationType.DeepL,
          DictionaryType.Linguee,
          (r) => r.sourceResult.oneLineTranslation,
        );
      }
      if (queryResult.type === TranslationType.Youdao) {
        results = applyTranslationToDisplay(
          results,
          TranslationType.Youdao,
          DictionaryType.Youdao,
          (r) => r.sourceResult.translations.join(", "),
          { minSections: 2 },
        );
      }

      return {
        ...state,
        queryResults: results,
        isShowDetail: checkIfShowTranslationDetail(results),
      };
    }

    case "SET_DETECTED_LANGUAGE": {
      return {
        ...state,
        currentFromLanguageItem: action.fromLanguageItem,
        autoSelectedTargetLanguageItem: action.targetLanguageItem,
      };
    }

    case "SET_TARGET_LANGUAGE": {
      return {
        ...state,
        autoSelectedTargetLanguageItem: action.targetLanguageItem,
      };
    }

    case "CLEAR_ALL": {
      return {
        ...state,
        queryResults: [],
        queryRecordList: [],
        isLoading: false,
        isShowDetail: false,
      };
    }

    case "RESET_FOR_NEW_QUERY": {
      // Clear pending queries and show loading, but keep existing results visible
      // until new results arrive (better UX than flashing empty state)
      return {
        ...state,
        queryRecordList: [],
        isLoading: true,
      };
    }

    default:
      return state;
  }
}
