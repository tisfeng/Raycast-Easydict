/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-08 18:32
 * @fileName: dataManager.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { formatLingueeDisplayResult, rquestLingueeDictionary } from "./dict/linguee/linguee";
import { isLingueeDictionaryEmpty } from "./dict/linguee/parse";
import { LingueeDictionaryResult } from "./dict/linguee/types";
import { isYoudaoDictionaryEmpty, updateYoudaoDictionaryDisplay } from "./dict/youdao/formatData";
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
  ListDisplayItem,
  QueryResult,
  QueryType,
  RequestErrorInfo,
  RequestTypeResult,
  SectionDisplayItem as DisplaySection,
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
    this.updateDictionarySeparator();
    this.isShowDetail = this.checkIfShowTranslationDetail();

    const displaySections: DisplaySection[][] = [];
    for (const result of this.queryResults) {
      if (result.displayResult) {
        this.updateTranslationMarkdown(result);
        displaySections.push(result.displayResult);
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
          const lingueeDisplayResult = formatLingueeDisplayResult(lingueeTypeResult);
          const type = DicionaryType.Linguee;
          const displayResult: QueryResult = {
            type: type,
            displayResult: lingueeDisplayResult,
            sourceResult: lingueeTypeResult,
          };
          this.updateQueryDisplayResults(displayResult);

          const wordInfo = lingueeTypeResult.wordInfo as QueryWordInfo;
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
          const youdaoDisplayResult = updateYoudaoDictionaryDisplay(formatYoudaoResult);
          const showYoudaoDictionary = !isYoudaoDictionaryEmpty(formatYoudaoResult);
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
          const displayResult: QueryResult = {
            type: displayType,
            sourceResult: youdaoTypeResult,
            displayResult: youdaoDisplayResult,
          };

          if (displayType === TranslationType.Youdao) {
            this.updateTranslationDisplay(displayResult);
            return;
          }

          this.updateQueryDisplayResults(displayResult);
          const wordInfo = youdaoTypeResult.wordInfo as QueryWordInfo;
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
          const displayResult: QueryResult = {
            type: TranslationType.DeepL,
            sourceResult: deepLTypeResult,
          };
          this.updateTranslationDisplay(displayResult);
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
          const displayResult: QueryResult = {
            type: TranslationType.Google,
            sourceResult: googleTypeResult,
          };
          this.updateTranslationDisplay(displayResult);
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
            const appleTranslateResult: RequestTypeResult = {
              type: TranslationType.Apple,
              result: { translatedText: translatedText },
              translations: [translatedText],
              wordInfo: this.queryWordInfo as QueryWordInfo,
            };
            const displayResult: QueryResult = {
              type: TranslationType.Apple,
              sourceResult: appleTranslateResult,
            };
            this.updateTranslationDisplay(displayResult);
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
          const displayResult: QueryResult = {
            type: TranslationType.Baidu,
            sourceResult: baiduTypeResult,
          };
          this.updateTranslationDisplay(displayResult);
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

          const displayResult: QueryResult = {
            type: TranslationType.Tencent,
            sourceResult: tencentTypeResult,
          };
          this.updateTranslationDisplay(displayResult);
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
          const displayResult: QueryResult = {
            type: TranslationType.Caiyun,
            sourceResult: caiyunTypeResult,
          };
          this.updateTranslationDisplay(displayResult);
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

    oneLineTranslations = sourceResult.translations.map((translation) => translation).join(" ");
    sourceResult.oneLineTranslation = oneLineTranslations;
    if (oneLineTranslations) {
      const displayItem: ListDisplayItem = {
        displayType: type,
        key: `${oneLineTranslations}-${type}`,
        title: oneLineTranslations,
        copyText: oneLineTranslations,
        queryWordInfo: this.queryWordInfo as QueryWordInfo,
      };
      const sectionDisplayItem: DisplaySection = {
        type: type,
        sectionTitle: type,
        items: [displayItem],
      };
      const newQueryResult = { ...queryResult, displayResult: [sectionDisplayItem] };
      this.updateQueryDisplayResults(newQueryResult);
    }
  }

  /**
   * Update translation markdown.
   */
  updateTranslationMarkdown(queryResult: QueryResult) {
    const { sourceResult, displayResult } = queryResult;
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
   * Show a separator line for the non-first dictionary section title.
   */
  updateDictionarySeparator() {
    if (this.queryResults.length) {
      this.queryResults.forEach((result, i) => {
        let showSeparator = true;
        const type = result.type;
        const isDictionaryType = Object.values(DicionaryType).includes(type as DicionaryType);
        if (isDictionaryType) {
          if (i === 0) {
            showSeparator = false;
          }
          this.addOrDeleteSeparator(type as DicionaryType, showSeparator);
        }
      });
    }
  }

  /**
   * add or remove a separator line.
   */
  addOrDeleteSeparator(dictionaryType: DicionaryType, isAdd: boolean) {
    const dictionaryResult = this.getQueryResult(dictionaryType);
    const displayResult = dictionaryResult?.displayResult;
    if (displayResult?.length) {
      const wordInfo = displayResult[0].items[0].queryWordInfo;
      const fromLanguageTitle = getLanguageItemFromYoudaoId(wordInfo.fromLanguage).languageTitle;
      const toLanguageTitle = getLanguageItemFromYoudaoId(wordInfo.toLanguage).languageTitle;

      const fromTo = `${fromLanguageTitle} --> ${toLanguageTitle}`;

      let sectionTitle = `${dictionaryType}   (${fromTo})`;
      if (isAdd) {
        sectionTitle = `${sectionTitle}`;
      }
      displayResult[0].sectionTitle = sectionTitle;
    }
  }

  /**
   * Get valid dictionary type from RequestTool. valid means the dictionary result is not empty.
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
    if (this.queryResults.length) {
      for (const queryResult of this.queryResults) {
        const isDictionaryType = Object.values(DicionaryType).includes(queryResult.type as DicionaryType);
        if (isDictionaryType) {
          const isDictionaryEmpty = this.checkIfDictionaryTypeEmpty(queryResult.type as DicionaryType);
          if (!isDictionaryEmpty) {
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
    }
    // console.log(`---> isShowDetail: ${isShowDetail}`);
    return isShowDetail;
  }

  /**
   * Check if dictionary type is empty.
   */
  checkIfDictionaryTypeEmpty(dictionaryType: DicionaryType): boolean {
    const isDictionaryType = Object.values(DicionaryType).includes(dictionaryType);
    if (!isDictionaryType) {
      return false;
    }

    const dictionaryResult = this.getQueryResult(dictionaryType);
    const sourceResult = dictionaryResult?.sourceResult;
    if (!sourceResult) {
      return true;
    }

    let isEmpty = true;
    switch (dictionaryType) {
      case DicionaryType.Linguee: {
        isEmpty = isLingueeDictionaryEmpty(sourceResult.result as LingueeDictionaryResult);
        break;
      }
      case DicionaryType.Youdao: {
        isEmpty = isYoudaoDictionaryEmpty(sourceResult.result as YoudaoDictionaryFormatResult);
        break;
      }
    }
    return isEmpty;
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
