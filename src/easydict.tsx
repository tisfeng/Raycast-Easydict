/*
 * @author: tisfeng
 * @createTime: 2022-06-23 14:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-27 10:21
 * @fileName: easydict.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Fragment, useEffect, useState } from "react";
import { ActionFeedback, getListItemIcon, getWordAccessories, ListActionPanel } from "./components";
import { Action, ActionPanel, Color, getSelectedText, Icon, List, showToast, Toast } from "@raycast/api";
import {
  LanguageItem,
  TranslateDisplayResult,
  TranslateTypeResult,
  YoudaoTranslateResult,
  BaiduTranslateResult,
  TranslateFormatResult,
  QueryTextInfo,
} from "./types";
import {
  BaiduRequestStateCode,
  getYoudaoErrorInfo,
  maxInputTextLength,
  TranslateType,
  youdaoErrorCodeUrl,
  YoudaoRequestStateCode,
} from "./consts";
import {
  checkIsInstalledEudic,
  defaultLanguage1,
  defaultLanguage2,
  getAutoSelectedTargetLanguageId,
  getEudicWebTranslateURL,
  getYoudaoWebTranslateURL,
  myPreferences,
  isTranslateResultTooLong,
  isShowMultipleTranslations,
  getLanguageItemFromYoudaoId,
} from "./utils";
import {
  requestBaiduTextTranslate,
  requestCaiyunTextTranslate,
  requestTencentTextTranslate,
  requestYoudaoDictionary,
} from "./request";
import {
  formatTranslateDisplayResult,
  formatYoudaoDictionaryResult,
  updateFormateResultWithBaiduTranslation,
  updateFormateResultWithCaiyunTranslation,
  updateFormateResultWithTencentTranslation,
  updateFormatResultWithAppleTranslateResult,
} from "./formatData";
import { playWordAudio } from "./audio";
import { downloadYoudaoAudio } from "./dict/youdao/request";
import { LanguageDetectTypeResult, detectLanguage, getFinalConfirmedLanguage } from "./detectLanguage";
import { appleTranslate } from "./scripts";

let youdaoTranslateTypeResult: TranslateTypeResult | undefined;

/**
 * when has new input text, need to cancel previous request
 */
let isLastRequest = true;
let delayFetchTranslateAPITimer: NodeJS.Timeout;
let delayUpdateTargetLanguageTimer: NodeJS.Timeout;

