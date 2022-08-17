/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-17 17:54
 * @fileName: dataManager.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment } from "@raycast/api";
import axios from "axios";
import { detectLanguage } from "../detectLanauge/detect";
import { LanguageDetectTypeResult } from "../detectLanauge/types";
import { rquestLingueeDictionary } from "../dict/linguee/linguee";
import { formatLingueeDisplaySections, hasLingueeDictionaryEntries } from "../dict/linguee/parse";
import { LingueeDictionaryResult } from "../dict/linguee/types";
import { hasYoudaoDictionaryEntries, updateYoudaoDictionaryDisplay } from "../dict/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoDictionary } from "../dict/youdao/request";
import { QueryWordInfo, YoudaoDictionaryFormatResult } from "../dict/youdao/types";
import { getAutoSelectedTargetLanguageItem, getLanguageItemFromYoudaoId } from "../language/languages";
import { LanguageItem } from "../language/type";
import { myPreferences } from "../preferences";
import { appleTranslate } from "../scripts";
import { requestBaiduTextTranslate } from "../translation/baidu";
import { requestCaiyunTextTranslate } from "../translation/caiyun";
import { requestDeepLTextTranslate as requestDeepLTranslate } from "../translation/deepL";
import { requestGoogleTranslate } from "../translation/google";
import { requestTencentTranslate } from "../translation/tencent";
import {
  AbortObject,
  DicionaryType,
  DisplaySection,
  ListDisplayItem,
  QueryResult,
  QueryType,
  QueryTypeResult,
  TranslationItem,
  TranslationType,
} from "../types";
import { getSortOrder, isTranslationTooLong, showErrorInfoToast } from "./utils";

