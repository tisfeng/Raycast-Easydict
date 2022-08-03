import { QueryType } from "./types";
/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-03 22:34
 * @fileName: dataManager.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { BaiduRequestStateCode, dictionarySeparator } from "./consts";
import { formatLingueeDisplayResult, rquestLingueeDictionary } from "./dict/linguee/linguee";
import { updateYoudaoDictionaryDisplay } from "./dict/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoDictionary } from "./dict/youdao/request";
import { appleTranslate } from "./scripts";
import { requestBaiduTextTranslate } from "./translation/baidu";
import { requestCaiyunTextTranslate } from "./translation/caiyun";
import { requestDeepLTextTranslate } from "./translation/deepL";
import { requestGoogleTranslate } from "./translation/google";
import { requestTencentTextTranslate } from "./translation/tencent";
import {
  AppleTranslateResult,
  BaiduTranslateResult,
  CaiyunTranslateResult,
  DeepLTranslateResult,
  DicionaryType,
  GoogleTranslateResult,
  ListDisplayItem,
  QueryResult,
  QueryWordInfo,
  RequestErrorInfo,
  RequestTypeResult,
  SectionDisplayItem,
  TencentTranslateResult,
  TranslateItem,
  TranslationType,
  YoudaoDictionaryFormatResult,
} from "./types";
import { checkIfShowYoudaoDictionary, getSortOrder, myPreferences } from "./utils";

const sortOrder = getSortOrder();

export class DataManager {
  private updateDisplaySections: (displaySections: SectionDisplayItem[]) => void;
  constructor(updateDisplaySections: (displaySections: SectionDisplayItem[]) => void) {
    this.updateDisplaySections = updateDisplaySections;
  }

  queryResults: QueryResult[] = [];
  private queryWordInfo?: QueryWordInfo;
  get getQueryWordInfo(): QueryWordInfo | undefined {
    return this.queryWordInfo;
  }

  /**
   * when has new input text, need to cancel previous request.
   */
  isLastQuery = true;
  /**
   * when input text is empty, need to cancel previous request, and clear result.
   */
  shouldCancelQuery = false;

  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayRequestTime = 600;

  delayQueryTextInfoTimer = setTimeout(() => {
    // do nothing, it will be assigned later.
  }, 1000);

  /**
   * update display result.
   *
   * 1.push new result to queryResults.
   * 2.sort queryResults.
   * 3.update dictionary section title.
   * 4.callback update display sections.
   */
  updateQueryDisplayResults(queryResult: QueryResult) {
    console.log(`---> update result: ${queryResult.type}`);

    this.queryResults.push(queryResult);
    this.sortQueryResults();
    this.updateDictionarySeparator();

    const displaySections: SectionDisplayItem[][] = [];
    for (const result of this.queryResults) {
      if (result.displayResult) {
        displaySections.push(result.displayResult);
      }
    }
    if (displaySections.length) {
      const sections = displaySections.flat();
      this.updateDisplaySections(sections);
    }
  }

