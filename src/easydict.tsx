import { Fragment, useEffect, useState } from "react";
import {
  ActionFeedback,
  getListItemIcon,
  getWordAccessories,
  ListActionPanel,
} from "./components";
import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import {
  LanguageItem,
  TranslateSourceResult,
  TranslateDisplayResult,
  RequestResultState,
  TranslateTypeResult,
} from "./types";
import {
  BaiduRequestStateCode,
  getYoudaoErrorInfo,
  maxInputTextLength,
  requestStateCodeLinkMap,
  TranslateType,
  YoudaoRequestStateCode,
} from "./consts";
import axios from "axios";
import {
  checkIsInstalledEudic,
  defaultLanguage1,
  defaultLanguage2,
  getAutoSelectedTargetLanguageId,
  getEudicWebTranslateURL,
  getInputTextLanguageId,
  getLanguageItemFromTencentLanguageId,
  getLanguageItemFromYoudaoLanguageId,
  getYoudaoWebTranslateURL,
  saveQueryClipboardRecord,
  tryQueryClipboardText,
} from "./utils";
import { requestAllTranslateAPI, tencentLanguageDetect } from "./request";
import {
  reformatTranslateDisplayResult,
  reformatTranslateResult,
} from "./dataFormat";

let requestResultState: RequestResultState;

let delayFetchTranslateAPITimer: NodeJS.Timeout;
let delayUpdateTargetLanguageTimer: NodeJS.Timeout;

