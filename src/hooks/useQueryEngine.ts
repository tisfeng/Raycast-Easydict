/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { detectLanguage } from "@/detectLanguage/detect";
import { DetectedLangModel } from "@/detectLanguage/types";
import { requestLingueeDictionary } from "@/dictionary/linguee/linguee";
import { formatLingueeDisplaySections } from "@/dictionary/linguee/parse";
import { updateYoudaoDictionaryDisplay } from "@/dictionary/youdao/formatData";
import { requestYoudaoWebDictionary } from "@/dictionary/youdao/youdao";
import { requestYoudaoWebTranslate } from "@/dictionary/youdao/youdaoTranslate";
import { YoudaoDictionaryFormatResult } from "@/dictionary/youdao/types";
import { getAutoSelectedTargetLanguageItem, getLanguageItemFromYoudaoCode } from "@/language/languages";
import { LanguageItem } from "@/language/type";
import { myPreferences } from "@/preferences";
import { requestAppleTranslate } from "@/translation/apple";
import { requestBaiduTextTranslate } from "@/translation/baidu/baiduAPI";
import { requestCaiyunTextTranslate } from "@/translation/caiyun";
import { requestDeepLTranslate } from "@/translation/deepL";
import { requestDeepLXTranslate } from "@/translation/deepLX";
import { requestGoogleTranslate } from "@/translation/google";
import { requestWebBingTranslate } from "@/translation/microsoft/bing";
import { requestOpenAIStreamTranslate } from "@/translation/openAI/chat";
import { requestGeminiTranslate } from "@/translation/gemini";
import { requestTencentTranslate } from "@/translation/tencent";
import { requestVolcanoTranslate } from "@/translation/volcano/volcanoAPI";
import {
  DictionaryType,
  DisplaySection,
  ListAccessoryItem,
  ListDisplayItem,
  OpenAITranslateResult,
  QueryResult,
  QueryType,
  QueryTypeResult,
  QueryWordInfo,
  TranslationItem,
  TranslationType,
} from "@/types";
import { checkIsDictionaryType, checkIsTranslationType, checkIsWord, showErrorToast } from "@/utils";
import { getFromToLanguageTitle, getTranslationMarkdown } from "@/query/utils";
import { getYoudaoWebDictionaryURL } from "@/dictionary/youdao/utils";
import { queryReducer, QueryState } from "@/query/queryReducer";
import { logTrace, logWarn } from "@/devLog";

logTrace("useQueryEngine", "module loaded");

// Translation Service Registry (module-level — static, no state dependency)

interface TranslationServiceConfig {
  type: TranslationType;
  preference: keyof Preferences;
  requestFn: (queryWordInfo: QueryWordInfo, signal?: AbortSignal) => Promise<QueryTypeResult>;
  /** Optional: override the default preference check. */
  isEnabled?: (queryWordInfo: QueryWordInfo) => boolean;
}

/** Static registry — same values as current DataManager.translationServices. */
const translationServices: TranslationServiceConfig[] = [
  { type: TranslationType.Bing, preference: "enableBingTranslate", requestFn: requestWebBingTranslate },
  { type: TranslationType.Baidu, preference: "enableBaiduTranslate", requestFn: requestBaiduTextTranslate },
  { type: TranslationType.Tencent, preference: "enableTencentTranslate", requestFn: requestTencentTranslate },
  { type: TranslationType.Volcano, preference: "enableVolcanoTranslate", requestFn: requestVolcanoTranslate },
  { type: TranslationType.Caiyun, preference: "enableCaiyunTranslate", requestFn: requestCaiyunTextTranslate },
  { type: TranslationType.Gemini, preference: "enableGeminiTranslate", requestFn: requestGeminiTranslate },
  { type: TranslationType.Google, preference: "enableGoogleTranslate", requestFn: requestGoogleTranslate },
  { type: TranslationType.DeepL, preference: "enableDeepLTranslate", requestFn: requestDeepLTranslate },
  { type: TranslationType.DeepLX, preference: "enableDeepLXTranslate", requestFn: requestDeepLXTranslate },
  { type: TranslationType.Apple, preference: "enableAppleTranslate", requestFn: requestAppleTranslate },
  {
    type: TranslationType.Youdao,
    preference: "enableYoudaoTranslate",
    isEnabled: (q) =>
      myPreferences.enableYoudaoTranslate ||
      (myPreferences.enableYoudaoDictionary && getYoudaoWebDictionaryURL(q) !== undefined && checkIsWord(q)),
    requestFn: requestYoudaoWebTranslate,
  },
];

// Display Section Derivation (replaces updateDataDisplaySections + updateTypeSectionTitle)

function computeDisplaySections(state: QueryState): DisplaySection[] {
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

      const fromLanguageItem = getLanguageItemFromYoudaoCode(fromYoudaoLangCode);

      let targetLangCode = toLanguage;
      logTrace("useQueryEngine", `userSelectedTargetLanguage: ${targetLangCode}`);

      let targetLanguageItem: LanguageItem;
      if (fromYoudaoLangCode === targetLangCode) {
        targetLanguageItem = getAutoSelectedTargetLanguageItem(fromYoudaoLangCode);
        targetLangCode = targetLanguageItem.youdaoLangCode;
        logTrace("useQueryEngine", `conflict, use autoSelectedTargetLanguage: ${targetLangCode}`);
      } else {
        targetLanguageItem = getLanguageItemFromYoudaoCode(targetLangCode);
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
