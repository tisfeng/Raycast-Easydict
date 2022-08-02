/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-03 00:05
 * @fileName: data.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { BaiduRequestStateCode } from "./consts";
import { formatLingueeDisplayResult, rquestLingueeDictionary } from "./dict/linguee/linguee";
import { updateYoudaoDictionaryDisplay } from "./dict/youdao/formatData";
import { playYoudaoWordAudioAfterDownloading, requestYoudaoDictionary } from "./dict/youdao/request";
import { requestGoogleTranslate } from "./google";
import {
  requestBaiduTextTranslate,
  requestCaiyunTextTranslate,
  requestDeepLTextTranslate,
  requestTencentTextTranslate,
} from "./request";
import { appleTranslate } from "./scripts";
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
import { checkIfShowYoudaoDictionary, myPreferences } from "./utils";

export class RequestResult {
  private updateDisplaySections: (displaySections: SectionDisplayItem[]) => void;

  constructor(updateDisplaySections: (displaySections: SectionDisplayItem[]) => void) {
    this.updateDisplaySections = updateDisplaySections;
  }

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
  startTime = Date.now();

  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  delayRequestTime = 600;

  delayQueryTextInfoTimer = setTimeout(() => {
    // do nothing, it will be assigned later.
  }, 1000);

  sortOrder = getTranslationResultOrder();

  queryResults: QueryResult[] = [];

  updateRequestDisplayResults(queryDisplayResult: QueryResult) {
    this.queryResults.push(queryDisplayResult);
    const displaySections: SectionDisplayItem[][] = [];
    for (const result of this.queryResults) {
      if (result.displayResult) {
        displaySections.push(result.displayResult);
        console.log(`---> update result: ${result.type}`);
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
          this.updateRequestDisplayResults(displayResult);
        })
        .catch((error) => {
          console.error("lingueeDictionaryResult error:", error);
        });
    }

    const enableYoudaoDictionary = myPreferences.enableYoudaoDictionary;
    if (enableYoudaoDictionary || myPreferences.enableYoudaoTranslate) {
      console.log("---> request youdao dictionary");
      requestYoudaoDictionary(queryText, fromLanguage, toLanguage)
        .then((youdaoTypeResult) => {
          console.log(`---> youdao result: ${JSON.stringify(youdaoTypeResult.result, null, 2)}`);
          // From the input text query, to the end of Youdao translation request.
          console.warn(`---> Entire request cost time: ${Date.now() - this.startTime} ms`);

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
            this.updateRequestDisplayResults(displayResult);
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
      console.log("---> deep translate start");
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
      console.log("---> google translate start");
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
      console.log("apple translate start");
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
      console.log("baidu translate start");
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
      console.log(`tencent translate start`);
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
      console.log(`caiyun translate start`);
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
      console.log(`---> translatedText: ${translatedText}`);
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
      this.updateRequestDisplayResults(displayResult);
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
      if (sourceResult && type in TranslationType) {
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
}

/**
 * Sort translation results by designated order.
 *
 * * NOTE: this function will be called many times, because translate results are async, so we need to sort every time.
 */
// export function sortTranslationItems(
//   formatResult: YoudaoTranslationFormatResult,
//   sortedOrder: string[]
// ): YoudaoTranslationFormatResult {
//   const sortTranslations: TranslateItem[] = [];
//   for (const translationItem of formatResult.translations) {
//     const index = sortedOrder.indexOf(translationItem.type.toString().toLowerCase());
//     sortTranslations[index] = translationItem;
//   }
//   // filter undefined
//   const translations = sortTranslations.filter((item) => item);
//   formatResult.translations = translations;
//   return formatResult;
// }

/**
 * Get translation result order. If user set the order manually, prioritize the order.
 */
export function getTranslationResultOrder(): string[] {
  const defaultTypeOrder = [
    DicionaryType.Linguee,
    DicionaryType.Youdao,

    TranslationType.DeepL,
    TranslationType.Google,
    TranslationType.Apple,
    TranslationType.Baidu,
    TranslationType.Tencent,
    TranslationType.Youdao, // * Note: only one Youdao will be shown.
    TranslationType.Caiyun,
  ];

  const defaultOrder = defaultTypeOrder.map((type) => type.toString().toLowerCase());

  const userOrder: string[] = [];
  // * NOTE: user manually set the sort order may not be complete, or even tpye wrong name.
  const manualOrder = myPreferences.translationDisplayOrder.toLowerCase().split(","); // "Baidu,DeepL,Tencent"

  // if contains DicionaryType.Youdao and TranslationType.Youdao, remove DicionaryType.Youdao

  // console.log("manualOrder:", manualOrder);
  if (manualOrder.length > 0) {
    for (let translationName of manualOrder) {
      translationName = translationName.trim();
      // if the type name is in the default order, add it to user order, and remove it from defaultNameOrder.
      if (defaultOrder.includes(translationName)) {
        userOrder.push(translationName);
        defaultOrder.splice(defaultOrder.indexOf(translationName), 1);
      }
    }
  }
  // console.log("defaultNameOrder:", defaultOrder);
  // console.log("userOrder:", userOrder);
  const finalOrder = [...userOrder, ...defaultOrder];
  // console.log("finalOrder:", finalOrder);
  return finalOrder;
}
