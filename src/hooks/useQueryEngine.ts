/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { myPreferences } from "@/consts";
import { detectLanguage } from "@/core/detect";
import type { DetectedLangModel } from "@/core/detect/types";
import type { LanguageItem } from "@/core/language/types";
import { getLanguageItem } from "@/core/language/utils";
import { computeDisplaySections } from "@/core/query/displaySections";
import { computeHideDisplay } from "@/core/query/hideRules";
import type { QueryAction, QueryState } from "@/core/query/queryReducer";
import { queryReducer } from "@/core/query/queryReducer";
import { getAutoSelectedTargetLanguageItem } from "@/core/query/utils";
import type { DictionaryServiceConfig } from "@/providers/dictionary";
import { dictionaryServices } from "@/providers/dictionary";
import type { TranslationServiceConfig } from "@/providers/translation";
import { translationServices } from "@/providers/translation";
import { checkIsTranslationType, type TranslationType } from "@/types/api";
import type { DisplaySection, ListDisplayItem } from "@/types/display";
import type { QueryResult, QueryTypeResult, QueryWordInfo } from "@/types/query";
import { showErrorToast } from "@/utils/errors";
import { logTrace, logWarn } from "@/utils/logger";

import { useAutoPlayAudio } from "./useAutoPlayAudio";

logTrace("UseQueryEngine", "module loaded");

// Initial State

function createInitialState({
  initialFromLanguage,
  initialTargetLanguage,
}: {
  initialFromLanguage: LanguageItem;
  initialTargetLanguage: LanguageItem;
}): QueryState {
  return {
    queryResults: [],
    queryRecordList: [],
    isLoading: false,
    isShowDetail: false,
    currentFromLanguageItem: initialFromLanguage,
    autoSelectedTargetLanguageItem: initialTargetLanguage,
  };
}

// Hook

function createStreamDebouncer(
  configType: TranslationType,
  queryWordInfo: QueryWordInfo,
  dispatch: React.Dispatch<QueryAction>,
  buildTranslationDisplay: (rawResult: QueryResult) => QueryResult | null,
  delay = 80,
) {
  let updateTimer: ReturnType<typeof setTimeout> | undefined;
  let accumulatedText = "";

  const flushUpdate = () => {
    if (accumulatedText) {
      const result: QueryTypeResult = {
        type: configType,
        queryWordInfo,
        translations: [accumulatedText],
        result: { translatedText: accumulatedText },
      };
      const rawResult: QueryResult = { type: configType, sourceResult: result };
      const displayResult = buildTranslationDisplay(rawResult);
      if (displayResult) {
        dispatch({ type: "SET_RESULT", queryResult: displayResult });
      }
    }
  };

  return {
    push(text: string) {
      accumulatedText += text;
      if (!updateTimer) {
        updateTimer = setTimeout(() => {
          updateTimer = undefined;
          flushUpdate();
        }, delay);
      }
    },
    clear() {
      if (updateTimer) {
        clearTimeout(updateTimer);
        updateTimer = undefined;
      }
      flushUpdate();
    },
  };
}