export default function () {
  // use to display input text
  const [inputText, updateInputText] = useState<string>();
  // searchText = inputText.trim(), avoid frequent request API
  const [searchText, updateSearchText] = useState<string>();

  const [isLoadingState, updateLoadingState] = useState<boolean>(false);
  const [isInstalledEudic, updateIsInstalledEudic] = useState<boolean>(false);

  // Delay the time to call the query API. The API has frequency limit.
  const delayRequestTime = 600;

  if (defaultLanguage1.youdaoLanguageId === defaultLanguage2.youdaoLanguageId) {
    return (
      <List>
        <List.Item
          title={"Language Conflict"}
          icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
          subtitle={
            "Your first Language with second Language must be different."
          }
        />
      </List>
    );
  }

  const [translateDisplayResult, updateTranslateDisplayResult] =
    useState<TranslateDisplayResult[]>();

  /**
     the language type of text, depending on the language type of the current input text, it is preferred to judge whether it is English or Chinese according to the preferred language, and then auto
     */
  const [currentFromLanguageItem, updateCurrentFromLanguageItem] =
    useState<LanguageItem>(defaultLanguage1);

  /*
    default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
    */
  const [autoSelectedTargetLanguageItem, updateAutoSelectedTargetLanguageItem] =
    useState<LanguageItem>(defaultLanguage1);

  /*
    the user selected translation language, for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
    */
  const [userSelectedTargetLanguageItem, updateUserSelectedTargetLanguageItem] =
    useState<LanguageItem>(autoSelectedTargetLanguageItem);

  function translate(fromLanguage: string, targetLanguage: string) {
    console.log(`translate fromTo: ${fromLanguage} -> ${targetLanguage}`);

    requestAllTranslateAPI(searchText!, fromLanguage, targetLanguage).then(
      axios.spread((...typeResult) => {
        let youdaoRes: TranslateTypeResult;
        let baiduRes: TranslateTypeResult | null = null;
        let tecentRes: TranslateTypeResult | null = null;
        let caiyunRes: TranslateTypeResult | null = null;

        let sourceResult: TranslateSourceResult = {} as TranslateSourceResult;

        for (const res of typeResult) {
          console.log(
            `${res.type} result: ${JSON.stringify(res.result, null, 4)}`
          );

          if (res.type === TranslateType.Youdao) {
            youdaoRes = res;
            sourceResult.youdaoResult = res.result;
          }

          if (res.type === TranslateType.Baidu) {
            baiduRes = res;
            if (!baiduRes.result.error_code) {
              sourceResult.baiduResult = baiduRes.result;
            } else {
              baiduRes.errorInfo = {
                errorCode: baiduRes.result.error_code,
                errorMessage: baiduRes.result.error_msg,
              };
              showToast({
                style: Toast.Style.Failure,
                title: `${baiduRes.type}: ${baiduRes.result.error_code}`,
                message: baiduRes.errorInfo.errorMessage,
              });
            }
          }
          if (res.type === TranslateType.Tencent) {
            tecentRes = res;
            sourceResult.tencentResult = res.result;
          }
          if (res.type === TranslateType.Caiyun) {
            caiyunRes = res;
            sourceResult.caiyunResult = res.result;
          }
        }

        youdaoRes!.errorInfo = getYoudaoErrorInfo(
          sourceResult.youdaoResult?.errorCode || "0"
        );

        // success return code: 0 undefined null
        const youdaoErrorCode = youdaoRes!.errorInfo?.errorCode;
        const baiduErrorCode = baiduRes?.errorInfo?.errorCode;
        console.log("error code: ", youdaoErrorCode, baiduErrorCode);

        if (
          youdaoErrorCode ===
            YoudaoRequestStateCode.AccessFrequencyLimited.toString() ||
          baiduErrorCode ===
            BaiduRequestStateCode.AccessFrequencyLimited.toString()
        ) {
          delayUpdateTargetLanguageTimer = setTimeout(() => {
            console.log("--> error_code: ", baiduErrorCode);
            translate(fromLanguage, targetLanguage);
          }, delayRequestTime);
          return;
        }

        // handle exceptional errors, such as user AppID errors or exceptions of the API itself.
        requestResultState = {
          type: TranslateType.Youdao,
          errorInfo: getYoudaoErrorInfo(youdaoErrorCode || ""),
        };
        if (youdaoErrorCode !== YoudaoRequestStateCode.Success.toString()) {
          console.log("youdaoRes: ", youdaoRes!.result);

          displayRequestErrorInfo();
          return;
        }

        const reformatResult = reformatTranslateResult(sourceResult);

        const [from, to] = sourceResult.youdaoResult!.l.split("2"); // from2to
        if (from === to) {
          const target = getAutoSelectedTargetLanguageId(from);
          updateAutoSelectedTargetLanguageItem(
            getLanguageItemFromYoudaoLanguageId(target)
          );
          translate(from, target);
          return;
        }

        updateLoadingState(false);
        updateTranslateDisplayResult(
          reformatTranslateDisplayResult(reformatResult)
        );
        updateCurrentFromLanguageItem(
          getLanguageItemFromYoudaoLanguageId(from)
        );

        checkIsInstalledEudic(updateIsInstalledEudic);
      })
    );
  }

  // function: display error info when request API failed
  function displayRequestErrorInfo() {
    updateLoadingState(false);
    updateTranslateDisplayResult([]);
  }

  function queryClipboardText(text: string) {
    text = text.trim();
    text = text.substring(0, maxInputTextLength);
    saveQueryClipboardRecord(text);
    updateSearchText(text);
    updateInputText(text);
  }

  useEffect(() => {
    if (searchText) {
      updateLoadingState(true);
      clearTimeout(delayUpdateTargetLanguageTimer);

      tencentLanguageDetect(searchText).then(
        (data) => {
          console.log("tencent language detect: ", data);

          const languageId = data.Lang || "auto";
          const youdaoLanguageId =
            getLanguageItemFromTencentLanguageId(languageId).youdaoLanguageId;
          translateFromYoudaoLanguageId(youdaoLanguageId);
        },
        (err) => {
          console.error("tencent language detect error: ", err);

          const currentLanguageId = getInputTextLanguageId(searchText);
          translateFromYoudaoLanguageId(currentLanguageId);
        }
      );
      return;
    }

    if (!searchText) {
      tryQueryClipboardText(queryClipboardText);
    }
  }, [searchText]);

  function translateFromYoudaoLanguageId(languageId: string) {
    console.log("currentLanguageId: ", languageId);
    updateCurrentFromLanguageItem(
      getLanguageItemFromYoudaoLanguageId(languageId)
    );

    // priority to use user selected target language
    let tartgetLanguageId = userSelectedTargetLanguageItem.youdaoLanguageId;
    console.log("userSelectedTargetLanguage: ", tartgetLanguageId);

    // if conflict, use auto selected target language
    if (languageId === tartgetLanguageId) {
      tartgetLanguageId = getAutoSelectedTargetLanguageId(languageId);
      updateAutoSelectedTargetLanguageItem(
        getLanguageItemFromYoudaoLanguageId(tartgetLanguageId)
      );
      console.log("autoSelectedTargetLanguage: ", tartgetLanguageId);
    }
    translate(languageId, tartgetLanguageId);
  }

  function ListDetail() {
    if (!requestResultState) return null;

    const isYoudaoRequestError =
      requestResultState.type === TranslateType.Youdao &&
      requestResultState.errorInfo.errorCode !==
        YoudaoRequestStateCode.Success.toString();

    const isBaiduRequestError =
      requestResultState.type === TranslateType.Baidu &&
      requestResultState.errorInfo.errorCode !==
        BaiduRequestStateCode.Success.toString();

    let errorTitle = "Network request error:";
    if (isYoudaoRequestError) {
      errorTitle = "Youdao request error:";
    } else if (isBaiduRequestError) {
      errorTitle = "Baidu request error:";
    }

    if (isYoudaoRequestError || isBaiduRequestError) {
      return (
        <List.Item
          title={errorTitle}
          subtitle={`${requestResultState.errorInfo.errorMessage}`}
          accessories={[
            { text: `Error Code: ${requestResultState.errorInfo.errorCode}` },
          ]}
          icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="See Error Code Meaning"
                icon={Icon.QuestionMark}
                url={requestStateCodeLinkMap.get(requestResultState.type)!}
              />
              <ActionFeedback />
            </ActionPanel>
          }
        />
      );
    }

    let eudicWebUrl = getEudicWebTranslateURL(
      searchText || "",
      currentFromLanguageItem!,
      autoSelectedTargetLanguageItem
    );

    let youdaoWebUrl = getYoudaoWebTranslateURL(
      searchText || "",
      currentFromLanguageItem!,
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
                    actions={
                      <ListActionPanel
                        isInstalledEudic={isInstalledEudic}
                        isShowOpenInEudicWeb={eudicWebUrl.length != 0}
                        isShowOpenInYoudaoWeb={youdaoWebUrl.length != 0}
                        eudicWebUrl={eudicWebUrl}
                        youdaoWebUrl={youdaoWebUrl}
                        queryText={searchText}
                        copyText={item.copyText}
                        currentFromLanguage={currentFromLanguageItem}
                        currentTargetLanguage={autoSelectedTargetLanguageItem}
                        onLanguageUpdate={(value) => {
                          updateAutoSelectedTargetLanguageItem(value);
                          updateUserSelectedTargetLanguageItem(value);
                          translate(
                            currentFromLanguageItem!.youdaoLanguageId,
                            value.youdaoLanguageId
                          );
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

  function onInputChangeEvent(text: string) {
    updateInputText(text);

    let trimText = text.trim();
    if (trimText.length == 0) {
      updateLoadingState(false);
      updateTranslateDisplayResult([]);
      return;
    }

    clearTimeout(delayFetchTranslateAPITimer);

    // start delay timer for fetch translate API
    if (trimText.length > 0 && trimText !== searchText) {
      delayFetchTranslateAPITimer = setTimeout(() => {
        trimText = trimText.substring(0, maxInputTextLength);
        updateSearchText(trimText);
      }, delayRequestTime);
    }
  }

  return (
    <List
      isLoading={isLoadingState}
      searchBarPlaceholder={"Search word or translate text..."}
      searchText={inputText}
      onSearchTextChange={onInputChangeEvent}
      actions={
        <ActionPanel>
          <ActionFeedback />
        </ActionPanel>
      }
    >
      <List.EmptyView
        icon={Icon.TextDocument}
        title="Type a word to look up or translate"
      />
      <ListDetail />
    </List>
  );
}
