/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-02 09:57
 * @fileName: results.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { showToast, Toast } from "@raycast/api";
import { BaiduRequestStateCode } from "./consts";
import { formatLingueeDisplayResult, rquestLingueeDictionary } from "./dict/linguee/linguee";
import { playYoudaoWordAudioAfterDownloading } from "./dict/youdao/request";
import { requestGoogleTranslate } from "./google";
import {
  requestBaiduTextTranslate,
  requestCaiyunTextTranslate,
  requestDeepLTextTranslate,
  requestTencentTextTranslate,
  requestYoudaoDictionary,
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
  QueryDisplayResult,
  QueryWordInfo,
  RequestErrorInfo,
  RequestTypeResult,
  SectionDisplayItem,
  TencentTranslateResult,
  TranslateItem,
  TranslationType,
  YoudaoDisplayType,
  YoudaoTranslateResult,
  YoudaoTranslationFormatResult,
} from "./types";
import { checkIfShowMultipleTranslations, myPreferences } from "./utils";

const sortedOrder = getTranslationResultOrder();

export class RequestResults {
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

  requestDisplayResults: QueryDisplayResult[] = [];

  updateRequestDisplayResults(typeDisplayResult: QueryDisplayResult) {
    this.requestDisplayResults.push(typeDisplayResult);
    const displaySections: SectionDisplayItem[][] = [];
    for (const result of this.requestDisplayResults) {
      if (result.displayResult) {
        displaySections.push(result.displayResult);
        // console.log(`---> update result: ${JSON.stringify(result.sourceResult, null, 4)}`);
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
    console.log(`---> query fromTo: ${fromLanguage} -> ${toLanguage}`);
    console.log(`---> query text: ${queryText}`);

    let youdaoTranslateTypeResult: RequestTypeResult | undefined;

    rquestLingueeDictionary(queryText, fromLanguage, toLanguage, true)
      .then((lingueeTypeResult) => {
        // console.log("---> linguee result:", JSON.stringify(lingueeTypeResult.result, null, 2));
        const lingueeDisplayResult = formatLingueeDisplayResult(lingueeTypeResult);
        const displayResult: QueryDisplayResult = {
          type: DicionaryType.Linguee,
          displayResult: lingueeDisplayResult,
          sourceResult: lingueeTypeResult,
        };
        this.updateRequestDisplayResults(displayResult);
      })
      .catch((error) => {
        console.error("lingueeDictionaryResult error:", error);
      });

    requestYoudaoDictionary(queryText, fromLanguage, toLanguage)
      .then((youdaoTypeResult) => {
        // console.log("---> youdao result:", JSON.stringify(youdaoTypeResult.result, null, 2));

        console.log(`youdao translate result: ${JSON.stringify(youdaoTypeResult.result, null, 2)}`);
        // From the input text query, to the end of Youdao translation request.
        console.warn(`---> Entire request cost time: ${Date.now() - this.startTime} ms`);

        if (this.shouldCancelQuery) {
          // updateTranslateDisplayResult(null);
          return;
        }
        if (!this.isLastQuery) {
          console.log("---> queryTextWithTextInfo: isLastQuery is false, return");
          return;
        }

        const formatResult = this.formatYoudaoDictionaryResult(youdaoTypeResult);
        const youdaoDisplayResult = this.updateYoudaoTranslateDisplay(formatResult);
        const displayResult: QueryDisplayResult = {
          type: DicionaryType.Youdao,
          sourceResult: youdaoTranslateTypeResult,
          displayResult: youdaoDisplayResult,
        };
        this.updateRequestDisplayResults(displayResult);

        // if enable automatic play audio and query is word, then download audio and play it
        const enableAutomaticDownloadAudio =
          myPreferences.isAutomaticPlayWordAudio && formatResult.queryWordInfo.isWord;
        if (enableAutomaticDownloadAudio && this.isLastQuery) {
          playYoudaoWordAudioAfterDownloading(formatResult.queryWordInfo);
        }
      })
      .catch((error) => {
        console.error("youdaoDictionaryResult error:", error);
      });

    if (myPreferences.enableDeepLTranslate) {
      console.log("---> deep translate start");
      requestDeepLTextTranslate(queryText, fromLanguage, toLanguage)
        .then((deepLTypeResult) => {
          // Todo: should use axios.CancelToken to cancel the request!
          if (!this.shouldCancelQuery) {
            const displayResult: QueryDisplayResult = {
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
            const displayResult: QueryDisplayResult = {
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
            };
            if (!this.shouldCancelQuery) {
              const displayResult: QueryDisplayResult = {
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
            const displayResult: QueryDisplayResult = {
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
            const displayResult: QueryDisplayResult = {
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
            const displayResult: QueryDisplayResult = {
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
   * Format the Youdao original data for later use.
   */
  formatYoudaoDictionaryResult(youdaoTypeResult: RequestTypeResult): YoudaoTranslationFormatResult {
    const youdaoResult = youdaoTypeResult.result as YoudaoTranslateResult;
    const translations = youdaoResult.translation.map((translationText) => {
      return {
        type: TranslationType.Youdao,
        text: translationText,
      };
    });

    const [from, to] = youdaoResult.l.split("2"); // from2to
    let usPhonetic = youdaoResult.basic?.["us-phonetic"]; // may be two phonetic "trænzˈleɪʃn; trænsˈleɪʃn"
    usPhonetic = usPhonetic?.split("; ")[1] || usPhonetic;
    const queryWordInfo: QueryWordInfo = {
      ...this.queryWordInfo,
      word: youdaoResult.query,
      phonetic: usPhonetic || youdaoResult.basic?.phonetic,
      speech: youdaoResult.basic?.["us-speech"],
      fromLanguage: from,
      toLanguage: to,
      isWord: youdaoResult.isWord,
      examTypes: youdaoResult.basic?.exam_type,
      speechUrl: youdaoResult.speakUrl,
    };

    let webTranslation;
    if (youdaoResult.web) {
      webTranslation = youdaoResult.web[0];
    }
    const webPhrases = youdaoResult.web?.slice(1);

    return {
      queryWordInfo: queryWordInfo,
      translationItems: translations,
      explanations: youdaoResult.basic?.explains,
      forms: youdaoResult.basic?.wfs,
      webTranslation: webTranslation,
      webPhrases: webPhrases,
    };
  }

  /**
   * Update the translation display.
   *
   * * If sourceResult.result exist, then will call this.updateRequestDisplayResults()
   */
  updateTranslationDisplay(queryDisplayResult: QueryDisplayResult) {
    // console.log(`---> updateTranslationDisplay: ${queryDisplayResult}`);

    const { type, sourceResult } = queryDisplayResult;
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
      case TranslationType.Caiyun: {
        const caiyunResult = sourceResult.result as CaiyunTranslateResult;
        if (caiyunResult) {
          translatedText = caiyunResult?.target.join("\n");
        }
        break;
      }
    }

    if (translatedText) {
      const displayItem: ListDisplayItem = {
        displayType: type,
        key: `${translatedText}-${type}`,
        title: translatedText,
        copyText: translatedText,
        queryWordInfo: this.queryWordInfo as QueryWordInfo,
      };

      const sectionDisplayItem: SectionDisplayItem = {
        type: type,
        sectionTitle: type,
        items: [displayItem],
      };

      const displayResult: QueryDisplayResult = {
        type: type,
        sourceResult: sourceResult,
        displayResult: [sectionDisplayItem],
      };
      this.updateRequestDisplayResults(displayResult);
    }
  }

  /**
   * Update translate results so that can be directly used for UI display.
   */
  updateYoudaoTranslateDisplay(formatResult: YoudaoTranslationFormatResult | null): SectionDisplayItem[] {
    const sectionResult: Array<SectionDisplayItem> = [];
    if (!formatResult) {
      return sectionResult;
    }

    const showMultipleTranslations = checkIfShowMultipleTranslations(formatResult);

    for (const [i, translateItem] of formatResult.translationItems.entries()) {
      const sectionType = showMultipleTranslations ? translateItem.type : YoudaoDisplayType.Translation;

      let sectionTitle = YoudaoDisplayType.Translation.toString();
      let tooltip = `${translateItem.type.toString()} Translate`;

      // don't show tooltip when show multiple translations
      if (showMultipleTranslations) {
        sectionTitle = tooltip;
        tooltip = "";
      }

      const oneLineTranslation = translateItem.text.split("\n").join(" ");
      const phoneticText = formatResult.queryWordInfo.phonetic ? `[${formatResult.queryWordInfo.phonetic}]` : undefined;
      const isShowWordSubtitle = phoneticText || formatResult.queryWordInfo.examTypes;
      const wordSubtitle = isShowWordSubtitle ? formatResult.queryWordInfo.word : undefined;

      sectionResult.push({
        type: sectionType,
        sectionTitle: sectionTitle,
        items: [
          {
            displayType: YoudaoDisplayType.Translation,
            key: oneLineTranslation + i,
            title: ` ${oneLineTranslation}`,
            subtitle: wordSubtitle,
            tooltip: tooltip,
            copyText: oneLineTranslation,
            queryWordInfo: formatResult.queryWordInfo,
            speech: formatResult.queryWordInfo.speech,
            translationMarkdown: this.formatAllTypeTranslationToMarkdown(sectionType, formatResult),
            accessoryItem: {
              phonetic: phoneticText,
              examTypes: formatResult.queryWordInfo.examTypes,
            },
          },
        ],
      });

      if (!checkIfShowMultipleTranslations) {
        break;
      }
    }

    let hasShowDetailsSectionTitle = false;
    const detailsSectionTitle = "Details";

    formatResult.explanations?.forEach((explanation, i) => {
      sectionResult.push({
        type: YoudaoDisplayType.Explanations,
        sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
        items: [
          {
            displayType: YoudaoDisplayType.Explanations,
            key: explanation + i,
            title: explanation,
            queryWordInfo: formatResult.queryWordInfo,
            tooltip: YoudaoDisplayType.Explanations,
            copyText: explanation,
          },
        ],
      });

      hasShowDetailsSectionTitle = true;
    });

    const wfs = formatResult.forms?.map((wfItem) => {
      return wfItem.wf?.name + " " + wfItem.wf?.value;
    });

    // [ 复数 goods   比较级 better   最高级 best ]
    const wfsText = wfs?.join("   ") || "";
    if (wfsText.length) {
      sectionResult.push({
        type: YoudaoDisplayType.Forms,
        sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
        items: [
          {
            displayType: YoudaoDisplayType.Forms,
            key: wfsText,
            title: "",
            queryWordInfo: formatResult.queryWordInfo,
            tooltip: YoudaoDisplayType.Forms,
            subtitle: `[ ${wfsText} ]`,
            copyText: wfsText,
          },
        ],
      });

      hasShowDetailsSectionTitle = true;
    }

    if (formatResult.webTranslation) {
      const webResultKey = formatResult.webTranslation?.key;
      const webResultValue = formatResult.webTranslation.value.join("；");
      const copyText = `${webResultKey} ${webResultValue}`;
      sectionResult.push({
        type: YoudaoDisplayType.WebTranslation,
        sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
        items: [
          {
            displayType: YoudaoDisplayType.WebTranslation,
            key: copyText,
            title: webResultKey,
            queryWordInfo: formatResult.queryWordInfo,
            tooltip: YoudaoDisplayType.WebTranslation,
            subtitle: webResultValue,
            copyText: copyText,
          },
        ],
      });

      hasShowDetailsSectionTitle = true;
    }

    formatResult.webPhrases?.forEach((phrase, i) => {
      const phraseKey = phrase.key;
      const phraseValue = phrase.value.join("；");
      const copyText = `${phraseKey} ${phraseValue}`;
      sectionResult.push({
        type: YoudaoDisplayType.WebPhrase,
        sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
        items: [
          {
            displayType: YoudaoDisplayType.WebPhrase,
            key: copyText + i,
            title: phraseKey,
            queryWordInfo: formatResult.queryWordInfo,
            tooltip: YoudaoDisplayType.WebPhrase,
            subtitle: phraseValue,
            copyText: copyText,
          },
        ],
      });

      hasShowDetailsSectionTitle = true;
    });

    return sectionResult;
  }

  /**
   * Convert multiple translated result texts to markdown format and display them in the same list details page.
   */
  formatAllTypeTranslationToMarkdown(
    type: TranslationType | YoudaoDisplayType,
    formatResult: YoudaoTranslationFormatResult
  ) {
    const translations = [] as TranslateItem[];
    for (const translation of formatResult.translationItems) {
      const formatTranslation = this.formatTranslationToMarkdown(translation.type, translation.text);
      translations.push({ type: translation.type, text: formatTranslation });
    }
    // Traverse the translations array. If the type of translation element is equal to it, move it to the first of the array.
    for (let i = 0; i < translations.length; i++) {
      if (translations[i].type === type) {
        const temp = translations[i];
        translations.splice(i, 1);
        translations.unshift(temp);
        break;
      }
    }
    return translations
      .map((translation) => {
        return translation.text;
      })
      .join("\n");
  }

  /**
   *  format type translation result to markdown format.
   */
  formatTranslationToMarkdown(type: TranslationType | YoudaoDisplayType, text: string) {
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
export function sortTranslationItems(
  formatResult: YoudaoTranslationFormatResult,
  sortedOrder: string[]
): YoudaoTranslationFormatResult {
  const sortTranslations: TranslateItem[] = [];
  for (const translationItem of formatResult.translationItems) {
    const index = sortedOrder.indexOf(translationItem.type.toString().toLowerCase());
    sortTranslations[index] = translationItem;
  }
  // filter undefined
  const translations = sortTranslations.filter((item) => item);
  formatResult.translationItems = translations;
  return formatResult;
}

/**
 * Get translation result order, defaulf is sorted by: deelp > apple > baidu > tencent > youdao > caiyun.
 * If user set the order manually, prioritize the order.
 */
export function getTranslationResultOrder(): string[] {
  const defaultTypeOrder = [
    TranslationType.DeepL,
    TranslationType.Google,
    TranslationType.Apple,
    TranslationType.Baidu,
    TranslationType.Tencent,
    TranslationType.Youdao,
    TranslationType.Caiyun,
  ];

  const defaultOrder = defaultTypeOrder.map((type) => type.toString().toLowerCase());

  const userOrder: string[] = [];
  // * NOTE: user manually set the sort order may not be complete, or even tpye wrong name.
  const manualOrder = myPreferences.translationDisplayOrder.toLowerCase().split(","); // "Baidu,DeepL,Tencent"
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