/**
 * Data manager.
 *
 * Todo: need to optimize.
 * - data manager.
 * - data request.
 * - data handle.
 */
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

  queryResults: QueryResult[] = [];
  sortOrder = getSortOrder();
  queryWordInfo = {} as QueryWordInfo; // later will must assign value

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
  hasPlayAudio = false;

  abortObject: AbortObject = {};

  delayQueryTimer?: NodeJS.Timeout;
  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayRequestTime = 600;

  /**
   * Used for recording all the query types. If start a new query, push it to the array, when finish the query, remove it.
   */
  queryRecordList: QueryType[] = [];

  /**
   * 1. Update query result.
   * 2. Update display sections.
   */
  updateQueryResultAndSections(queryResult: QueryResult) {
    this.updateQueryResult(queryResult);
    this.updateDataDisplaySections();
  }

  /**
   * update query result.
   *
   * 1.push new result to queryResults.
   * 2.sort queryResults.
   * 3.update dictionary section title.
   */
  private updateQueryResult(queryResult: QueryResult) {
    this.queryResults.push(queryResult);
    this.sortQueryResults();
  }

  /**
   * 1. Update isShowDetail。
   * 2. Update section title.
   * 3. Update displaySections
   * 4. callback updateListDisplaySections.
   */
  private updateDataDisplaySections() {
    this.isShowDetail = this.checkIfShowTranslationDetail();
    this.updateTypeSectionTitle();

    const displaySections: DisplaySection[][] = [];
    for (const result of this.queryResults) {
      const shouldDisplay = !result.disableDisplay;
      if (shouldDisplay && result.displaySections) {
        // console.log(`---> update display sections: ${result.type}, length: ${result.displaySections.length}`);
        this.updateTranslationMarkdown(result);
        displaySections.push(result.displaySections);
      }
    }
    this.updateListDisplaySections(displaySections.flat());
  }

  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayQueryText(text: string, toLanguage: string, isDelay: boolean) {
    const delayTime = isDelay ? this.delayRequestTime : 0;
    this.delayQueryTimer = setTimeout(() => {
      this.queryText(text, toLanguage);
    }, delayTime);
  }

  /**
   * Query text, automatically detect the language of input text
   */
  private queryText(text: string, toLanguage: string) {
    console.log("start queryText: " + text);

    this.updateLoadingState(true);
    this.resetProperties();

    // Todo: need to optimize. Enable to cancel language detect.
    // Todo: record all detect result, maybe can use it as translation result.
    detectLanguage(text, (detectedLanguageResult) => {
      console.log(
        `---> final confirmed: ${detectedLanguageResult.confirmed}, type: ${detectedLanguageResult.type}, detectLanguage: ${detectedLanguageResult.youdaoLanguageId}`
      );

      // * It takes time to detect the language, in the meantime, user may have cancelled the query.
      if (this.shouldClearQuery) {
        console.log(`---> query has been canceld`);
        this.updateLoadingState(false);
        return;
      }

      this.queryTextWithDetectedLanguage(text, toLanguage, detectedLanguageResult);
    });
  }

  /**
   * Query text with with detected language
   */
  private queryTextWithDetectedLanguage(text: string, toLanguage: string, detectedLanguage: LanguageDetectTypeResult) {
    const fromYoudaoLanguageId = detectedLanguage.youdaoLanguageId;
    console.log("queryTextWithFromLanguageId:", fromYoudaoLanguageId);
    this.updateCurrentFromLanguageItem(getLanguageItemFromYoudaoId(fromYoudaoLanguageId));

    // priority to use user selected target language, if conflict, use auto selected target language
    let targetLanguageId = toLanguage;
    console.log("userSelectedTargetLanguage:", targetLanguageId);
    if (fromYoudaoLanguageId === targetLanguageId) {
      const targetLanguageItem = getAutoSelectedTargetLanguageItem(fromYoudaoLanguageId);
      this.updateAutoSelectedTargetLanguageItem(targetLanguageItem);
      targetLanguageId = targetLanguageItem.youdaoId;
      console.log("---> conflict, use autoSelectedTargetLanguage: ", targetLanguageId);
    }

    const queryTextInfo: QueryWordInfo = {
      word: text,
      fromLanguage: fromYoudaoLanguageId,
      toLanguage: targetLanguageId,
    };
    this.queryTextWithTextInfo(queryTextInfo);
  }

  /**
   * Query text with text info, query dictionary API or translate API.
   *
   * * Note: please do not change this function pararm.
   */
  queryTextWithTextInfo(queryWordInfo: QueryWordInfo) {
    this.queryWordInfo = queryWordInfo;
    this.resetProperties();

    const { word: queryText, fromLanguage, toLanguage } = queryWordInfo;
    console.log(`---> query text: ${queryText}`);
    console.log(`---> query fromTo: ${fromLanguage} -> ${toLanguage}`);

    this.queryLingueeDictionary(queryWordInfo);
    this.queryYoudaoDictionary(queryWordInfo);

    // * DeepL translate is used as part of Linguee dictionary.
    if (myPreferences.enableDeepLTranslate && !myPreferences.enableLingueeDictionary) {
      this.queryDeepLTranslate(queryWordInfo);
    }

    // We need to pass a abort signal, becase google translate is used "got" to request, not axios.
    this.queryGoogleTranslate(queryWordInfo, this.abortObject.abortController?.signal);
    this.queryAppleTranslate(queryWordInfo, this.abortObject);
    this.queryBaiduTranslate(queryWordInfo);
    this.queryTencentTranslate(queryWordInfo);
    this.queryCaiyunTranslate(queryWordInfo);

    // If no query, stop loading.
    if (this.queryRecordList.length === 0) {
      this.updateLoadingState(false);
    }
  }

  /**
   * Rest properyies before each query.
   */
  private resetProperties() {
    this.hasPlayAudio = false;
    this.isLastQuery = true;
    this.shouldClearQuery = false;
    this.queryRecordList = [];

    const abortController = new AbortController();
    this.abortObject.abortController = abortController;
    axios.defaults.signal = abortController.signal;
  }

  /**
   * Query Linguee dictionary.
   *
   * For better UI, we use DeepL translate result as Linguee translation result.
   */
  private queryLingueeDictionary(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableLingueeDictionary) {
      const type = DicionaryType.Linguee;
      this.addQueryToRecordList(type);

      rquestLingueeDictionary(queryWordInfo)
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

          // it will update Linguee dictionary section after updating Linguee translation.
          this.updateLingueeTranslation(queryResult);
          // this.updateQueryDisplayResults(queryResult);
          this.downloadAndPlayWordAudio(lingueeTypeResult.wordInfo);
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
          this.updateDataDisplaySections();
        });

      // at the same time, query DeepL translate.
      this.queryDeepLTranslate(queryWordInfo);
    }
  }

  /**
   * Query DeepL translate. If has enabled Linguee dictionary, don't need to query DeepL.
   */
  private queryDeepLTranslate(queryWordInfo: QueryWordInfo) {
    const type = TranslationType.DeepL;
    this.addQueryToRecordList(type);

    requestDeepLTranslate(queryWordInfo)
      .then((deepLTypeResult) => {
        const queryResult: QueryResult = {
          type: type,
          sourceResult: deepLTypeResult,
        };
        this.updateTranslationDisplay(queryResult);
      })
      .catch((error) => {
        if (!myPreferences.enableDeepLTranslate) {
          return;
        }

        showErrorInfoToast(error);
      })
      .finally(() => {
        this.removeQueryFromRecordList(type);
      });
  }

  /**
   * Query Youdao dictionary.
   */
  private queryYoudaoDictionary(queryWordInfo: QueryWordInfo) {
    // * Youdao dictionary only support chinese <--> english.
    const youdaoDictionarySet = new Set(["zh-CHS", "zh-CHT", "en"]);
    const isValidYoudaoDictionaryQuery =
      youdaoDictionarySet.has(queryWordInfo.fromLanguage) && youdaoDictionarySet.has(queryWordInfo.toLanguage);
    const enableYoudaoDictionary = myPreferences.enableYoudaoDictionary && isValidYoudaoDictionaryQuery;
    const enableYoudaoTranslate = myPreferences.enableYoudaoTranslate;
    console.log(`---> enable Youdao Dictionary: ${enableYoudaoDictionary}, Translate: ${enableYoudaoTranslate}`);
    if (enableYoudaoDictionary || enableYoudaoTranslate) {
      const type = DicionaryType.Youdao;
      this.addQueryToRecordList(type);

      requestYoudaoDictionary(queryWordInfo)
        .then((youdaoTypeResult) => {
          console.log(`---> youdao result: ${JSON.stringify(youdaoTypeResult.result, null, 2)}`);

          const formatYoudaoResult = youdaoTypeResult.result as YoudaoDictionaryFormatResult;
          const youdaoDisplaySections = updateYoudaoDictionaryDisplay(formatYoudaoResult);
          const showYoudaoDictionary = hasYoudaoDictionaryEntries(formatYoudaoResult);
          console.log(`---> showYoudaoDictionary: ${showYoudaoDictionary}`);

          let displayType;
          if (enableYoudaoTranslate) {
            displayType = TranslationType.Youdao;
          }
          if (enableYoudaoDictionary && showYoudaoDictionary) {
            displayType = DicionaryType.Youdao;
          }
          if (displayType === undefined) {
            console.log("---> no display, return");
            return;
          }
          console.log(`---> type: ${displayType}`);

          youdaoTypeResult.type = displayType;
          const displayResult: QueryResult = {
            type: displayType,
            sourceResult: youdaoTypeResult,
            displaySections: youdaoDisplaySections,
          };

          if (displayType === TranslationType.Youdao) {
            this.updateTranslationDisplay(displayResult);
            return;
          }

          this.updateQueryResultAndSections(displayResult);
          this.downloadAndPlayWordAudio(youdaoTypeResult.wordInfo);
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query google translate.
   */
  private queryGoogleTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal | undefined) {
    if (myPreferences.enableGoogleTranslate) {
      const type = TranslationType.Google;
      this.addQueryToRecordList(type);

      requestGoogleTranslate(queryWordInfo, signal)
        .then((googleTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: googleTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query apple translate.
   */
  private queryAppleTranslate(queryWordInfo: QueryWordInfo, abortObject: AbortObject) {
    if (myPreferences.enableAppleTranslate) {
      const type = TranslationType.Apple;
      this.addQueryToRecordList(type);

      appleTranslate(queryWordInfo, abortObject)
        .then((translatedText) => {
          if (translatedText) {
            // * Note: apple translateText contains redundant blank line, we need to remove it.
            const translations = translatedText.split("\n").filter((line) => line.length > 0);
            const appleTranslateResult: QueryTypeResult = {
              type: type,
              result: { translatedText: translatedText },
              translations: translations,
              wordInfo: queryWordInfo,
            };
            const queryResult: QueryResult = {
              type: type,
              sourceResult: appleTranslateResult,
            };
            this.updateTranslationDisplay(queryResult);
          }
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query baidu translate API.
   */
  private queryBaiduTranslate(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableBaiduTranslate) {
      const type = TranslationType.Baidu;
      this.addQueryToRecordList(type);

      requestBaiduTextTranslate(queryWordInfo)
        .then((baiduTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: baiduTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          showErrorInfoToast(err);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query tencent translate.
   */
  private queryTencentTranslate(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableTencentTranslate) {
      const type = TranslationType.Tencent;
      this.addQueryToRecordList(type);

      requestTencentTranslate(queryWordInfo)
        .then((tencentTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: tencentTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query caiyun translate.
   */
  private queryCaiyunTranslate(queryWordInfo: QueryWordInfo) {
    if (myPreferences.enableCaiyunTranslate) {
      const type = TranslationType.Caiyun;
      this.addQueryToRecordList(type);

      requestCaiyunTextTranslate(queryWordInfo)
        .then((caiyunTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: caiyunTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
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

    const isLoadingState = this.queryRecordList.length > 0;
    this.updateLoadingState(isLoadingState);
  }

  /**
   * Update the translation display.
   *
   * * If sourceResult.result exist, then will call this.updateRequestDisplayResults()
   */
  updateTranslationDisplay(queryResult: QueryResult) {
    const { type, sourceResult } = queryResult;
    console.log(`---> updateTranslationDisplay: ${queryResult.type}`);
    const oneLineTranslation = sourceResult.translations.map((translation) => translation).join(", ");
    sourceResult.oneLineTranslation = oneLineTranslation;
    let copyText = oneLineTranslation;

    // Debug: used for viewing long text log.
    if (environment.isDevelopment && type === TranslationType.Google) {
      const googleResult = sourceResult.result;
      copyText = JSON.stringify(googleResult, null, 4);
    }

    if (oneLineTranslation) {
      const displayItem: ListDisplayItem = {
        displayType: type,
        queryType: queryResult.type,
        key: `${oneLineTranslation}-${type}`,
        title: oneLineTranslation,
        copyText: copyText,
        queryWordInfo: this.queryWordInfo,
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
        const lingueeQueryResult = this.getQueryResult(DicionaryType.Linguee);
        this.updateLingueeTranslation(lingueeQueryResult, oneLineTranslation);

        // * Check if need to display DeepL translation.
        newQueryResult.disableDisplay = !myPreferences.enableDeepLTranslate;
        console.log(`---> update deepL transaltion, disableDisplay: ${newQueryResult.disableDisplay}`);
      }
      this.updateQueryResultAndSections(newQueryResult);
    }
  }

  /**
   * Update Linguee translation.
   *
   * @param translation the translation to update Linguee translation. if translation is empty, use DeepL translation.
   */
  private updateLingueeTranslation(lingueeQueryResult: QueryResult | undefined, translation?: string) {
    if (!lingueeQueryResult) {
      return;
    }

    const lingueeDisplaySections = lingueeQueryResult.displaySections;
    if (lingueeDisplaySections?.length) {
      const firstLingueeDisplayItem = lingueeDisplaySections[0].items[0];
      if (!translation) {
        const deepLQueryResult = this.getQueryResult(TranslationType.DeepL);
        const deepLTranslation = deepLQueryResult?.sourceResult.oneLineTranslation;
        if (deepLTranslation) {
          firstLingueeDisplayItem.title = deepLTranslation;
          console.log(
            `---> deepL translation: ${deepLTranslation}, disableDisplay: ${deepLQueryResult?.disableDisplay}`
          );
        }
      } else {
        firstLingueeDisplayItem.title = translation;
      }
      console.log(`---> linguee translation: ${firstLingueeDisplayItem.title}`);
      this.updateQueryResultAndSections(lingueeQueryResult);
    }
  }

  /**
   * Update translation markdown.
   */
  updateTranslationMarkdown(queryResult: QueryResult) {
    const { sourceResult, displaySections: displayResult } = queryResult;
    if (!sourceResult || !displayResult?.length) {
      return;
    }

    const translations = [] as TranslationItem[];
    for (const queryResults of this.queryResults) {
      const { type, sourceResult } = queryResults;
      const isTranslationType = Object.values(TranslationType).includes(type as TranslationType);
      if (sourceResult && isTranslationType) {
        const type = sourceResult.type as TranslationType;
        const markdownTranslation = this.formatTranslationToMarkdown(sourceResult.translations, type);
        translations.push({ type: type, text: markdownTranslation });
      }
    }
    // Traverse the translations array. If the type of translation element is equal to it, move it to the first of the array.
    for (let i = 0; i < translations.length; i++) {
      if (translations[i].type === queryResult.type) {
        const temp = translations[i];
        translations.splice(i, 1);
        translations.unshift(temp);
        break;
      }
    }
    const markdown = translations.map((translation) => translation.text).join("\n");
    // console.log(`---> type: ${queryResult.type},  markdown: ${markdown}`);

    const listDiplayItem = displayResult[0].items;
    if (listDiplayItem?.length) {
      listDiplayItem[0].translationMarkdown = markdown;
    }
  }

  /**
   * Format translation string to markdown.
   */
  formatTranslationToMarkdown(translations: string[], type: TranslationType) {
    const oneLineTranslation = translations.join("\n");
    if (oneLineTranslation.trim().length === 0) {
      return "";
    }

    const string = oneLineTranslation.replace(/\n/g, "\n\n");

    // Since language title is too long for detail page, so we use short google id.
    const wordInfo = this.getWordInfo(type);
    const fromTo = this.getLanguageFromToTitle(wordInfo.fromLanguage, wordInfo.toLanguage, true);

    const markdown = `
  ## ${type}   (${fromTo})
  ---  
  ${string}
  `;
    return markdown;
  }

  /**
   * Sort query results by designated order.
   *
   * * NOTE: this function will be called many times, because request results are async, so we need to sort every time.
   */
  sortQueryResults() {
    const queryResults: QueryResult[] = [];
    for (const queryResult of this.queryResults) {
      const index = this.sortOrder.indexOf(queryResult.type.toString().toLowerCase());
      queryResults[index] = queryResult;
      // console.log(`---> sort results: index: ${index}, ${queryResult.type}`);
    }
    // filter undefined, result is null.
    this.queryResults = queryResults.filter((queryResult) => {
      if (queryResult?.sourceResult?.result) {
        return true;
      }
    });
  }

  /**
   * Get query result according query type from queryResults.
   */
  getQueryResult(queryType: QueryType) {
    for (const result of this.queryResults) {
      if (queryType === result.type) {
        return result;
      }
    }
  }

  /**
   * Get word info according to query type.
   */
  getWordInfo(queryType: QueryType) {
    const queryResult = this.getQueryResult(queryType);
    return queryResult?.sourceResult.wordInfo ?? this.queryWordInfo;
  }

  /**
   * Update Dictionary type section title.
   *
   * 1. Add fromTo language to each dictionary section title.
   * 2. Add fromTo language to the first translation section title.
   */
  updateTypeSectionTitle() {
    let isFirstTranslation = true;
    this.queryResults.forEach((queryResult) => {
      const { type, sourceResult, displaySections } = queryResult;
      const isDictionaryType = Object.values(DicionaryType).includes(type as DicionaryType);
      const isTranslationType = Object.values(TranslationType).includes(type as TranslationType);

      if (sourceResult && displaySections?.length) {
        const displaySection = displaySections[0];
        const wordInfo = displaySection.items[0].queryWordInfo;
        const onlyShowEmoji = this.isShowDetail;
        const fromTo = this.getLanguageFromToTitle(wordInfo.fromLanguage, wordInfo.toLanguage, onlyShowEmoji);
        const simpleSectionTitle = `${sourceResult.type}`;
        const fromToSectionTitle = `${simpleSectionTitle}   (${fromTo})`;
        let sectionTitle = simpleSectionTitle;
        if (isTranslationType) {
          const isShowingTranslationFromTo = isFirstTranslation;
          if (isShowingTranslationFromTo) {
            sectionTitle = fromToSectionTitle;
          }
          isFirstTranslation = false;
        } else if (isDictionaryType) {
          sectionTitle = fromToSectionTitle;
        }
        displaySection.sectionTitle = sectionTitle;
      }
    });
  }

  /**
   * Get fromTo language title according from and to language id.  eg. zh-CHS --> en, return: Chinese-Simplified🇨🇳 --> English🇬🇧
   *
   * * Since language title is too long for detail page, so we use short emoji instead.  eg. zh-CHS --> en, return: 🇨🇳 --> 🇬🇧
   */
  getLanguageFromToTitle(from: string, to: string, onlyEmoji = false) {
    const fromLanguageItem = getLanguageItemFromYoudaoId(from);
    const toLanguageItem = getLanguageItemFromYoudaoId(to);
    const fromToEmoji = `${fromLanguageItem.emoji} --> ${toLanguageItem.emoji}`;
    const fromToLanguageNameAndEmoji = `${fromLanguageItem.englishName}${fromLanguageItem.emoji} --> ${toLanguageItem.englishName}${toLanguageItem.emoji}`;
    return onlyEmoji ? fromToEmoji : fromToLanguageNameAndEmoji;
  }

  /**
   * Check if show translation detail.
   *
   * Iterate QueryResult, if dictionary is not empty, and translation is too long, show translation detail.
   */
  checkIfShowTranslationDetail(): boolean {
    let isShowDetail = false;
    for (const queryResult of this.queryResults) {
      const isDictionaryType = Object.values(DicionaryType).includes(queryResult.type as DicionaryType);
      if (isDictionaryType) {
        // Todo: need to optimize. use wordInfo to check.
        const hasDictionaryEntries = this.checkIfDictionaryHasEntries(queryResult.type as DicionaryType);
        if (hasDictionaryEntries) {
          isShowDetail = false;
          break;
        }
      } else {
        // check if translation is too long
        const oneLineTranslation = queryResult.sourceResult?.oneLineTranslation || "";
        const toLanauge = this.queryWordInfo.toLanguage;
        const isTooLong = isTranslationTooLong(oneLineTranslation, toLanauge);
        if (isTooLong) {
          isShowDetail = true;
          break;
        }
      }
    }
    // console.log(`---> isShowDetail: ${isShowDetail}`);
    return isShowDetail;
  }

  /**
   * Check if dictionary has entries.
   */
  checkIfDictionaryHasEntries(dictionaryType: DicionaryType): boolean {
    const isDictionaryType = Object.values(DicionaryType).includes(dictionaryType);
    if (!isDictionaryType) {
      return false;
    }

    const dictionaryResult = this.getQueryResult(dictionaryType) as QueryResult;
    const sourceResult = dictionaryResult.sourceResult;

    let hasEntries = false;
    switch (dictionaryType) {
      case DicionaryType.Linguee: {
        hasEntries = hasLingueeDictionaryEntries(sourceResult.result as LingueeDictionaryResult);
        break;
      }
      case DicionaryType.Youdao: {
        hasEntries = hasYoudaoDictionaryEntries(sourceResult.result as YoudaoDictionaryFormatResult);
        break;
      }
    }
    return hasEntries;
  }

  /**
   * Download word audio and play it.
   *
   * if is dictionary, and enable automatic play audio and query is word, then download audio and play it.
   */
  private downloadAndPlayWordAudio(wordInfo: QueryWordInfo) {
    const enableAutomaticDownloadAudio = myPreferences.enableAutomaticPlayWordAudio && wordInfo?.isWord;
    if (enableAutomaticDownloadAudio && this.isLastQuery && !this.hasPlayAudio) {
      playYoudaoWordAudioAfterDownloading(wordInfo);
      this.hasPlayAudio = true;
    }
  }

  /**
   * Cancel current query.
   */
  private cancelCurrentQuery() {
    // console.warn(`---> cancel current query`);
    this.abortObject.abortController?.abort();
    this.abortObject.childProcess?.kill();
  }

  /**
   * Clear query result.
   */
  clearQueryResult() {
    // console.log(`---> clear query result`);

    this.cancelCurrentQuery();

    if (this.delayQueryTimer) {
      clearTimeout(this.delayQueryTimer);
    }

    this.isShowDetail = false;
    this.shouldClearQuery = true;
    this.isLastQuery = false;
    this.updateLoadingState(false);

    this.queryRecordList = [];
    this.queryResults = [];
    this.updateListDisplaySections([]);
  }
}
