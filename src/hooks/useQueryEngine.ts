/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { detectLanguage } from "@/core/detect";
import { DetectedLangModel } from "@/core/detect/types";
import { LanguageItem } from "@/core/language/types";
import { getLanguageItem } from "@/core/language/utils";
import { computeDisplaySections } from "@/core/query/displaySections";
import { queryReducer, QueryState } from "@/core/query/queryReducer";
import { getAutoSelectedTargetLanguageItem } from "@/core/query/utils";
import { myPreferences } from "@/preferences";
import { DictionaryServiceConfig, dictionaryServices } from "@/providers/dictionary";
import { TranslationServiceConfig, translationServices } from "@/providers/translation";
import { TranslationType } from "@/types/api";
import { DisplaySection, ListDisplayItem } from "@/types/display";
import { QueryResult, QueryType, QueryTypeResult, QueryWordInfo } from "@/types/query";
import { showErrorToast } from "@/utils/errors";
import { logTrace, logWarn } from "@/utils/logger";
import { checkIsTranslationType } from "@/utils/text";

logTrace("useQueryEngine", "module loaded");

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

  const displaySections = useMemo(() => computeDisplaySections(state), [state]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const addQueryToRecordList = useCallback((type: QueryType) => {
    dispatch({ type: "START_QUERY", queryType: type });
  }, []);

  const removeQueryFromRecordList = useCallback((type: QueryType) => {
    dispatch({ type: "FINISH_QUERY", queryType: type });
  }, []);

  const buildTranslationDisplay = useCallback((queryResult: QueryResult): QueryResult | null => {
    const { type, sourceResult } = queryResult;

    if (!checkIsTranslationType(type)) {
      return null;
    }

    if (!sourceResult.result) {
      logWarn("useQueryEngine", `${type} result is empty.`);
      return null;
    }

    const oneLineTranslation = sourceResult.translations.join(", ");
    sourceResult.oneLineTranslation = oneLineTranslation;
    const copyText = sourceResult.translations.join("\n");

    let key = `${oneLineTranslation}-${type}`;
    if (type === TranslationType.OpenAI) {
      key = type;
    }
    const displayItem: ListDisplayItem = {
      displayCategory: "translation",
      displayType: type,
      queryType: type,
      key,
      title: ` ${oneLineTranslation}`,
      copyText,
      queryWordInfo: sourceResult.queryWordInfo,
    };
    const displaySections: DisplaySection[] = [{ type, sectionTitle: type, items: [displayItem] }];

    const newResult: QueryResult = { ...queryResult, displaySections };

    if (type === TranslationType.DeepL) {
      newResult.hideDisplay = !myPreferences.enableDeepLTranslate;
    }

    if (
      type === TranslationType.Youdao &&
      myPreferences.enableYoudaoDictionary &&
      !myPreferences.enableYoudaoTranslate
    ) {
      newResult.hideDisplay = true;
    }

    return newResult;
  }, []);

  const runTranslationQuery = useCallback(
    (config: TranslationServiceConfig, queryWordInfo: QueryWordInfo, streaming?: boolean) => {
      const enabled = config?.isEnabled?.(queryWordInfo) ?? (myPreferences[config.preference] as boolean);
      if (!enabled) return;

      addQueryToRecordList(config.type);

      // Wire streaming callbacks for providers that support progressive updates
      if (streaming) {
        const chunks: string[] = [];
        let updateTimer: ReturnType<typeof setTimeout> | undefined;

        queryWordInfo.onMessage = (message) => {
          chunks.push(message.content);
          if (!updateTimer) {
            updateTimer = setTimeout(() => {
              updateTimer = undefined;
              const translatedText = chunks.join("");
              const result: QueryTypeResult = {
                type: config.type,
                queryWordInfo,
                translations: [translatedText],
                result: { translatedText },
              };
              const rawResult: QueryResult = { type: config.type, sourceResult: result };
              const displayResult = buildTranslationDisplay(rawResult);
              if (displayResult) {
                dispatch({ type: "SET_RESULT", queryResult: displayResult });
              }
            }, 100);
          }
        };

        queryWordInfo.onFinish = () => {
          if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = undefined;
          }
        };
      }

      const instance = new config.provider();

      instance
        .request(queryWordInfo, abortControllerRef.current?.signal)
        .then((result) => {
          const rawResult: QueryResult = { type: config.type, sourceResult: result };
          const displayResult = buildTranslationDisplay(rawResult);
          if (displayResult) {
            dispatch({ type: "SET_RESULT", queryResult: displayResult });
          }
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          removeQueryFromRecordList(config.type);
        });
    },
    [addQueryToRecordList, removeQueryFromRecordList, buildTranslationDisplay],
  );

  const runDictionaryQuery = useCallback(
    (config: DictionaryServiceConfig, queryWordInfo: QueryWordInfo) => {
      const enabled =
        config?.isEnabled?.(queryWordInfo) ??
        (config.preference ? (myPreferences[config.preference] as boolean) : true);
      if (!enabled) return;

      addQueryToRecordList(config.type);
      if (!config.provider) return;
      const instance = new config.provider();

      instance
        .request(queryWordInfo, abortControllerRef.current?.signal)
        .then((result) => {
          if (result.displaySections && result.displaySections.length > 0) {
            dispatch({ type: "SET_RESULT", queryResult: result });
          }
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          removeQueryFromRecordList(config.type);
        });
    },
    [addQueryToRecordList, removeQueryFromRecordList],
  );

  const queryTextWithTextInfo = useCallback(
    (queryWordInfo: QueryWordInfo) => {
      shouldClearQueryRef.current = false;
      isCurrentQueryRef.current = true;
      hasPlayedAudioRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      dispatch({ type: "RESET_FOR_NEW_QUERY" });

      const { word, fromLanguage, toLanguage } = queryWordInfo;
      logTrace("useQueryEngine", `query text: ${word}`);
      logTrace("useQueryEngine", `query fromTo: ${fromLanguage} -> ${toLanguage}`);

      for (const config of dictionaryServices) {
        runDictionaryQuery(config, queryWordInfo);
      }

      for (const config of translationServices) {
        runTranslationQuery(config, queryWordInfo, config.streaming);
      }
    },
    [runDictionaryQuery, runTranslationQuery],
  );

  const queryTextWithDetectedLanguage = useCallback(
    (text: string, toLanguage: string, detectedLanguage: DetectedLangModel) => {
      const fromYoudaoLangCode = detectedLanguage.youdaoLangCode;
      logTrace("useQueryEngine", `queryTextWithFromLanguageId: ${fromYoudaoLangCode}`);

      const fromLanguageItem = getLanguageItem(fromYoudaoLangCode);

      let targetLangCode = toLanguage;
      logTrace("useQueryEngine", `userSelectedTargetLanguage: ${targetLangCode}`);

      let targetLanguageItem: LanguageItem;
      if (fromYoudaoLangCode === targetLangCode) {
        targetLanguageItem = getAutoSelectedTargetLanguageItem(fromYoudaoLangCode);
        targetLangCode = targetLanguageItem.youdaoLangCode;
        logTrace("useQueryEngine", `conflict, use autoSelectedTargetLanguage: ${targetLangCode}`);
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
      logTrace("useQueryEngine", `query: ${text}`);

      shouldClearQueryRef.current = false;

      detectLanguage(text).then((detectedLanguage: DetectedLangModel) => {
        logTrace(
          "useQueryEngine",
          `final confirmed: ${detectedLanguage.confirmed}, type: ${detectedLanguage.type}, detectLanguage: ${detectedLanguage.youdaoLangCode}`,
        );

        if (shouldClearQueryRef.current) {
          logTrace("useQueryEngine", "query has been canceled, stop, return");
          return;
        }

        queryTextWithDetectedLanguage(text, toLanguage, detectedLanguage);
      });
    },
    [queryTextWithDetectedLanguage],
  );

  const clearQueryResult = useCallback(() => {
    logTrace("useQueryEngine", "clearQueryResult");

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

    queryResults: state.queryResults,
    hasPlayedAudioRef,
    isCurrentQueryRef,
  } as const;
}
