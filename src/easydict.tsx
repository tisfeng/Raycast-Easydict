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
  TranslateTypeResult,
  YoudaoTranslateResult,
  BaiduTranslateResult,
  TencentTranslateResult,
  CaiyunTranslateResult,
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
  getLanguageItemFromTencentDetectLanguageId,
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

let youdaoTranslateTypeResult: TranslateTypeResult;

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
        let baiduRes: TranslateTypeResult | null = null;
        let tecentRes: TranslateTypeResult | null = null;
        let caiyunRes: TranslateTypeResult | null = null;

        let youdaoTranslateReuslt: YoudaoTranslateResult;
        let baiduTranslateResult: BaiduTranslateResult;
        let tencentTranslateResult: TencentTranslateResult;
        let caiyunTranslateResult: CaiyunTranslateResult;

        let sourceResult: TranslateSourceResult = {} as TranslateSourceResult;

        for (const res of typeResult) {
          console.log(
            `${res.type} result: ${JSON.stringify(res.result, null, 4)}`
          );
          if (res.type === TranslateType.Youdao) {
            youdaoTranslateTypeResult = res;
            youdaoTranslateReuslt = res.result as YoudaoTranslateResult;
            const youdaoErrorCode = youdaoTranslateReuslt.errorCode;
            youdaoTranslateTypeResult.errorInfo =
              getYoudaoErrorInfo(youdaoErrorCode);

            sourceResult.youdaoResult = youdaoTranslateReuslt;

            if (
              youdaoErrorCode ===
              YoudaoRequestStateCode.AccessFrequencyLimited.toString()
            ) {
              delayTranslate(fromLanguage, targetLanguage);
              return;
            } else if (
              youdaoErrorCode !== YoudaoRequestStateCode.Success.toString()
            ) {
              updateLoadingState(false);
              updateTranslateDisplayResult([]);
              return;
            }
          }

          if (res.type === TranslateType.Baidu) {
            baiduRes = res;
            baiduTranslateResult = baiduRes.result as BaiduTranslateResult;
            const baiduErrorCode = baiduTranslateResult.error_code;

            sourceResult.baiduResult = baiduTranslateResult;

            if (baiduErrorCode) {
              if (
                baiduErrorCode ===
                BaiduRequestStateCode.AccessFrequencyLimited.toString()
              ) {
                delayTranslate(fromLanguage, targetLanguage);
                return;
              }

              baiduRes.errorInfo = {
                errorCode: baiduErrorCode,
                errorMessage: baiduTranslateResult.error_msg!,
              };
              showToast({
                style: Toast.Style.Failure,
                title: `${baiduRes.type}: ${baiduErrorCode}`,
                message: baiduRes.errorInfo.errorMessage,
              });
            }
          }

          if (res.type === TranslateType.Tencent) {
            tecentRes = res;
            sourceResult.tencentResult = res.result as TencentTranslateResult;
          }

          if (res.type === TranslateType.Caiyun) {
            caiyunRes = res;
            sourceResult.caiyunResult = res.result as CaiyunTranslateResult;

            if (caiyunRes.errorInfo) {
              showToast({
                style: Toast.Style.Failure,
                title: `${res.type.split(" ")[0]} Error: ${
                  res.errorInfo!.errorCode
                }`,
                message: res.errorInfo!.errorMessage,
              });
            }
          }
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

  function delayTranslate(fromLanguage: string, targetLanguage: string) {
    delayUpdateTargetLanguageTimer = setTimeout(() => {
      translate(fromLanguage, targetLanguage);
    }, delayRequestTime);
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

      console.log(`translate text: ${searchText}`);
      tencentLanguageDetect(searchText).then(
        (data) => {
          console.log("tencent language detect: ", data);

          const languageId = data.Lang || "auto";
          const youdaoLanguageId =
            getLanguageItemFromTencentDetectLanguageId(
              languageId
            ).youdaoLanguageId;
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
    if (!youdaoTranslateTypeResult) return null;

    const youdaoErrorCode = (
      youdaoTranslateTypeResult.result as YoudaoTranslateResult
    ).errorCode;
    const youdaoErrorMessage =
      youdaoTranslateTypeResult!.errorInfo!.errorMessage;
    const isYoudaoRequestError =
      youdaoErrorCode !== YoudaoRequestStateCode.Success.toString();

    if (isYoudaoRequestError) {
      return (
        <List.Item
          title={"Youdao Request Error"}
          subtitle={youdaoErrorMessage.length ? `: ${youdaoErrorMessage}` : ""}
          accessories={[
            {
              text: `Error Code: ${youdaoErrorCode}`,
            },
          ]}
          icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="See Error Code Meaning"
                icon={Icon.QuestionMark}
                url={
                  requestStateCodeLinkMap.get(youdaoTranslateTypeResult.type)!
                }
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
