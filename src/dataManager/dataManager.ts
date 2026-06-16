/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { OpenAITranslateResult, QueryWordInfo } from "@/types";
import { detectLanguage } from "@/detectLanguage/detect";
import { DetectedLangModel } from "@/detectLanguage/types";
import { requestLingueeDictionary } from "@/dictionary/linguee/linguee";
import { formatLingueeDisplaySections } from "@/dictionary/linguee/parse";
import { updateYoudaoDictionaryDisplay } from "@/dictionary/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoWebDictionary } from "@/dictionary/youdao/youdao";
import { requestYoudaoWebTranslate } from "@/dictionary/youdao/youdaoTranslate";
import { englishLanguageItem } from "@/language/consts";
import { getAutoSelectedTargetLanguageItem, getLanguageItemFromYoudaoCode } from "@/language/languages";
import { LanguageItem } from "@/language/type";
import { logTrace, logWarn } from "@/devLog";
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
  QueryResult,
  QueryType,
  QueryTypeResult,
  TranslationItem,
  TranslationType,
} from "@/types";
import { checkIsDictionaryType, checkIsTranslationType, showErrorToast } from "@/utils";
import {
  checkIfEnableYoudaoDictionary,
  checkIfShowTranslationDetail,
  getFromToLanguageTitle,
  sortedQueryResults,
  getTranslationMarkdown,
  applyTranslationMarkdown,
} from "@/dataManager/utils";
import { YoudaoDictionaryFormatResult } from "@/dictionary/youdao/types";

logTrace("dataManager", "module loaded");

/**
 * Data manager.
 *
 * Todo: need to optimize.
 * - data manager.
 * - data request.
 * - data handle.
 */

/** Configuration for a standard translation service query. */
interface TranslationServiceConfig {
  type: TranslationType;
  /** Preference key that enables/disables this service. */
  preference: keyof Preferences;
  /** The request function. All standard services share this signature. */
  requestFn: (queryWordInfo: QueryWordInfo, signal?: AbortSignal) => Promise<QueryTypeResult>;
  /** Optional: override the default preference check. */
  isEnabled?: () => boolean;
  /** Optional: called after updateTranslationDisplay, for cross-service coupling. */
  onResult?: (queryResult: QueryResult) => void;
}

export class DataManager {
  // some callback functions.
  updateListDisplaySections: (displaySections: DisplaySection[]) => void = () => {
    // later will assign callback.
  };
  updateLoadingState: (isLoadingState: boolean) => void = () => {
    // later will assign callback.
  };
  updateCurrentFromLanguageItem: (languageItem: LanguageItem) => void = () => {
    // later will assign callback.
  };
  updateAutoSelectedTargetLanguageItem: (languageItem: LanguageItem) => void = () => {
    // later will assign callback.
  };

  // ---- Translation service registry ----

