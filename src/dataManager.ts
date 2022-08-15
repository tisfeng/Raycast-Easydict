/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-15 10:43
 * @fileName: dataManager.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { detectLanguage } from "./detectLanauge/detect";
import { LanguageDetectTypeResult } from "./detectLanauge/types";
import { rquestLingueeDictionary } from "./dict/linguee/linguee";
import { formatLingueeDisplaySections, hasLingueeDictionaryEntries } from "./dict/linguee/parse";
import { LingueeDictionaryResult } from "./dict/linguee/types";
import { hasYoudaoDictionaryEntries, updateYoudaoDictionaryDisplay } from "./dict/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoDictionary } from "./dict/youdao/request";
import { QueryWordInfo, YoudaoDictionaryFormatResult } from "./dict/youdao/types";
import { getAutoSelectedTargetLanguageItem, getLanguageItemFromYoudaoId } from "./language/languages";
import { LanguageItem } from "./language/type";
import { myPreferences } from "./preferences";
import { appleTranslate } from "./scripts";
import { requestBaiduTextTranslate } from "./translation/baidu";
import { requestCaiyunTextTranslate } from "./translation/caiyun";
import { requestDeepLTextTranslate as requestDeepLTranslate } from "./translation/deepL";
import { requestGoogleTranslate } from "./translation/google";
import { requestTencentTranslate } from "./translation/tencent";
import {
  AbortObject,
  DicionaryType,
  DisplaySection,
  ListDisplayItem,
  QueryResult,
  QueryType,
  RequestErrorInfo,
  RequestTypeResult,
  TranslationItem,
  TranslationType,
} from "./types";
import { getSortOrder, isTranslationTooLong } from "./utils";

// Todo: need to optimize.
const sortOrder = getSortOrder();

/**
 * The data manager is used to manage the data.
 *
 * Todo: need to optimize.
 * - data manager.
 * - data request.
 * - data handle.
 */
export class DataManager {
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
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayRequestTime = 600;

  isShowDetail = false;

  hasPlayAudio = false;

  abortObject: AbortObject = {
    abortController: new AbortController(),
  };

  /**
   * Used for recording all the query types. If start a new query, push it to the array, when finish the query, remove it.
   */
  queryRecordList: QueryType[] = [];

  /**
   * Update query result and display sections.
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
  updateQueryResult(queryResult: QueryResult) {
    this.queryResults.push(queryResult);
    this.sortQueryResults();
    this.updateTypeSectionTitle();
  }

  /**
   * Update display sections, and callback update display sections.
   */
  private updateDataDisplaySections() {
    this.isShowDetail = this.checkIfShowTranslationDetail();

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
   * Query text, automatically detect the language of input text
   */
  queryText(text: string, toLanguage: string) {
    console.log("start queryText: " + text);
    this.updateLoadingState(true);
    this.resetProperties();

    // Todo: need to optimize. Eable to cancel language detect.
    detectLanguage(text, (detectedLanguageResult) => {
      console.log(
        `---> final confirmed: ${detectedLanguageResult.confirmed}, type: ${detectedLanguageResult.type}, detectLanguage: ${detectedLanguageResult.youdaoLanguageId}`
      );

      // * It takes time to detect the language, in the meantime, the user may have cancelled the query.
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
      targetLanguageId = targetLanguageItem.youdaoLanguageId;
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
   * * Note: please do not change this function.
   */
  queryTextWithTextInfo(queryWordInfo: QueryWordInfo) {
    this.queryWordInfo = queryWordInfo;

    const { word: queryText, fromLanguage, toLanguage } = queryWordInfo;
    console.log(`---> query text: ${queryText}`);
    console.log(`---> query fromTo: ${fromLanguage} -> ${toLanguage}`);

    this.queryLingueeDictionary(queryWordInfo, this.abortObject.abortController.signal);
    this.queryYoudaoDictionary(queryWordInfo, this.abortObject.abortController.signal);

    // * DeepL translate is used as part of Linguee dictionary.
    if (myPreferences.enableDeepLTranslate && !myPreferences.enableLingueeDictionary) {
      this.queryDeepLTranslate(queryWordInfo, this.abortObject.abortController.signal);
    }

    this.queryGoogleTranslate(queryWordInfo, this.abortObject.abortController.signal);
    this.queryAppleTranslate(queryWordInfo, this.abortObject);
    this.queryBaiduTranslate(queryWordInfo, this.abortObject.abortController.signal);
    this.queryTencentTranslate(queryWordInfo, this.abortObject.abortController.signal);
    this.queryCaiyunTranslate(queryWordInfo, this.abortObject.abortController.signal);

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
    this.abortObject.abortController = new AbortController();
  }

  /**
   * Query Linguee dictionary.
   *
   * For better UI, we use DeepL translate result as Linguee translation result.
   */
  private queryLingueeDictionary(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
    if (myPreferences.enableLingueeDictionary) {
      const type = DicionaryType.Linguee;
      this.addQueryToRecordList(type);

      rquestLingueeDictionary(queryWordInfo, signal)
        .then((lingueeTypeResult) => {
          const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);
          if (lingueeDisplaySections.length === 0) {
            return;
          }

          const wordInfo = this.getWordInfoFromDisplaySections(lingueeDisplaySections);
          const queryResult: QueryResult = {
            type: type,
            displaySections: lingueeDisplaySections,
            sourceResult: lingueeTypeResult,
            wordInfo: wordInfo,
          };

          // it will update Linguee dictionary section after updating Linguee translation.
          this.updateLingueeTranslation(queryResult);
          // this.updateQueryDisplayResults(queryResult);
          this.downloadAndPlayWordAudio(wordInfo);
        })
        .catch((error) => {
          this.showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
          this.updateDataDisplaySections();
        });

      // at the same time, query DeepL translate.
      this.queryDeepLTranslate(queryWordInfo, signal);
    }
  }

  /**
   * Query DeepL translate. If has enabled Linguee dictionary, don't need to query DeepL.
   */
  private queryDeepLTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
    const type = TranslationType.DeepL;
    this.addQueryToRecordList(type);

    requestDeepLTranslate(queryWordInfo, signal)
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

        this.showErrorInfoToast(error);
      })
      .finally(() => {
        this.removeQueryFromRecordList(type);
      });
  }

