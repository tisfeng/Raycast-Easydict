/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { detectLanguage } from "@/core/detect";
import { DetectedLangModel } from "@/core/detect/types";
import { LanguageItem } from "@/core/language/types";
import { getLanguageItem } from "@/core/language/utils";
import { computeDisplaySections } from "@/core/query/displaySections";
import { queryReducer, QueryState } from "@/core/query/queryReducer";
import { TranslationServiceConfig, translationServices } from "@/core/query/services";
import { getAutoSelectedTargetLanguageItem } from "@/core/query/utils";
import { myPreferences } from "@/preferences";
import { requestLingueeDictionary } from "@/providers/dictionary/linguee/linguee";
import { formatLingueeDisplaySections } from "@/providers/dictionary/linguee/parse";
import { updateYoudaoDictionaryDisplay } from "@/providers/dictionary/youdao/formatData";
import type { YoudaoDictionaryFormatResult } from "@/providers/dictionary/youdao/types";
import { getYoudaoWebDictionaryURL } from "@/providers/dictionary/youdao/utils";
import { requestYoudaoWebDictionary } from "@/providers/dictionary/youdao/youdao";
import type { OpenAITranslateResult } from "@/providers/translation/openai";
import { requestOpenAIStreamTranslate } from "@/providers/translation/openai";
import { DictionaryType, TranslationType } from "@/types/api";
import { DisplaySection, ListAccessoryItem, ListDisplayItem } from "@/types/display";
import { QueryResult, QueryType, QueryWordInfo } from "@/types/query";
import { showErrorToast } from "@/utils/errors";
import { logTrace, logWarn } from "@/utils/logger";
import { checkIsTranslationType, checkIsWord } from "@/utils/text";

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
    (config: TranslationServiceConfig, queryWordInfo: QueryWordInfo) => {
      const enabled = config?.isEnabled?.(queryWordInfo) ?? (myPreferences[config.preference] as boolean);
      if (!enabled) return;

      addQueryToRecordList(config.type);

      config
        .requestFn(queryWordInfo, abortControllerRef.current?.signal)
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

  const queryLingueeDictionary = useCallback(
    (queryWordInfo: QueryWordInfo) => {
      if (!myPreferences.enableLingueeDictionary) return;

      const type = DictionaryType.Linguee;
      addQueryToRecordList(type);

      requestLingueeDictionary(queryWordInfo, abortControllerRef.current?.signal)
        .then((lingueeTypeResult) => {
          const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);
          if (lingueeDisplaySections.length === 0) return;

          const queryResult: QueryResult = {
            type,
            displaySections: lingueeDisplaySections,
            sourceResult: lingueeTypeResult,
          };

          if (queryWordInfo.isWord !== undefined) {
            lingueeTypeResult.queryWordInfo.isWord = queryWordInfo.isWord;
          }

          const accessoryItem: ListAccessoryItem = {
            phonetic: queryWordInfo.phonetic,
            examTypes: queryWordInfo.examTypes,
          };
          lingueeDisplaySections[0].items[0].accessoryItem = accessoryItem;

          dispatch({ type: "SET_RESULT", queryResult });
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          removeQueryFromRecordList(type);
        });
    },
    [addQueryToRecordList, removeQueryFromRecordList],
  );

  const queryYoudaoDictionary = useCallback(
    (queryWordInfo: QueryWordInfo, enableYoudaoDictionary: boolean) => {
      if (!enableYoudaoDictionary) return;

      const type = DictionaryType.Youdao;
      addQueryToRecordList(type);

      requestYoudaoWebDictionary(queryWordInfo, type, abortControllerRef.current?.signal)
        .then((youdaoDictionaryResult) => {
          const formatYoudaoResult = youdaoDictionaryResult.result as YoudaoDictionaryFormatResult | undefined;
          if (!formatYoudaoResult) {
            logWarn("useQueryEngine", "formatYoudaoResult is undefined");
            return;
          }

          const youdaoDisplaySections = updateYoudaoDictionaryDisplay(formatYoudaoResult);
          Object.assign(queryWordInfo, formatYoudaoResult.queryWordInfo);

          const youdaoDictResult: QueryResult = {
            type,
            sourceResult: youdaoDictionaryResult,
            displaySections: youdaoDisplaySections,
          };

          dispatch({ type: "SET_RESULT", queryResult: youdaoDictResult });

          if (myPreferences.enableYoudaoTranslate) {
            const translationType = TranslationType.Youdao;
            const youdaoWebTranslateResult = JSON.parse(JSON.stringify(youdaoDictionaryResult));
            youdaoWebTranslateResult.type = translationType;
            const youdaoTranslationResult: QueryResult = {
              type: translationType,
              sourceResult: youdaoWebTranslateResult,
            };

            const displayResult = buildTranslationDisplay(youdaoTranslationResult);
            if (displayResult) {
              dispatch({ type: "SET_RESULT", queryResult: displayResult });
            }
          }
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          removeQueryFromRecordList(type);
        });
    },
    [addQueryToRecordList, removeQueryFromRecordList, buildTranslationDisplay],
  );

  const queryOpenAITranslate = useCallback(
    (queryWordInfo: QueryWordInfo) => {
      if (!myPreferences.enableOpenAITranslate) return;

      const type = TranslationType.OpenAI;
      addQueryToRecordList(type);

      let openAIQueryResult: QueryResult | undefined;
      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      const chunks: string[] = [];

      const flushUpdate = (finalText?: string) => {
        if (openAIQueryResult) {
          const openAIResult = openAIQueryResult.sourceResult.result as OpenAITranslateResult;
          const translatedText = finalText !== undefined ? finalText : chunks.join("");
          openAIResult.translatedText = translatedText;
          openAIQueryResult.sourceResult.translations = [translatedText];

          const displayResult = buildTranslationDisplay(openAIQueryResult);
          if (displayResult) {
            dispatch({ type: "SET_RESULT", queryResult: displayResult });
          }
        }
      };

      queryWordInfo.onMessage = (message) => {
        chunks.push(message.content);
        if (!openAIQueryResult) {
          openAIQueryResult = {
            type,
            sourceResult: {
              type,
              queryWordInfo,
              translations: [message.content],
              result: { translatedText: message.content },
            },
          };
        }
        if (!updateTimer) {
          updateTimer = setTimeout(() => {
            updateTimer = undefined;
            flushUpdate();
          }, 100);
        }
      };

      queryWordInfo.onFinish = (value) => {
        if (value === "stop") {
          if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = undefined;
          }
          if (openAIQueryResult) {
            let translatedText = chunks.join("");
            const rightQuotes = ['"', "\u201D", "'", "\u300D"];
            if (translatedText.length > 0) {
              const lastQueryTextChar = queryWordInfo.word[queryWordInfo.word.length - 1];
              const lastTranslatedTextChar = translatedText[translatedText.length - 1];
              if (!rightQuotes.includes(lastQueryTextChar) && rightQuotes.includes(lastTranslatedTextChar)) {
                translatedText = translatedText.slice(0, translatedText.length - 1);
              }
            }
            flushUpdate(translatedText);
          }
          removeQueryFromRecordList(type);
        }
      };

      requestOpenAIStreamTranslate(queryWordInfo).catch((error) => {
        showErrorToast(error);
        removeQueryFromRecordList(type);
      });
    },
    [addQueryToRecordList, removeQueryFromRecordList, buildTranslationDisplay],
  );

  const queryTextWithTextInfo = useCallback(
    (queryWordInfo: QueryWordInfo) => {
      const enableYoudaoDictionary =
        myPreferences.enableYoudaoDictionary &&
        getYoudaoWebDictionaryURL(queryWordInfo) !== undefined &&
        checkIsWord(queryWordInfo);

      shouldClearQueryRef.current = false;
      isCurrentQueryRef.current = true;
      hasPlayedAudioRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      dispatch({ type: "RESET_FOR_NEW_QUERY" });

      const { word, fromLanguage, toLanguage } = queryWordInfo;
      logTrace("useQueryEngine", `query text: ${word}`);
      logTrace("useQueryEngine", `query fromTo: ${fromLanguage} -> ${toLanguage}`);

      queryYoudaoDictionary(queryWordInfo, enableYoudaoDictionary);

      for (const config of translationServices) {
        runTranslationQuery(config, queryWordInfo);
      }

      queryOpenAITranslate(queryWordInfo);
      queryLingueeDictionary(queryWordInfo);
    },
    [queryYoudaoDictionary, runTranslationQuery, queryOpenAITranslate, queryLingueeDictionary],
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