  private readonly translationServices: TranslationServiceConfig[] = [
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
      isEnabled: () => myPreferences.enableYoudaoTranslate || myPreferences.enableYoudaoDictionary,
      requestFn: requestYoudaoWebTranslate,
      onResult: (queryResult) => {
        // Update Youdao dictionary's translation row with translate result.
        this.updateYoudaoDictionaryTranslation(queryResult.sourceResult.translations);
      },
    },
  ];

  /**
   * Run a standard translation query: preference check → request → update display.
   */
  private runTranslationQuery(config: TranslationServiceConfig, queryWordInfo: QueryWordInfo) {
    const enabled = config?.isEnabled?.() ?? myPreferences[config.preference];
    if (!enabled) return;

    this.addQueryToRecordList(config.type);

    config
      .requestFn(queryWordInfo, this.abortController?.signal)
      .then((result) => {
        const queryResult: QueryResult = { type: config.type, sourceResult: result };
        this.updateTranslationDisplay(queryResult);
        config.onResult?.(queryResult);
      })
      .catch((error) => {
        showErrorToast(error);
      })
      .finally(() => {
        this.removeQueryFromRecordList(config.type);
      });
  }

  queryResults: QueryResult[] = [];
  queryWordInfo = {} as QueryWordInfo; // later will must assign value.

  /**
   * when has new input text, need to cancel previous request.
   */
  isLastQuery = true;
  /**
   * when input text is empty, need to cancel previous request, and clear result.
   */
  shouldClearQuery = true;

  /**
   * Show detail of translation. Only dictionary is empty, and translation is too long, then show detail.
   */
  isShowDetail = false;
  hasPlayedAudio = false;
  enableYoudaoDictionary = true;

  abortController?: AbortController;

  /**
   * Used for recording all the query types. If start a new query, push it to the array, when finished, remove it.
   */
  queryRecordList: QueryType[] = [];

  /**
   * Query text with text info, query dictionary API or translate API.
   *
   * * Note: please do not change this function pararm.
   */
  public queryTextWithTextInfo(queryWordInfo: QueryWordInfo) {
    this.queryWordInfo = queryWordInfo;
    this.enableYoudaoDictionary = checkIfEnableYoudaoDictionary(this.queryWordInfo);

    this.resetProperties();

    const { word, fromLanguage, toLanguage } = queryWordInfo;
    logTrace("query text", word);
    logTrace("query fromTo", `${fromLanguage} -> ${toLanguage}`);

    // Todo: handle cancel request, add reject(undefined) to the catch.
    this.queryYoudaoDictionary(queryWordInfo);

    for (const config of this.translationServices) {
      this.runTranslationQuery(config, queryWordInfo);
    }
    // OpenAI uses streaming (onMessage/onFinish callbacks) — not in the registry.
    this.queryOpenAITranslate(queryWordInfo);

    // Linguee: complex dictionary with cross-service coupling (DeepL updates its display).
    this.queryLingueeDictionary(queryWordInfo);

    // If no query, stop loading.
    if (this.queryRecordList.length === 0) {
      this.updateLoadingState(false);
    }
  }

  /**
   * Clear query result.
   */
  public clearQueryResult() {
    this.cancelAndRemoveAllQueries();

    this.isShowDetail = false;
    this.shouldClearQuery = true;
    this.isLastQuery = false;
    this.updateLoadingState(false);

    this.queryResults = [];
    this.updateListDisplaySections([]);
  }

  /**
   * 1. Update query result.
   * 2. Update display sections.
   */
  private updateQueryResultAndSections(queryResult: QueryResult) {
    this.updateQueryResult(queryResult);
    this.updateDataDisplaySections();
  }

  /**
   * update query result.
   *
   * 1.update existing result or push new result to queryResults.
   * 2.sort queryResults.
   * 3.update dictionary section title.
   */
  private updateQueryResult(queryResult: QueryResult) {
    const existingIndex = this.queryResults.findIndex((r) => r.type === queryResult.type);
    if (existingIndex >= 0) {
      this.queryResults[existingIndex] = queryResult;
    } else {
      this.queryResults.push(queryResult);
    }
    this.queryResults = sortedQueryResults(this.queryResults);
  }

  /**
   * 1. Update isShowDetail。
   * 2. Update section title.
   * 3. Update displaySections
   * 4. callback updateListDisplaySections.
   */
  private updateDataDisplaySections() {
    this.isShowDetail = checkIfShowTranslationDetail(this.queryResults);
    this.updateTypeSectionTitle();

    const translations = [] as TranslationItem[];
    for (const queryResult of this.queryResults) {
      const { type, sourceResult } = queryResult;
      if (sourceResult && checkIsTranslationType(type)) {
        const typeStr = sourceResult.type as TranslationType;
        const markdownTranslation = getTranslationMarkdown(sourceResult);
        translations.push({ type: typeStr, text: markdownTranslation });
      }
    }

    const displaySections: DisplaySection[][] = [];
    for (const queryResult of this.queryResults) {
      const shouldDisplay = !queryResult.hideDisplay;
      if (shouldDisplay && queryResult.displaySections?.length) {
        applyTranslationMarkdown(queryResult, translations);
        displaySections.push(queryResult.displaySections);
      }
    }
    this.updateListDisplaySections(displaySections.flat());
  }

  /**
   * Query text, automatically detect the language of input text.
   * Public to allow debounced calls from useDebouncedQuery hook.
   */
  public queryText(text: string, toLanguage: string) {
    logTrace("dataManager", `query: ${text}`);

    this.updateLoadingState(true);
    this.resetProperties();

    // Todo: need to optimize. Enable to cancel language detect.
    // Todo: record all detect result, maybe can use it as translation result.

    detectLanguage(text).then((detectedLanguage) => {
      logTrace(
        "dataManager",
        `final confirmed: ${detectedLanguage.confirmed}, type: ${detectedLanguage.type}, detectLanguage: ${detectedLanguage.youdaoLangCode}`,
      );

      // * It takes time to detect the language, in the meantime, user may have cancelled the query.
      if (this.shouldClearQuery) {
        logTrace("dataManager", "query has been canceled, stop, return");
        this.updateLoadingState(false);
        return;
      }

      this.queryTextWithDetectedLanguage(text, toLanguage, detectedLanguage);
    });
  }

  /**
   * Query text with with detected language
   */
  private queryTextWithDetectedLanguage(text: string, toLanguage: string, detectedLanguage: DetectedLangModel) {
    const fromYoudaoLangCode = detectedLanguage.youdaoLangCode;
    logTrace("dataManager", `queryTextWithFromLanguageId: ${fromYoudaoLangCode}`);
    this.updateCurrentFromLanguageItem(getLanguageItemFromYoudaoCode(fromYoudaoLangCode));

    // priority to use user selected target language, if conflict, use auto selected target language
    let targetLangCode = toLanguage;
    logTrace("dataManager", `userSelectedTargetLanguage: ${targetLangCode}`);
    if (fromYoudaoLangCode === targetLangCode) {
      const targetLanguageItem = getAutoSelectedTargetLanguageItem(fromYoudaoLangCode);
      this.updateAutoSelectedTargetLanguageItem(targetLanguageItem);
      targetLangCode = targetLanguageItem.youdaoLangCode;
      logTrace("dataManager", `conflict, use autoSelectedTargetLanguage: ${targetLangCode}`);
    }

    const queryTextInfo: QueryWordInfo = {
      word: text,
      fromLanguage: fromYoudaoLangCode,
      toLanguage: targetLangCode,
    };
    this.queryTextWithTextInfo(queryTextInfo);
  }

  /**
   * Reset properyies before each query.
   */
  private resetProperties() {
    logTrace("dataManager", "resetProperties");

    this.hasPlayedAudio = false;
    this.isLastQuery = true;
    this.shouldClearQuery = false;
    this.queryRecordList = [];

    const abortController = new AbortController();
    this.abortController = abortController;
  }

  /**
   * Query Linguee dictionary.
   *
   * For better UI, we use DeepL translate result as Linguee translation result.
   */
  private queryLingueeDictionary(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableLingueeDictionary) {
      const type = DictionaryType.Linguee;
      this.addQueryToRecordList(type);

      requestLingueeDictionary(queryWordInfo, this.abortController?.signal)
        .then((lingueeTypeResult) => {
          const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);
          if (lingueeDisplaySections.length === 0) {
            return;
          }

          const queryResult: QueryResult = {
            type: type,
            displaySections: lingueeDisplaySections,
            sourceResult: lingueeTypeResult,
          };

          // * If has Youdao dictionary check if quey text is word, directly use it.
          if (queryWordInfo.isWord !== undefined) {
            lingueeTypeResult.queryWordInfo.isWord = queryWordInfo.isWord;
          }

          // Use Youdao phonetic as Linguee phonetic.
          const accessoryItem: ListAccessoryItem = {
            phonetic: queryWordInfo.phonetic,
            examTypes: queryWordInfo.examTypes,
          };

          lingueeDisplaySections[0].items[0].accessoryItem = accessoryItem;

          // try use DeepL translate result as Linguee translation.
          this.updateLingueeTranslation(queryResult);
          this.updateQueryResultAndSections(queryResult);

          this.downloadAndPlayWordAudio(lingueeTypeResult);
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
          this.updateDataDisplaySections();
        });
    }
  }

  /**
   * Query Youdao dictionary.
   */
  private queryYoudaoDictionary(queryWordInfo: QueryWordInfo) {
    if (this.enableYoudaoDictionary) {
      const type = DictionaryType.Youdao;
      this.addQueryToRecordList(type);

      requestYoudaoWebDictionary(queryWordInfo, type, this.abortController?.signal)
        .then((youdaoDictionaryResult) => {
          const formatYoudaoResult = youdaoDictionaryResult.result as YoudaoDictionaryFormatResult | undefined;
          if (!formatYoudaoResult) {
            logWarn("dataManager", "formatYoudaoResult is undefined");
            return;
          }

          const youdaoDisplaySections = updateYoudaoDictionaryDisplay(formatYoudaoResult);

          // * use Youdao dictionary to check if query text is a word.
          Object.assign(queryWordInfo, formatYoudaoResult.queryWordInfo);

          const youdaoDictResult: QueryResult = {
            type: type,
            sourceResult: youdaoDictionaryResult,
            displaySections: youdaoDisplaySections,
          };

          this.updateQueryResultAndSections(youdaoDictResult);

          // if enabled Youdao translate, directly use Youdao API dictionary translate result as Youdao translation.
          if (myPreferences.enableYoudaoTranslate) {
            const translationType = TranslationType.Youdao;

            // * Deep copy Youdao dictionary result, as Youdao translate result.
            const youdaoWebTranslateResult = JSON.parse(JSON.stringify(youdaoDictionaryResult));
            youdaoWebTranslateResult.type = translationType;
            const youdaoTranslationResult: QueryResult = {
              type: translationType,
              sourceResult: youdaoWebTranslateResult,
            };
            this.updateTranslationDisplay(youdaoTranslationResult);
          }

          // * Note: play audio will block thread, so we need to do it in the end.
          this.downloadAndPlayWordAudio(youdaoDictionaryResult);
        })
        .catch((error) => {
          showErrorToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query OpenAI translate.
   */
  private queryOpenAITranslate(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableOpenAITranslate) {
      const type = TranslationType.OpenAI;
      this.addQueryToRecordList(type);

      let openAIQueryResult: QueryResult | undefined;
      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      const chunks: string[] = [];

      const flushUpdate = (finalText?: string) => {
        if (openAIQueryResult) {
          const openAIResult = openAIQueryResult.sourceResult.result as OpenAITranslateResult;
          const translatedText = finalText !== undefined ? finalText : chunks.join("");
          openAIResult.translatedText = translatedText;
          openAIQueryResult.sourceResult.translations = [translatedText];
          this.updateTranslationDisplay(openAIQueryResult);
        }
      };

      queryWordInfo.onMessage = (message) => {
        chunks.push(message.content);
        if (!openAIQueryResult) {
          openAIQueryResult = {
            type: type,
            sourceResult: {
              type,
              queryWordInfo,
              translations: [message.content],
              result: {
                translatedText: message.content,
              },
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
          this.removeQueryFromRecordList(type);
        }
      };

      requestOpenAIStreamTranslate(queryWordInfo)
        .then(() => {
          // move to onMessage
        })
        .catch((error) => {
          showErrorToast(error);
          this.removeQueryFromRecordList(type);
        })
        .finally(() => {
          // move to onFinish
        });
    }
  }

  /**
   * Add query to record list, and update loading status.
   */
  private addQueryToRecordList(type: QueryType) {
    this.queryRecordList.push(type);
    this.updateLoadingState(true);
  }

  /**
   * Remove query type from queryRecordList, and update loading status.
   */
  private removeQueryFromRecordList(type: QueryType) {
    this.queryRecordList = this.queryRecordList.filter((queryType) => queryType !== type);

    const showingLoadingState = this.queryRecordList.length > 0;
    this.updateLoadingState(showingLoadingState);

    if (!showingLoadingState) {
      logTrace("dataManager", "All queries finished.");
      this.abortController = undefined;
    }
  }

  /**
   * Remove all query from queryRecordList, and update loading status.
   */
  private cancelAndRemoveAllQueries() {
    logTrace("dataManager", "cancel, and remove all query list");

    this.queryRecordList = [];
    this.updateLoadingState(false);

    this.abortController?.abort();
    this.abortController = undefined;
  }

  /**
   * Update the translation display.
   *
   * * If sourceResult.result exist, then will call this.updateRequestDisplayResults()
   */
  private updateTranslationDisplay(queryResult: QueryResult) {
    const { type, sourceResult } = queryResult;

    if (!sourceResult.result) {
      logWarn("dataManager", `${type} result is empty.`);
      return;
    }

    const oneLineTranslation = sourceResult.translations.join(", ");
    sourceResult.oneLineTranslation = oneLineTranslation;
    let copyText = sourceResult.translations.join("\n");

    // Debug: used for viewing long text log.
    if (environment.isDevelopment && type === TranslationType.Google) {
      const googleResult = sourceResult.result;
      copyText = JSON.stringify(googleResult, null, 4);
    }

    if (oneLineTranslation) {
      let key = `${oneLineTranslation}-${type}`;
      if (type === TranslationType.OpenAI) {
        // Avoid frequent update cause UI flicker.
        key = type;
      }
      const displayItem: ListDisplayItem = {
        displayType: type, // TranslationType
        queryType: type,
        key: key,
        title: ` ${oneLineTranslation}`,
        copyText: copyText,
        queryWordInfo: sourceResult.queryWordInfo,
      };
      const displaySections: DisplaySection[] = [
        {
          type: type,
          sectionTitle: type,
          items: [displayItem],
        },
      ];
      const newQueryResult: QueryResult = {
        ...queryResult,
        displaySections: displaySections,
      };

      // this is Linguee dictionary query, we need to check to update Linguee translation.
      if (type === TranslationType.DeepL) {
        const lingueeQueryResult = this.getQueryResult(DictionaryType.Linguee);
        this.updateLingueeTranslation(lingueeQueryResult, oneLineTranslation);

        // * Check if need to display DeepL translation.
        newQueryResult.hideDisplay = !myPreferences.enableDeepLTranslate;
        logTrace("dataManager", `update deepL translation, disableDisplay: ${newQueryResult.hideDisplay}`);
      }

      // Youdao: when dictionary is enabled but translate is disabled,
      // hide the standalone translate section (result is used by dictionary only).
      if (
        type === TranslationType.Youdao &&
        myPreferences.enableYoudaoDictionary &&
        !myPreferences.enableYoudaoTranslate
      ) {
        newQueryResult.hideDisplay = true;
      }
      this.updateQueryResultAndSections(newQueryResult);
    }
  }

  /**
   * Update Linguee translation.
   *
   * @param translatedText the translation to update Linguee translation. if translatedText is empty, means use DeepL translation.
   */
  private updateLingueeTranslation(lingueeQueryResult: QueryResult | undefined, translatedText?: string) {
    if (!lingueeQueryResult) {
      return;
    }

    const lingueeDisplaySections = lingueeQueryResult.displaySections;
    if (lingueeDisplaySections?.length) {
      const firstLingueeDisplayItem = lingueeDisplaySections[0].items[0];
      if (!translatedText) {
        const deepLQueryResult = this.getQueryResult(TranslationType.DeepL);
        const deepLTranslation = deepLQueryResult?.sourceResult.oneLineTranslation;
        if (deepLTranslation) {
          firstLingueeDisplayItem.title = deepLTranslation;
        }
      } else {
        firstLingueeDisplayItem.title = translatedText;
        firstLingueeDisplayItem.copyText = translatedText;
      }
      logTrace("dataManager", `update linguee translation: ${firstLingueeDisplayItem.title}`);
    }
  }

  /**
   * Update dictionary translation.
   *
   * * Only dictionaryDisplaySections length > 1, enable update
   */
  private updateDictionaryTranslation(dictionaryQueryResult: QueryResult, translations: string[]) {
    const translatedText = translations.join(", ");
    logTrace("dataManager", `try updateDictionaryTranslation: ${translatedText}`);

    const dictionaryDisplaySections = dictionaryQueryResult.displaySections;
    if (dictionaryDisplaySections?.length) {
      if (dictionaryDisplaySections.length < 2) {
        return;
      }

      const firstDictionaryDisplayItem = dictionaryDisplaySections[0].items[0];
      firstDictionaryDisplayItem.title = translatedText;
      firstDictionaryDisplayItem.copyText = translatedText;
      logTrace("dataManager", `update dictionary translation: ${translatedText}`);
    }
  }

  /**
   * Try to update Youdao dictionary translation, if exist.
   */
  private updateYoudaoDictionaryTranslation(translations: string[]) {
    logTrace("try updateYoudaoDictionaryTranslation", translations.join("\n"));

    const youdaoDictionaryResult = this.getQueryResult(DictionaryType.Youdao);
    if (youdaoDictionaryResult) {
      this.updateDictionaryTranslation(youdaoDictionaryResult, translations);
    }
  }

  /**
   * Update Dictionary type section title.
   *
   * 1. Add fromTo language to each `Dictionary` section title.
   * 2. Add fromTo language to the `Translation` section title, only if preivious section is not translation section.
   */
  private updateTypeSectionTitle() {
    let isPreviousSectionTranslationType = false;
    this.queryResults.forEach((queryResult) => {
      const { type, sourceResult, displaySections } = queryResult;
      const isDictionaryType = checkIsDictionaryType(type);
      const isTranslationType = checkIsTranslationType(type);

      if (sourceResult && displaySections?.length) {
        const displaySection = displaySections[0];
        const wordInfo = sourceResult.queryWordInfo;
        const onlyShowEmoji = this.isShowDetail;
        const fromTo = getFromToLanguageTitle(wordInfo.fromLanguage, wordInfo.toLanguage, onlyShowEmoji);
        const simpleSectionTitle = `${sourceResult.type}`;
        const fromToSectionTitle = `${simpleSectionTitle}   (${fromTo})`;
        let sectionTitle = simpleSectionTitle;
        if (isTranslationType) {
          if (!isPreviousSectionTranslationType) {
            sectionTitle = fromToSectionTitle;
          }
          isPreviousSectionTranslationType = true;
        } else {
          if (isDictionaryType) {
            sectionTitle = fromToSectionTitle;
          }
          isPreviousSectionTranslationType = false;
        }
        displaySection.sectionTitle = sectionTitle;
      }
    });
  }

  /**
   * Download word audio and play it.
   *
   * if is dictionary, and enable automatic play audio and query is word, then download audio and play it.
   */
  private downloadAndPlayWordAudio(queryTypeResult: QueryTypeResult) {
    logTrace("dataManager", `downloadAndPlayWordAudio: ${queryTypeResult.type}`);
    const wordInfo = queryTypeResult.queryWordInfo;
    const isDictionaryType = checkIsDictionaryType(queryTypeResult.type);
    const isEnglishLanguage = wordInfo.fromLanguage === englishLanguageItem.youdaoLangCode;
    const enableAutomaticDownloadAudio =
      myPreferences.enableAutomaticPlayWordAudio && wordInfo.isWord && isEnglishLanguage;
    if (isDictionaryType && enableAutomaticDownloadAudio && this.isLastQuery && !this.hasPlayedAudio) {
      // Some Youdao web word audio is not accurate, so if not found word audio url from Youdao dictionary, then directly use say command.
      setTimeout(() => {
        // To avoid blocking UI, delay playing audio.
        playYoudaoWordAudioAfterDownloading(wordInfo);
        this.hasPlayedAudio = true;
      }, 50);
    }
  }

  /**
   * Get query result according query type from queryResults.
   */
  private getQueryResult(queryType: QueryType) {
    for (const result of this.queryResults) {
      if (queryType === result.type) {
        return result;
      }
    }
  }
}