  /**
   * Query Youdao dictionary.
   */
  private queryYoudaoDictionary(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
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

      requestYoudaoDictionary(queryWordInfo, signal)
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
          const wordInfo = this.getWordInfoFromDisplaySections(youdaoDisplaySections);
          const displayResult: QueryResult = {
            type: displayType,
            sourceResult: youdaoTypeResult,
            displaySections: youdaoDisplaySections,
            wordInfo: wordInfo,
          };

          if (displayType === TranslationType.Youdao) {
            this.updateTranslationDisplay(displayResult);
            return;
          }

          this.updateQueryResultAndSections(displayResult);
          this.downloadAndPlayWordAudio(wordInfo);
        })
        .catch((error) => {
          this.showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query google translate.
   */
  private queryGoogleTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
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
          this.showErrorInfoToast(error);
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
            const appleTranslateResult: RequestTypeResult = {
              type: type,
              result: { translatedText: translatedText },
              translations: translations,
            };
            const queryResult: QueryResult = {
              type: type,
              sourceResult: appleTranslateResult,
            };
            this.updateTranslationDisplay(queryResult);
          }
        })
        .catch((error) => {
          this.showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query baidu translate API.
   */
  private queryBaiduTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
    if (myPreferences.enableBaiduTranslate) {
      const type = TranslationType.Baidu;
      this.addQueryToRecordList(type);

      requestBaiduTextTranslate(queryWordInfo, signal)
        .then((baiduTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: baiduTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          this.showErrorInfoToast(err);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query tencent translate.
   */
  private queryTencentTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
    if (myPreferences.enableTencentTranslate) {
      const type = TranslationType.Tencent;
      this.addQueryToRecordList(type);

      requestTencentTranslate(queryWordInfo, signal)
        .then((tencentTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: tencentTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          this.showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Query caiyun translate.
   */
  private queryCaiyunTranslate(queryWordInfo: QueryWordInfo, signal: AbortSignal) {
    if (myPreferences.enableCaiyunTranslate) {
      const type = TranslationType.Caiyun;
      this.addQueryToRecordList(type);

      requestCaiyunTextTranslate(queryWordInfo, signal)
        .then((caiyunTypeResult) => {
          const queryResult: QueryResult = {
            type: type,
            sourceResult: caiyunTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          this.showErrorInfoToast(error);
        })
        .finally(() => {
          this.removeQueryFromRecordList(type);
        });
    }
  }

  /**
   * Show error toast according to errorInfo.
   */
  private showErrorInfoToast(errorInfo: RequestErrorInfo) {
    showToast({
      style: Toast.Style.Failure,
      title: `${errorInfo.type} Error: ${errorInfo.code || ""}`,
      message: errorInfo.message,
    });
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
    // this.queryRecordList.splice(this.queryRecordList.indexOf(type), 1);
    this.queryRecordList = this.queryRecordList.filter((queryType) => queryType !== type);

    const isLoadingState = this.queryRecordList.length > 0;
    this.updateLoadingState(isLoadingState);

    console.log(`---> query record list: [${this.queryRecordList}]`);
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
    const copyText = oneLineTranslation;
    // if (type === TranslationType.Google) {
    //   const googleResult = sourceResult.result as GoogleTranslateResult;
    //   copyText = JSON.stringify(googleResult, null, 4);
    // }

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
        wordInfo: this.getWordInfoFromDisplaySections(displaySections),
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
   *  format type translation result to markdown format.
   */
  formatTranslationToMarkdown(translations: string[], type: TranslationType) {
    const oneLineTranslation = translations.join("\n");
    if (oneLineTranslation.trim().length === 0) {
      return "";
    }

    const string = oneLineTranslation.replace(/\n/g, "\n\n");
    const markdown = `
  ## ${type}
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
      const index = sortOrder.indexOf(queryResult.type.toString().toLowerCase());
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
        const fromLanguageItem = getLanguageItemFromYoudaoId(wordInfo.fromLanguage);
        const toLanguageItem = getLanguageItemFromYoudaoId(wordInfo.toLanguage);

        const fromTo = `${fromLanguageItem.languageTitle}${fromLanguageItem.emoji} --> ${toLanguageItem.languageTitle}${toLanguageItem.emoji}`;
        let sectionTitle = `${sourceResult.type}`;
        const isShowingTranslationFromTo = isFirstTranslation && isTranslationType && !this.isShowDetail;
        if (isDictionaryType || isShowingTranslationFromTo) {
          sectionTitle = `${sourceResult.type}   (${fromTo})`;
          if (isShowingTranslationFromTo) {
            isFirstTranslation = false;
          }
        }
        displaySection.sectionTitle = sectionTitle;
      }
    });
  }
  /**
   * Get word info from displaySections.
   *
   * First, get wordInfo from the first item of the first section. If displaySections is empty, return current query word info.
   */
  getWordInfoFromDisplaySections(displaySections: DisplaySection[]): QueryWordInfo {
    if (displaySections.length) {
      const displaySection = displaySections[0];
      if (displaySection.items.length) {
        const wordInfo = displaySection.items[0].queryWordInfo;
        return wordInfo;
      }
    }
    return this.queryWordInfo;
  }

  /**
   * Get valid dictionary type. valid means the dictionary result is not empty.
   */
  getValidDictionaryTypes(): DicionaryType[] {
    const dictionaryTypes: DicionaryType[] = [];
    for (const queryResult of this.queryResults) {
      const dictionaryType = queryResult.type;
      const isDictionaryType = Object.values(DicionaryType).includes(dictionaryType as DicionaryType);
      if (isDictionaryType) {
        const sourceResult = queryResult.sourceResult;
        if (sourceResult && sourceResult.result) {
          dictionaryTypes.push(queryResult.type as DicionaryType);
        }
      }
    }
    return dictionaryTypes;
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
   * Check if need to cancel or clear query.
   */
  private checkIfNeedCancelDisplay() {
    console.log(`---> check if last query: ${this.isLastQuery}, should clear: ${this.shouldClearQuery}`);
    if (!this.isLastQuery || this.shouldClearQuery) {
      return true;
    }
    return false;
  }

  /**
   * Cancel current query.
   */
  private cancelCurrentQuery() {
    console.warn(`---> cancel current query`);
    this.abortObject.abortController.abort();
    this.abortObject.childProcess?.kill();
  }

  /**
   * Clear query result.
   */
  clearQueryResult() {
    console.log(`---> clear query result`);

    this.cancelCurrentQuery();

    this.isShowDetail = false;
    this.shouldClearQuery = true;
    this.isLastQuery = false;
    this.updateLoadingState(false);

    this.queryRecordList = [];
    this.queryResults = [];
    this.updateListDisplaySections([]);
  }
}