  /**
   * Query text with text info, query dictionary API or tranalsate API.
   */
  queryTextWithTextInfo(queryWordInfo: QueryWordInfo) {
    this.queryWordInfo = queryWordInfo;
    const { word: queryText, fromLanguage, toLanguage } = queryWordInfo;
    console.log(`---> query text: ${queryText}`);
    console.log(`---> query fromTo: ${fromLanguage} -> ${toLanguage}`);

    if (myPreferences.enableLingueeDictionary) {
      rquestLingueeDictionary(queryText, fromLanguage, toLanguage, true)
        .then((lingueeTypeResult) => {
          const lingueeDisplayResult = formatLingueeDisplayResult(lingueeTypeResult);
          const displayResult: QueryResult = {
            type: DicionaryType.Linguee,
            displayResult: lingueeDisplayResult,
            sourceResult: lingueeTypeResult,
          };
          this.updateQueryDisplayResults(displayResult);
        })
        .catch((error) => {
          console.error("lingueeDictionaryResult error:", error);
        });
    }

    const enableYoudaoDictionary = myPreferences.enableYoudaoDictionary;
    if (enableYoudaoDictionary || myPreferences.enableYoudaoTranslate) {
      requestYoudaoDictionary(queryText, fromLanguage, toLanguage)
        .then((youdaoTypeResult) => {
          console.log(`---> youdao result: ${JSON.stringify(youdaoTypeResult.result, null, 2)}`);

          if (this.shouldCancelQuery) {
            // updateTranslateDisplayResult(null);
            console.log("---> query canceled");
            return;
          }
          if (!this.isLastQuery) {
            console.log("---> queryTextWithTextInfo: isLastQuery is false, return");
            return;
          }

          const formatYoudaoResult = youdaoTypeResult.result as YoudaoDictionaryFormatResult;
          const youdaoDisplayResult = updateYoudaoDictionaryDisplay(formatYoudaoResult);
          const showYoudaoDictionary = checkIfShowYoudaoDictionary(formatYoudaoResult);
          console.log(`---> showYoudaoDictionary: ${showYoudaoDictionary}`);
          const type = enableYoudaoDictionary ? DicionaryType.Youdao : TranslationType.Youdao;

          const displayResult: QueryResult = {
            type: type,
            sourceResult: youdaoTypeResult,
            displayResult: youdaoDisplayResult,
          };
          if (type === DicionaryType.Youdao && showYoudaoDictionary) {
            this.updateQueryDisplayResults(displayResult);
          } else if (type === TranslationType.Youdao) {
            this.updateTranslationDisplay(displayResult);
          }

          // if enable automatic play audio and query is word, then download audio and play it
          const enableAutomaticDownloadAudio =
            myPreferences.isAutomaticPlayWordAudio && formatYoudaoResult.queryWordInfo.isWord;
          if (enableAutomaticDownloadAudio && this.isLastQuery) {
            playYoudaoWordAudioAfterDownloading(formatYoudaoResult.queryWordInfo);
          }
        })
        .catch((error) => {
          console.error("youdaoDictionaryResult error:", error);
        });
    }

    if (myPreferences.enableDeepLTranslate) {
      requestDeepLTextTranslate(queryText, fromLanguage, toLanguage)
        .then((deepLTypeResult) => {
          // Todo: should use axios.CancelToken to cancel the request!
          if (!this.shouldCancelQuery) {
            const displayResult: QueryResult = {
              type: TranslationType.DeepL,
              sourceResult: deepLTypeResult,
            };
            this.updateTranslationDisplay(displayResult);
          }
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

    // check if enable google translate
    if (myPreferences.enableGoogleTranslate) {
      requestGoogleTranslate(queryText, fromLanguage, toLanguage)
        .then((googleTypeResult) => {
          if (!this.shouldCancelQuery) {
            const displayResult: QueryResult = {
              type: TranslationType.Google,
              sourceResult: googleTypeResult,
            };
            this.updateTranslationDisplay(displayResult);
          }
        })
        .catch((err) => {
          console.error(`google error: ${JSON.stringify(err, null, 2)}`);
        });
    }

    // check if enable apple translate
    if (myPreferences.enableAppleTranslate) {
      appleTranslate(this.queryWordInfo)
        .then((translatedText) => {
          if (translatedText) {
            const appleTranslateResult: RequestTypeResult = {
              type: TranslationType.Apple,
              result: { translatedText: translatedText },
              translation: translatedText,
            };
            if (!this.shouldCancelQuery) {
              const displayResult: QueryResult = {
                type: TranslationType.Apple,
                sourceResult: appleTranslateResult,
              };
              this.updateTranslationDisplay(displayResult);
            }
          }
        })
        .catch((error) => {
          const errorInfo = error as RequestErrorInfo;
          console.error(`Apple translate error: ${JSON.stringify(errorInfo, null, 4)}`);
        });
    }

    // check if enable baidu translate
    if (myPreferences.enableBaiduTranslate) {
      requestBaiduTextTranslate(queryText, fromLanguage, toLanguage)
        .then((baiduTypeResult) => {
          if (!this.shouldCancelQuery) {
            const displayResult: QueryResult = {
              type: TranslationType.Baidu,
              sourceResult: baiduTypeResult,
            };
            this.updateTranslationDisplay(displayResult);
          }
        })
        .catch((err) => {
          const errorInfo = err as RequestErrorInfo;
          // * if error is access frequency limited, then delay request again
          if (errorInfo.code === BaiduRequestStateCode.AccessFrequencyLimited.toString()) {
            // Todo: only try request Baidu translate again.
            this.delayQueryWithTextInfo(this.queryWordInfo as QueryWordInfo);
            return;
          }
          showToast({
            style: Toast.Style.Failure,
            title: `${errorInfo.type}: ${errorInfo.code}`,
            message: errorInfo.message,
          });
        });
    }

    // check if enable tencent translate
    if (myPreferences.enableTencentTranslate) {
      requestTencentTextTranslate(queryText, fromLanguage, toLanguage)
        .then((tencentTypeResult) => {
          if (!this.shouldCancelQuery) {
            const displayResult: QueryResult = {
              type: TranslationType.Tencent,
              sourceResult: tencentTypeResult,
            };
            this.updateTranslationDisplay(displayResult);
          }
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
      requestCaiyunTextTranslate(queryText, fromLanguage, toLanguage)
        .then((caiyunTypeResult) => {
          if (!this.shouldCancelQuery) {
            const displayResult: QueryResult = {
              type: TranslationType.Caiyun,
              sourceResult: caiyunTypeResult,
            };
            this.updateTranslationDisplay(displayResult);
          }
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
   * delay query search text, later can cancel the query
   */
  delayQueryWithTextInfo(quertWordInfo: QueryWordInfo) {
    this.delayQueryTextInfoTimer = setTimeout(() => {
      this.queryTextWithTextInfo(quertWordInfo);
    }, this.delayRequestTime);
  }

  /**
   * Update the translation display.
   *
   * * If sourceResult.result exist, then will call this.updateRequestDisplayResults()
   */
  updateTranslationDisplay(queryResult: QueryResult) {
    console.log(`---> updateTranslationDisplay: ${queryResult.type}`);

    const { type, sourceResult } = queryResult;
    let translatedText = "";
    if (!sourceResult) {
      return;
    }

    switch (type) {
      case TranslationType.DeepL: {
        const deepLResult = sourceResult.result as DeepLTranslateResult;
        translatedText = deepLResult.translations[0].text;
        break;
      }
      case TranslationType.Google: {
        const googleResult = sourceResult.result as GoogleTranslateResult;
        translatedText = googleResult.translatedText;
        break;
      }
      case TranslationType.Apple: {
        const appleResult = sourceResult.result as AppleTranslateResult;
        translatedText = appleResult.translatedText;
        break;
      }
      case TranslationType.Baidu: {
        const baiduResult = sourceResult.result as BaiduTranslateResult;
        if (baiduResult.trans_result) {
          translatedText = baiduResult.trans_result.map((item) => item.dst).join("\n");
        }
        break;
      }
      case TranslationType.Tencent: {
        const tencentResult = sourceResult.result as TencentTranslateResult;
        if (tencentResult) {
          translatedText = tencentResult.TargetText;
        }
        break;
      }
      case TranslationType.Youdao: {
        const youdaoResult = sourceResult.result as YoudaoDictionaryFormatResult;
        if (youdaoResult) {
          translatedText = youdaoResult.translations.join("\n");
        }
        break;
      }
      case TranslationType.Caiyun: {
        const caiyunResult = sourceResult.result as CaiyunTranslateResult;
        if (caiyunResult) {
          translatedText = caiyunResult?.target.join("\n");
        }
        break;
      }
    }

    if (translatedText) {
      // console.log(`---> translatedText: ${translatedText}`);
      const displayItem: ListDisplayItem = {
        displayType: type,
        key: `${translatedText}-${type}`,
        title: translatedText,
        copyText: translatedText,
        queryWordInfo: this.queryWordInfo as QueryWordInfo,
        translationMarkdown: this.formatTranslationToMarkdown(translatedText, type as TranslationType),
      };

      const sectionDisplayItem: SectionDisplayItem = {
        type: type,
        sectionTitle: type,
        items: [displayItem],
      };

      const displayResult: QueryResult = {
        type: type,
        sourceResult: sourceResult,
        displayResult: [sectionDisplayItem],
      };
      this.updateQueryDisplayResults(displayResult);
    }
  }

  /**
   * Convert multiple translated result texts to markdown format and display them in the same list details page.
   */
  // formatAllTypeTranslationToMarkdown(
  //   queryDisplayResult: QueryResult,
  //   type: TranslationType,
  //   formatResult: YoudaoTranslationFormatResult
  // ) {
  //   const translations = [] as TranslateItem[];
  //   for (const translation of formatResult.translations) {
  //     const formatTranslation = this.formatTranslationToMarkdown(translation.type, translation.text);
  //     translations.push({ type: translation.type, text: formatTranslation });
  //   }
  //   // Traverse the translations array. If the type of translation element is equal to it, move it to the first of the array.
  //   for (let i = 0; i < translations.length; i++) {
  //     if (translations[i].type === type) {
  //       const temp = translations[i];
  //       translations.splice(i, 1);
  //       translations.unshift(temp);
  //       break;
  //     }
  //   }
  //   return translations
  //     .map((translation) => {
  //       return translation.text;
  //     })
  //     .join("\n");
  // }

  /**
   * Update translation markdown.
   */
  UpdateTranslationMarkdown(queryResult: QueryResult) {
    const { sourceResult, displayResult } = queryResult;
    if (!sourceResult || !displayResult?.length) {
      return;
    }

    const translations = [] as TranslateItem[];
    for (const queryResults of this.queryResults) {
      const { type, sourceResult } = queryResults;
      const isDictionaryType = Object.values(DicionaryType).includes(type as DicionaryType);
      if (sourceResult && isDictionaryType) {
        const type = sourceResult.type as TranslationType;
        const markdownTranslation = this.formatTranslationToMarkdown(sourceResult?.translation, type);
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
    const markdown = translations
      .map((translation) => {
        return translation.text;
      })
      .join("\n");

    const listDiplayItem = displayResult[0].items;
    if (listDiplayItem?.length) {
      listDiplayItem[0].translationMarkdown = markdown;
    }
  }

  /**
   *  format type translation result to markdown format.
   */
  formatTranslationToMarkdown(text: string, type: TranslationType) {
    const string = text.replace(/\n/g, "\n\n");
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
    }
    // filter undefined
    const results = queryResults.filter((item) => item);
    this.queryResults = results;
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
   * Add a separator line for the first dictionary section title.
   */
  updateDictionarySeparator() {
    let showSeparator = false;
    for (const result of this.queryResults) {
      const type = result.type;
      const isDictionaryType = Object.values(DicionaryType).includes(type as DicionaryType);
      if (isDictionaryType) {
        this.addOrDeleteSeparator(type as DicionaryType, showSeparator);
        showSeparator = true;
      }
    }
  }

  /**
   * Add dictionary separator.
   */
  addOrDeleteSeparator(dictionaryType: DicionaryType, isAdd: boolean) {
    const dictionaryResult = this.getQueryResult(dictionaryType);
    const displayResult = dictionaryResult?.displayResult;
    if (displayResult) {
      let sectionTitle = `${dictionaryType}`;
      if (isAdd) {
        sectionTitle = `${sectionTitle} ${dictionarySeparator}`;
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
   * Check if show one line translation.
   *
   *  Iterate QueryResult, if dictionary is not empty, return true.
   */
  checkIfShowOneLineTranslation(): boolean {
    if (this.queryResults.length) {
      for (const queryResult of this.queryResults) {
        const isDictionaryType = Object.values(DicionaryType).includes(queryResult.type as DicionaryType);
        if (isDictionaryType && queryResult.sourceResult?.result) {
          return true;
        }
      }
    }
    return false;
  }
}