export default function () {
  checkTwoPreferredLanguageIsSame();

  /**
   * Delay the time to call the query API. Since API has frequency limit.
   */
  const delayRequestTime = 600;

  const [isLoadingState, setLoadingState] = useState<boolean>(false);
  const [isShowingDetail, setIsShowingDetail] = useState<boolean>(false);
  const [isInstalledEudic, setIsInstalledEudic] = useState<boolean>(false);

  /**
   * use to display input text
   */
  const [inputText, setInputText] = useState<string>("");
  /**
   * searchText = inputText.trim(), avoid frequent request API with blank input
   */
  const [searchText, setSearchText] = useState<string>("");
  const [translateDisplayResult, setTranslateDisplayResult] = useState<TranslateDisplayResult[]>();
  /**
     the language type of text, depending on the language type of the current input text, it is preferred to judge whether it is English or Chinese according to the preferred language, and then auto
     */
  const [currentFromLanguageItem, setCurrentFromLanguageItem] = useState<LanguageItem>(defaultLanguage1);
  /*
    default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
    */
  const [autoSelectedTargetLanguageItem, setAutoSelectedTargetLanguageItem] = useState<LanguageItem>(defaultLanguage1);
  /*
    the user selected translation language, for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
    */
  const [userSelectedTargetLanguageItem, setUserSelectedTargetLanguageItem] =
    useState<LanguageItem>(autoSelectedTargetLanguageItem);

  useEffect(() => {
    if (searchText.length) {
      queryText(searchText);
      return;
    }

    if (myPreferences.isAutomaticQuerySelectedText) {
      tryQuerySelecedtText();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  /**
   * try to detect the selected text, if detect success, then query the selected text.
   */
  async function tryQuerySelecedtText() {
    try {
      const selectedText = await getSelectedText();
      console.log("selectedText: ", selectedText);
      updateInputText(selectedText);
    } catch (error) {
      // do nothing
    }
  }

  /**
   * query text, automatically detect the language of input text
   */
  function queryText(text: string) {
    setLoadingState(true);
    clearTimeout(delayUpdateTargetLanguageTimer);

    detectLanguage(text, (detectTypeResult: LanguageDetectTypeResult, confirmed) => {
      console.log(`detectLanguage: ${JSON.stringify(detectTypeResult)}, confirmed: ${confirmed}`);
      let finalConfirmedLanguage = detectTypeResult.youdaoLanguageId;
      if (!confirmed) {
        finalConfirmedLanguage = getFinalConfirmedLanguage(text, detectTypeResult.youdaoLanguageId);
      }
      console.warn(`final confirmed language: ${finalConfirmedLanguage}`);
      queryTextWithFromLanguageId(finalConfirmedLanguage);
    });
  }

  /**
   * query text with from youdao language id
   */
  function queryTextWithFromLanguageId(youdaoLanguageId: string) {
    console.log("queryTextWithFromLanguageId:", youdaoLanguageId);
    setCurrentFromLanguageItem(getLanguageItemFromYoudaoId(youdaoLanguageId));

    // priority to use user selected target language, if conflict, use auto selected target language
    let tartgetLanguageId = userSelectedTargetLanguageItem.youdaoLanguageId;
    console.log("userSelectedTargetLanguage:", tartgetLanguageId);
    if (youdaoLanguageId === tartgetLanguageId) {
      tartgetLanguageId = getAutoSelectedTargetLanguageId(youdaoLanguageId);
      setAutoSelectedTargetLanguageItem(getLanguageItemFromYoudaoId(tartgetLanguageId));
      console.log("autoSelectedTargetLanguage: ", tartgetLanguageId);
    }
    const queryTextInfo: QueryTextInfo = {
      queryText: searchText,
      fromLanguage: youdaoLanguageId,
      toLanguage: tartgetLanguageId,
    };
    queryTextWithTextInfo(queryTextInfo);
  }

  async function queryTextWithTextInfo(queryTextInfo: QueryTextInfo) {
    const [queryText, fromLanguage, toLanguage] = [
      queryTextInfo.queryText,
      queryTextInfo.fromLanguage,
      queryTextInfo.toLanguage,
    ];
    console.warn(`query text fromTo: ${fromLanguage} -> ${toLanguage}`);
    /**
     * first, request youdao translate API, check if should show multiple translations, if not, then end.
     * if need to show multiple translations, then request other translate API.
     */
    requestYoudaoDictionary(queryText, fromLanguage, toLanguage)
      .then((result) => {
        console.log(`is last request: ${isLastRequest}`);
        if (!isLastRequest) {
          return;
        }

        youdaoTranslateTypeResult = result;
        const youdaoResult = youdaoTranslateTypeResult.result as YoudaoTranslateResult;
        console.log(`youdaoResult: ${JSON.stringify(youdaoResult, null, 2)}`);
        const youdaoErrorCode = youdaoResult.errorCode;
        youdaoTranslateTypeResult.errorInfo = getYoudaoErrorInfo(youdaoErrorCode);

        if (youdaoErrorCode === YoudaoRequestStateCode.AccessFrequencyLimited.toString()) {
          console.warn(
            `youdao error: ${youdaoErrorCode}, request frequency limited, delay ${delayRequestTime} ms to request again`
          );
          delayQueryWithTextInfo(queryTextInfo);
          return;
        } else if (youdaoErrorCode !== YoudaoRequestStateCode.Success.toString()) {
          console.error(`youdao error: ${JSON.stringify(youdaoTranslateTypeResult.errorInfo)}`);
          updateTranslateDisplayResult(null);
          return;
        }
        let formatResult = formatYoudaoDictionaryResult(youdaoTranslateTypeResult);
        downloadYoudaoAudio(formatResult.queryWordInfo, () => {
          if (myPreferences.isAutomaticPlayWordAudio && formatResult.queryWordInfo.isWord && isLastRequest) {
            playWordAudio(queryText, fromLanguage);
          }
        });

        const [from, to] = youdaoResult.l.split("2"); // from2to
        if (from === to) {
          const target = getAutoSelectedTargetLanguageId(from);
          setAutoSelectedTargetLanguageItem(getLanguageItemFromYoudaoId(target));
          queryTextWithTextInfo(queryTextInfo);
          return;
        }

        setCurrentFromLanguageItem(getLanguageItemFromYoudaoId(from));
        updateTranslateDisplayResult(formatResult);
        checkIsInstalledEudic(setIsInstalledEudic);

        // request other translate API to show multiple translations
        if (isShowMultipleTranslations(formatResult)) {
          // check if enable apple translate
          if (myPreferences.enableAppleTranslate) {
            appleTranslate(queryTextInfo)
              .then((translatedText) => {
                if (translatedText) {
                  const appleTranslateResult: TranslateTypeResult = {
                    type: TranslateType.Apple,
                    result: { translatedText },
                  };
                  updateFormatResultWithAppleTranslateResult(formatResult, appleTranslateResult);
                  updateTranslateDisplayResult(formatResult);
                }
              })
              .catch((error) => {
                console.warn(`apple translate error: ${error}`);
              });
          }

          // check if enable baidu translate
          if (myPreferences.enableBaiduTranslate) {
            console.log("requestBaiduTextTranslate");
            requestBaiduTextTranslate(queryText, fromLanguage, toLanguage)
              .then((baiduRes) => {
                const baiduTranslateResult = baiduRes.result as BaiduTranslateResult;
                const baiduErrorCode = baiduTranslateResult.error_code;

                if (baiduErrorCode) {
                  if (baiduErrorCode === BaiduRequestStateCode.AccessFrequencyLimited.toString()) {
                    delayQueryWithTextInfo(queryTextInfo);
                    return;
                  }

                  baiduRes.errorInfo = {
                    errorCode: baiduErrorCode,
                    errorMessage: baiduTranslateResult.error_msg || "",
                  };
                  showToast({
                    style: Toast.Style.Failure,
                    title: `${baiduRes.type}: ${baiduErrorCode}`,
                    message: baiduRes.errorInfo.errorMessage,
                  });
                  console.error(`${baiduRes.type}: ${baiduErrorCode}`);
                  console.error(baiduRes.errorInfo.errorMessage);
                } else {
                  formatResult = updateFormateResultWithBaiduTranslation(baiduRes, formatResult);
                  updateTranslateDisplayResult(formatResult);
                }
              })
              .catch((err) => {
                console.error(`requestBaiduTextTranslate error: ${err}`);
              });
          }

          // check if enable tencent translate
          if (myPreferences.enableTencentTranslate) {
            console.log(`requestTencentTextTranslate`);
            requestTencentTextTranslate(queryText, fromLanguage, toLanguage)
              .then((tencentRes) => {
                formatResult = updateFormateResultWithTencentTranslation(tencentRes, formatResult);
                updateTranslateDisplayResult(formatResult);
              })
              .catch((err) => {
                console.error(err);
              });
          }

          // check if enable caiyun translate
          if (myPreferences.enableCaiyunTranslate) {
            console.log("requestCaiyunTextTranslate");
            requestCaiyunTextTranslate(queryText, fromLanguage, toLanguage)
              .then((caiyunRes) => {
                if (caiyunRes.errorInfo) {
                  showToast({
                    style: Toast.Style.Failure,
                    title: `${caiyunRes.type.split(" ")[0]} Error: ${caiyunRes.errorInfo.errorCode}`,
                    message: caiyunRes.errorInfo.errorMessage,
                  });
                  console.error(`caiyun error: ${caiyunRes.errorInfo.errorCode}, ${caiyunRes.errorInfo.errorMessage}`);
                } else {
                  formatResult = updateFormateResultWithCaiyunTranslation(caiyunRes, formatResult);
                  updateTranslateDisplayResult(formatResult);
                }
              })
              .catch((err) => {
                console.error(`requestCaiyunTextTranslate error: ${err}`);
              });
          }
        }
      })
      .catch((error) => {
        console.warn(`requestYoudaoDictionary error: ${error}`);
      });

    return;
  }

  /**
   * update translate display result, loading state, showing detail
   */
  function updateTranslateDisplayResult(formatResult: TranslateFormatResult | null) {
    setLoadingState(false);
    setIsShowingDetail(isTranslateResultTooLong(formatResult));
    setTranslateDisplayResult(formatTranslateDisplayResult(formatResult));
  }

  /**
   * delay query search text, later can cancel the query
   */
  function delayQueryWithTextInfo(queryTextInfo: QueryTextInfo) {
    delayUpdateTargetLanguageTimer = setTimeout(() => {
      queryTextWithTextInfo(queryTextInfo);
    }, delayRequestTime);
  }

  function ListDetail() {
    if (!youdaoTranslateTypeResult) return null;

    const youdaoErrorCode = (youdaoTranslateTypeResult.result as YoudaoTranslateResult).errorCode;
    const youdaoErrorMessage = youdaoTranslateTypeResult?.errorInfo?.errorMessage;
    const isYoudaoRequestError = youdaoErrorCode !== YoudaoRequestStateCode.Success.toString();

    if (isYoudaoRequestError) {
      return (
        <List.Item
          title={"Youdao Request Error"}
          subtitle={youdaoErrorMessage?.length ? `${youdaoErrorMessage}` : ""}
          accessories={[
            {
              text: `Error Code: ${youdaoErrorCode}`,
            },
          ]}
          icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="See Error Code Meaning" icon={Icon.QuestionMark} url={youdaoErrorCodeUrl} />
              <ActionFeedback />
            </ActionPanel>
          }
        />
      );
    }

    const eudicWebUrl = getEudicWebTranslateURL(
      searchText || "",
      currentFromLanguageItem,
      autoSelectedTargetLanguageItem
    );

    const youdaoWebUrl = getYoudaoWebTranslateURL(
      searchText || "",
      currentFromLanguageItem,
      autoSelectedTargetLanguageItem
    );

    return (
      <Fragment>
        {translateDisplayResult?.map((resultItem, idx) => {
          return (
            <List.Section key={idx} title={resultItem.sectionTitle}>
              {resultItem.items?.map((item) => {
                return (
                  <List.Item
                    key={item.key}
                    icon={{
                      value: getListItemIcon(resultItem.type),
                      tooltip: item.tooltip || "",
                    }}
                    title={item.title}
                    subtitle={item.subtitle}
                    accessories={getWordAccessories(resultItem.type, item)}
                    detail={<List.Item.Detail markdown={item.translationMarkdown} />}
                    actions={
                      <ListActionPanel
                        isInstalledEudic={isInstalledEudic}
                        isShowOpenInEudicWeb={eudicWebUrl.length != 0}
                        isShowOpenInYoudaoWeb={youdaoWebUrl.length != 0}
                        eudicWebUrl={eudicWebUrl}
                        youdaoWebUrl={youdaoWebUrl}
                        queryText={searchText}
                        queryWordInfo={item.queryWordInfo}
                        copyText={item.copyText}
                        currentFromLanguage={currentFromLanguageItem}
                        currentTargetLanguage={autoSelectedTargetLanguageItem}
                        onLanguageUpdate={(selectedLanguageItem) => {
                          setAutoSelectedTargetLanguageItem(selectedLanguageItem);
                          setUserSelectedTargetLanguageItem(selectedLanguageItem);
                          queryTextWithTextInfo({
                            queryText: searchText,
                            fromLanguage: currentFromLanguageItem.youdaoLanguageId,
                            toLanguage: selectedLanguageItem.youdaoLanguageId,
                          });
                        }}
                      />
                    }
                  />
                );
              })}
            </List.Section>
          );
        })}
      </Fragment>
    );
  }

  /**
   * check first language and second language is the same
   */
  function checkTwoPreferredLanguageIsSame() {
    if (defaultLanguage1.youdaoLanguageId === defaultLanguage2.youdaoLanguageId) {
      return (
        <List>
          <List.Item
            title={"Language Conflict"}
            icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
            subtitle={"Your first Language with second Language must be different."}
          />
        </List>
      );
    }
  }

  /**
   * update input text and search text
   */
  function updateInputText(text: string) {
    setInputText(text);

    const trimText = text.trim().substring(0, maxInputTextLength);
    if (trimText.length === 0) {
      updateTranslateDisplayResult(null);
      return;
    }

    isLastRequest = false;
    clearTimeout(delayFetchTranslateAPITimer);

    // start delay timer for fetch translate API
    if (trimText !== searchText) {
      delayFetchTranslateAPITimer = setTimeout(() => {
        isLastRequest = true;
        setSearchText(trimText);
      }, delayRequestTime);
    }
  }

  function onInputChangeEvent(text: string) {
    updateInputText(text);
  }

  return (
    <List
      isLoading={isLoadingState}
      isShowingDetail={isShowingDetail}
      searchBarPlaceholder={"Search word or translate text..."}
      searchText={inputText}
      onSearchTextChange={onInputChangeEvent}
      actions={
        <ActionPanel>
          <ActionFeedback />
        </ActionPanel>
      }
    >
      <List.EmptyView icon={Icon.TextDocument} title="Type a word to look up or translate" />
      <ListDetail />
    </List>
  );
}
