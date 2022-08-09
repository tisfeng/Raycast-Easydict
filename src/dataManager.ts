/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-09 23:10
 * @fileName: dataManager.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { formatLingueeDisplaySections, rquestLingueeDictionary } from "./dict/linguee/linguee";
import { hasLingueeDictionaryEntries } from "./dict/linguee/parse";
import { LingueeDictionaryResult } from "./dict/linguee/types";
import { hasYoudaoDictionaryEntries, updateYoudaoDictionaryDisplay } from "./dict/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoDictionary } from "./dict/youdao/request";
import { QueryWordInfo, YoudaoDictionaryFormatResult } from "./dict/youdao/types";
import { getLanguageItemFromYoudaoId } from "./language/languages";
import { myPreferences } from "./preferences";
import { appleTranslate } from "./scripts";
import { requestBaiduTextTranslate } from "./translation/baidu";
import { requestCaiyunTextTranslate } from "./translation/caiyun";
import { requestDeepLTextTranslate } from "./translation/deepL";
import { requestGoogleTranslate } from "./translation/google";
import { requestTencentTextTranslate } from "./translation/tencent";
import {
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

const sortOrder = getSortOrder();

export class DataManager {
  updateDisplaySections?: (displaySections: DisplaySection[]) => void;
  queryResults: QueryResult[] = [];
  queryWordInfo?: QueryWordInfo;

  /**
   * when has new input text, need to cancel previous request.
   */
  isLastQuery = true;
  /**
   * when input text is empty, need to cancel previous request, and clear result.
   */
  shouldClearQuery = true;

  controller = new AbortController();

  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayRequestTime = 600;

  isShowDetail = false;

  hasPlayAudio = false;

  /**
   * update display result.
   *
   * 1.push new result to queryResults.
   * 2.sort queryResults.
   * 3.update dictionary section title.
   * 4.callback update display sections.
   */
  updateQueryDisplayResults(queryResult: QueryResult) {
    this.queryResults.push(queryResult);
    this.sortQueryResults();
    this.isShowDetail = this.checkIfShowTranslationDetail();
    this.updateAllSectionTitle();

    const displaySections: DisplaySection[][] = [];
    for (const result of this.queryResults) {
      if (result.displaySections) {
        console.log(`---> update display sections: ${result.type}, length: ${result.displaySections.length}`);
        this.updateTranslationMarkdown(result);
        displaySections.push(result.displaySections);
      }
    }
    if (this.updateDisplaySections) {
      this.updateDisplaySections(displaySections.flat());
    }
  }

  /**
   * Query text with text info, query dictionary API or translate API.
   */
  queryTextWithTextInfo(queryWordInfo: QueryWordInfo) {
    // clear old results before new query
    this.clearQueryResult();

    // set new query params
    this.queryWordInfo = queryWordInfo;
    this.hasPlayAudio = false;
    this.isLastQuery = true;
    this.shouldClearQuery = false;
    this.controller = new AbortController();

    const { word: queryText, fromLanguage, toLanguage } = queryWordInfo;
    console.log(`---> query text: ${queryText}`);
    console.log(`---> query fromTo: ${fromLanguage} -> ${toLanguage}`);

    if (myPreferences.enableLingueeDictionary) {
      rquestLingueeDictionary(queryWordInfo, this.controller.signal)
        .then((lingueeTypeResult) => {
          const lingueeDisplaySections = formatLingueeDisplaySections(lingueeTypeResult);
          if (lingueeDisplaySections.length === 0) {
            return;
          }

          const type = DicionaryType.Linguee;
          const wordInfo = this.getWordInfoFromDisplaySections(lingueeDisplaySections);
          const queryResult: QueryResult = {
            type: type,
            displaySections: lingueeDisplaySections,
            sourceResult: lingueeTypeResult,
            wordInfo: wordInfo,
          };
          this.updateQueryDisplayResults(queryResult);
          this.downloadAndPlayWordAudio(wordInfo);
        })
        .catch((error) => {
          console.error("lingueeDictionaryResult error:", error);
          const errorInfo = error as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `Linguee: ${errorInfo.code}`,
            message: errorInfo.message,
          });
        });
    }

    // * Youdao dictionary only support chinese <--> english.
    const youdaoDictionarySet = new Set(["zh-CHS", "zh-CHT", "en"]);
    const isValidYoudaoDictionaryQuery = youdaoDictionarySet.has(fromLanguage) && youdaoDictionarySet.has(toLanguage);
    const enableYoudaoDictionary = myPreferences.enableYoudaoDictionary && isValidYoudaoDictionaryQuery;
    const enableYoudaoTranslate = myPreferences.enableYoudaoTranslate;
    console.log(`---> enable Youdao Dictionary: ${enableYoudaoDictionary}, Translate: ${enableYoudaoTranslate}`);
    if (enableYoudaoDictionary || enableYoudaoTranslate) {
      requestYoudaoDictionary(queryWordInfo, this.controller.signal)
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

          this.updateQueryDisplayResults(displayResult);
          this.downloadAndPlayWordAudio(wordInfo);
        })
        .catch((error) => {
          console.error("youdaoDictionaryResult error:", error);
          const errorInfo = error as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `${errorInfo.type}: ${errorInfo.code}`,
            message: errorInfo.message,
          });
        });
    }

    if (myPreferences.enableDeepLTranslate) {
      requestDeepLTextTranslate(queryWordInfo, this.controller.signal)
        .then((deepLTypeResult) => {
          const queryResult: QueryResult = {
            type: TranslationType.DeepL,
            sourceResult: deepLTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((error) => {
          const errorInfo = error as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `${errorInfo.type}: ${errorInfo.code}`,
            message: errorInfo.message,
          });
        });
    }

    // check if enable google translate
    if (myPreferences.enableGoogleTranslate) {
      requestGoogleTranslate(queryWordInfo, this.controller.signal)
        .then((googleTypeResult) => {
          const queryResult: QueryResult = {
            type: TranslationType.Google,
            sourceResult: googleTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          console.error(`google error: ${JSON.stringify(err, null, 2)}`);
        });
    }

    // check if enable apple translate
    if (myPreferences.enableAppleTranslate) {
      appleTranslate(this.queryWordInfo)
        .then((translatedText) => {
          if (this.checkIfNeedCancelDisplay()) {
            this.cancelCurrentQuery();
            return;
          }

          if (translatedText) {
            // * Note: apple translateText contains redundant blank line, we need to remove it.
            const translations = translatedText.split("\n").filter((line) => line.length > 0);
            const appleTranslateResult: RequestTypeResult = {
              type: TranslationType.Apple,
              result: { translatedText: translatedText },
              translations: translations,
            };
            const queryResult: QueryResult = {
              type: TranslationType.Apple,
              sourceResult: appleTranslateResult,
            };
            this.updateTranslationDisplay(queryResult);
          }
        })
        .catch((error) => {
          const errorInfo = error as RequestErrorInfo;
          console.error(`Apple translate error: ${JSON.stringify(errorInfo, null, 4)}`);
        });
    }

    // check if enable baidu translate
    if (myPreferences.enableBaiduTranslate) {
      requestBaiduTextTranslate(queryWordInfo, this.controller.signal)
        .then((baiduTypeResult) => {
          const queryResult: QueryResult = {
            type: TranslationType.Baidu,
            sourceResult: baiduTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          const errorInfo = err as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `${errorInfo.type}: ${errorInfo.code}`,
            message: errorInfo.message,
          });
        });
    }

    // check if enable tencent translate
    if (myPreferences.enableTencentTranslate) {
      requestTencentTextTranslate(queryWordInfo)
        .then((tencentTypeResult) => {
          if (this.checkIfNeedCancelDisplay()) {
            this.cancelCurrentQuery();
            console.log("---> Tencent isLastQuery is false, return");
            return;
          }

          const queryResult: QueryResult = {
            type: TranslationType.Tencent,
            sourceResult: tencentTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          const errorInfo = err as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `tencent translate error`,
            message: errorInfo.message,
          });
        });
    }

    // check if enable caiyun translate
    if (myPreferences.enableCaiyunTranslate) {
      requestCaiyunTextTranslate(queryWordInfo, this.controller.signal)
        .then((caiyunTypeResult) => {
          const queryResult: QueryResult = {
            type: TranslationType.Caiyun,
            sourceResult: caiyunTypeResult,
          };
          this.updateTranslationDisplay(queryResult);
        })
        .catch((err) => {
          const errorInfo = err as RequestErrorInfo;
          showToast({
            style: Toast.Style.Failure,
            title: `Caiyun translate error`,
            message: errorInfo.message,
          });
        });
    }
  }

  /**
   * Update the translation display.
   *
   * * If sourceResult.result exist, then will call this.updateRequestDisplayResults()
   */
  updateTranslationDisplay(queryResult: QueryResult) {
    console.log(`---> updateTranslationDisplay: ${queryResult.type}`);

    const { type, sourceResult } = queryResult;
    let oneLineTranslations = "";
    if (!sourceResult) {
      return;
    }

    console.log("---> translations:", sourceResult.translations);
    oneLineTranslations = sourceResult.translations.map((translation) => translation).join(", ");
    console.log(`---> oneLineTranslations: ${oneLineTranslations}`);
    sourceResult.oneLineTranslation = oneLineTranslations;
    if (oneLineTranslations) {
      const displayItem: ListDisplayItem = {
        displayType: type,
        queryType: queryResult.type,
        key: `${oneLineTranslations}-${type}`,
        title: oneLineTranslations,
        copyText: oneLineTranslations,
        queryWordInfo: this.queryWordInfo as QueryWordInfo,
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
      this.updateQueryDisplayResults(newQueryResult);
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
   * 2. Add fromTo language to the first translation section title. (only when dictionary result is empyt)
   */
  updateAllSectionTitle() {
    this.queryResults.forEach((queryResult, i) => {
      const { type, sourceResult, displaySections } = queryResult;
      const isDictionaryType = Object.values(DicionaryType).includes(type as DicionaryType);
      const isTranslationType = Object.values(TranslationType).includes(type as TranslationType);

      if (sourceResult && displaySections?.length) {
        const displaySection = displaySections[0];
        const wordInfo = displaySection.items[0].queryWordInfo;
        const fromLanguageTitle = getLanguageItemFromYoudaoId(wordInfo.fromLanguage).languageTitle;
        const toLanguageTitle = getLanguageItemFromYoudaoId(wordInfo.toLanguage).languageTitle;

        const fromTo = `${fromLanguageTitle} --> ${toLanguageTitle}`;
        let sectionTitle = `${sourceResult.type}`;
        const isShowTranslationTitle = i === 0 && isTranslationType && !this.isShowDetail;
        if (isDictionaryType || isShowTranslationTitle) {
          sectionTitle = `${sourceResult.type}   (${fromTo})`;
        }
        displaySection.sectionTitle = sectionTitle;
      }
    });
  }
  /**
   * Get word info from displaySections.
   *
   * First, get wordInfo from the first item of the first section. If displaySections is empty, return current query word info.
   *
   */
  getWordInfoFromDisplaySections(displaySections: DisplaySection[]) {
    if (displaySections.length) {
      const displaySection = displaySections[0];
      const wordInfo = displaySection.items[0].queryWordInfo;
      return wordInfo;
    }
    return this.queryWordInfo as QueryWordInfo;
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
        const toLanauge = this.queryWordInfo?.toLanguage as string;
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
  downloadAndPlayWordAudio(wordInfo: QueryWordInfo) {
    const enableAutomaticDownloadAudio = myPreferences.enableAutomaticPlayWordAudio && wordInfo?.isWord;
    if (enableAutomaticDownloadAudio && this.isLastQuery && !this.hasPlayAudio) {
      playYoudaoWordAudioAfterDownloading(wordInfo);
      this.hasPlayAudio = true;
    }
  }

  /**
   * Check if need to cancel or clear query.
   */
  checkIfNeedCancelDisplay() {
    console.log(`---> check if last query: ${this.isLastQuery}, should clear: ${this.shouldClearQuery}`);
    if (!this.isLastQuery || this.shouldClearQuery) {
      return true;
    }
    return false;
  }

  /**
   * Cancel current query.
   */
  cancelCurrentQuery() {
    console.log(`---> cancel current query`);
    this.controller.abort();
  }

  /**
   * Clear query result.
   */
  clearQueryResult() {
    console.log(`---> clear query result`);
    this.cancelCurrentQuery();

    this.queryResults = [];
    this.isShowDetail = false;
    this.shouldClearQuery = true;
    this.isLastQuery = false;

    if (this.updateDisplaySections) {
      this.updateDisplaySections([]);
    }
  }
}