export function useQueryEngine(initialFromLanguage: LanguageItem, initialTargetLanguage: LanguageItem) {
  const [state, dispatch] = useReducer(
    queryReducer,
    { initialFromLanguage, initialTargetLanguage },
    createInitialState,
  );

  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const shouldClearQueryRef = useRef(false);
  const isCurrentQueryRef = useRef(true);
  const hasPlayedAudioRef = useRef(false);

  useAutoPlayAudio(state.queryResults, hasPlayedAudioRef, isCurrentQueryRef, abortControllerRef);

  const displaySections = useMemo(() => computeDisplaySections(state), [state]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const buildTranslationDisplay = useCallback((queryResult: QueryResult): QueryResult | null => {
    const { type, sourceResult } = queryResult;

    if (!checkIsTranslationType(type)) {
      return null;
    }

    if (!sourceResult.translations || sourceResult.translations.length === 0) {
      logWarn("UseQueryEngine", `${type} result is empty.`);
      return null;
    }

    const oneLineTranslation = sourceResult.translations.join(", ");
    const updatedSourceResult = { ...sourceResult, oneLineTranslation };
    const copyText = sourceResult.translations.join("\n");

    const displayItem: ListDisplayItem = {
      displayCategory: "translation",
      displayType: type,
      queryType: type,
      key: type,
      title: oneLineTranslation,
      copyText,
      queryWordInfo: sourceResult.queryWordInfo,
    };
    const displaySections: DisplaySection[] = [{ type, sectionTitle: type, items: [displayItem] }];

    return {
      ...queryResult,
      sourceResult: updatedSourceResult,
      displaySections,
      hideDisplay: computeHideDisplay(type),
    };
  }, []);

  const runTranslationQuery = useCallback(
    async (config: TranslationServiceConfig, queryWordInfo: QueryWordInfo) => {
      const enabled = config?.isEnabled?.(queryWordInfo) ?? (myPreferences[config.preference] as boolean);
      if (!enabled) return;

      dispatch({ type: "START_QUERY", queryType: config.type });

      const signal = abortControllerRef.current?.signal;
      const instance = new config.provider();

      try {
        const iterator = instance.request(queryWordInfo, { signal });
        const debouncer = createStreamDebouncer(config.type, queryWordInfo, dispatch, buildTranslationDisplay);
        let finalResult: QueryTypeResult | undefined;

        while (true) {
          const { done, value } = await iterator.next();
          if (done) {
            finalResult = value;
            break;
          }
          debouncer.push(value.content);
        }

        if (finalResult) {
          const rawResult: QueryResult = { type: config.type, sourceResult: finalResult };
          const displayResult = buildTranslationDisplay(rawResult);
          if (displayResult) {
            dispatch({ type: "SET_RESULT", queryResult: displayResult });
          }
        }

        debouncer.clear();
      } catch (error) {
        showErrorToast(error);
      } finally {
        dispatch({ type: "FINISH_QUERY", queryType: config.type });
      }
    },
    [buildTranslationDisplay],
  );

  const runDictionaryQuery = useCallback(async (config: DictionaryServiceConfig, queryWordInfo: QueryWordInfo) => {
    const enabled =
      config?.isEnabled?.(queryWordInfo) ?? (config.preference ? (myPreferences[config.preference] as boolean) : true);
    if (!enabled) return;
    if (!config.provider) return;

    dispatch({ type: "START_QUERY", queryType: config.type });
    const instance = new config.provider();

    try {
      const result = await instance.request(queryWordInfo, { signal: abortControllerRef.current?.signal });
      if (result.displaySections && result.displaySections.length > 0) {
        dispatch({ type: "SET_RESULT", queryResult: result });
      }
    } catch (error) {
      showErrorToast(error);
    } finally {
      dispatch({ type: "FINISH_QUERY", queryType: config.type });
    }
  }, []);

  const queryTextWithTextInfo = useCallback(
    (queryWordInfo: QueryWordInfo) => {
      shouldClearQueryRef.current = false;
      isCurrentQueryRef.current = true;
      hasPlayedAudioRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      dispatch({ type: "RESET_FOR_NEW_QUERY" });

      const { word, fromLanguage, toLanguage } = queryWordInfo;
      logTrace("UseQueryEngine", `query text: ${word}`);
      logTrace("UseQueryEngine", `query fromTo: ${fromLanguage} -> ${toLanguage}`);

      for (const config of dictionaryServices) {
        runDictionaryQuery(config, queryWordInfo);
      }

      for (const config of translationServices) {
        runTranslationQuery(config, queryWordInfo);
      }
    },
    [runDictionaryQuery, runTranslationQuery],
  );

  const queryTextWithDetectedLanguage = useCallback(
    (text: string, toLanguage: string, detectedLanguage: DetectedLangModel) => {
      const fromYoudaoLangCode = detectedLanguage.youdaoLangCode;
      logTrace("UseQueryEngine", `queryTextWithFromLanguageId: ${fromYoudaoLangCode}`);

      const fromLanguageItem = getLanguageItem(fromYoudaoLangCode);

      let targetLangCode = toLanguage;
      logTrace("UseQueryEngine", `userSelectedTargetLanguage: ${targetLangCode}`);

      let targetLanguageItem: LanguageItem;
      if (fromYoudaoLangCode === targetLangCode) {
        targetLanguageItem = getAutoSelectedTargetLanguageItem(fromYoudaoLangCode);
        targetLangCode = targetLanguageItem.youdaoLangCode;
        logTrace("UseQueryEngine", `conflict, use autoSelectedTargetLanguage: ${targetLangCode}`);
      } else {
        targetLanguageItem = getLanguageItem(targetLangCode);
      }

      dispatch({
        type: "SET_DETECTED_LANGUAGE",
        fromLanguageItem,
        targetLanguageItem,
      });

      const queryTextInfo: QueryWordInfo = {
        word: text,
        fromLanguage: fromYoudaoLangCode,
        toLanguage: targetLangCode,
      };
      queryTextWithTextInfo(queryTextInfo);
    },
    [queryTextWithTextInfo],
  );

  const queryText = useCallback(
    (text: string, toLanguage: string) => {
      logTrace("UseQueryEngine", `query: ${text}`);

      shouldClearQueryRef.current = false;

      detectLanguage(text, abortControllerRef.current?.signal).then((detectedLanguage: DetectedLangModel) => {
        logTrace(
          "UseQueryEngine",
          `final confirmed: ${detectedLanguage.confirmed}, type: ${detectedLanguage.type}, detectLanguage: ${detectedLanguage.youdaoLangCode}`,
        );

        if (shouldClearQueryRef.current) {
          logTrace("UseQueryEngine", "query has been cancelled, stop, return");
          return;
        }

        queryTextWithDetectedLanguage(text, toLanguage, detectedLanguage);
      });
    },
    [queryTextWithDetectedLanguage],
  );

  const clearQueryResult = useCallback(() => {
    logTrace("UseQueryEngine", "clearQueryResult");

    shouldClearQueryRef.current = true;
    isCurrentQueryRef.current = false;

    abortControllerRef.current?.abort();
    abortControllerRef.current = undefined;

    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const setAutoSelectedTargetLanguageItem = useCallback((item: LanguageItem) => {
    dispatch({ type: "SET_TARGET_LANGUAGE", targetLanguageItem: item });
  }, []);

  return {
    displaySections,
    isLoading: state.isLoading,
    isShowDetail: state.isShowDetail,
    currentFromLanguageItem: state.currentFromLanguageItem,
    autoSelectedTargetLanguageItem: state.autoSelectedTargetLanguageItem,

    queryText,
    queryTextWithTextInfo,
    clearQueryResult,
    setAutoSelectedTargetLanguageItem,
  } as const;
}
