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
} from "./types";
import {
  BaiduRequestStateCode,
  getYoudaoErrorInfo,
  maxInputTextLength,
  youdaoErrorCodeLink,
  YoudaoRequestStateCode,
} from "./consts";
import {
  checkIsInstalledEudic,
  defaultLanguage1,
  defaultLanguage2,
  getAutoSelectedTargetLanguageId,
  getEudicWebTranslateURL,
  detectInputTextLanguageId,
  getLanguageItemFromTencentDetectLanguageId,
  getLanguageItemFromLanguageId,
  getYoudaoWebTranslateURL,
  myPreferences,
  isTranslateResultTooLong,
  isShowMultipleTranslations,
} from "./utils";
import {
  requestBaiduTextTranslate,
  requestCaiyunTextTranslate,
  requestTencentTextTranslate,
  requestYoudaoDictionary,
  tencentLanguageDetect,
} from "./request";
import {
  formatTranslateDisplayResult,
  formatYoudaoDictionaryResult,
  updateFormateResultWithBaiduTranslation,
  updateFormateResultWithCaiyunTranslation,
  updateFormateResultWithTencentTranslation,
} from "./formatData";
import { playWordAudio } from "./audio";
import { downloadYoudaoAudio } from "./dict/youdao/request";

let youdaoTranslateTypeResult: TranslateTypeResult | undefined;
let delayFetchTranslateAPITimer: NodeJS.Timeout;
let delayUpdateTargetLanguageTimer: NodeJS.Timeout;

export default function () {
  checkLanguageIsSame();

  // Delay the time to call the query API. Since API has frequency limit.
  const delayRequestTime = 600;

  const [isLoadingState, setLoadingState] = useState<boolean>(false);
  const [isShowingDetail, setIsShowingDetail] = useState<boolean>(false);
  const [isInstalledEudic, setIsInstalledEudic] = useState<boolean>(false);

  // use to display input text
  const [inputText, setInputText] = useState<string>("");
  // searchText = inputText.trim(), avoid frequent request API
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

  // check first language and second language is the same
  function checkLanguageIsSame() {
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

  // function to detect the selected text
  async function tryQuerySelecedtText() {
    try {
      const selectedText = await getSelectedText();
      console.log("selectedText: ", selectedText);
      updateInputText(selectedText);
    } catch (error) {
      // do nothing
    }
  }

  // function to query text, automatically detect the language of the input text
  function queryText(text: string) {
    setLoadingState(true);
    clearTimeout(delayUpdateTargetLanguageTimer);

    console.log("translateText:", text);
    tencentLanguageDetect(text).then(
      (data) => {
        console.log("tencent language detect: ", data);

        const languageId = data.Lang || "auto";
        const youdaoLanguageId = getLanguageItemFromTencentDetectLanguageId(languageId).youdaoLanguageId;
        queryTextWithFromLanguageId(youdaoLanguageId);
      },
      (err) => {
        console.error("tencent language detect error: ", err);

        const currentLanguageId = detectInputTextLanguageId(text);
        queryTextWithFromLanguageId(currentLanguageId);
      }
    );
  }

  // function to query text with from youdao language id
  function queryTextWithFromLanguageId(youdaoLanguageId: string) {
    console.log("currentLanguageId: ", youdaoLanguageId);
    setCurrentFromLanguageItem(getLanguageItemFromLanguageId(youdaoLanguageId));

    // priority to use user selected target language
    let tartgetLanguageId = userSelectedTargetLanguageItem.youdaoLanguageId;
    console.log("userSelectedTargetLanguage: ", tartgetLanguageId);

    // if conflict, use auto selected target language
    if (youdaoLanguageId === tartgetLanguageId) {
      tartgetLanguageId = getAutoSelectedTargetLanguageId(youdaoLanguageId);
      setAutoSelectedTargetLanguageItem(getLanguageItemFromLanguageId(tartgetLanguageId));
      console.log("autoSelectedTargetLanguage: ", tartgetLanguageId);
    }
    queryTextFromLanguage(youdaoLanguageId, tartgetLanguageId);
  }

  // function to query search text, with from language id and target language id
  async function queryTextFromLanguage(fromLanguage: string, targetLanguage: string) {
    console.log(`querySearchText fromTo: ${fromLanguage} -> ${targetLanguage}`);

    youdaoTranslateTypeResult = await requestYoudaoDictionary(searchText, fromLanguage, targetLanguage);

    const youdaoResult = youdaoTranslateTypeResult.result as YoudaoTranslateResult;
    console.log(`youdaoResult: ${JSON.stringify(youdaoResult, null, 2)}`);
    const youdaoErrorCode = youdaoResult.errorCode;
    youdaoTranslateTypeResult.errorInfo = getYoudaoErrorInfo(youdaoErrorCode);

    if (youdaoErrorCode === YoudaoRequestStateCode.AccessFrequencyLimited.toString()) {
      delayQueryTextFromLanguage(fromLanguage, targetLanguage);
      return;
    } else if (youdaoErrorCode !== YoudaoRequestStateCode.Success.toString()) {
      console.error(`youdao error: ${JSON.stringify(youdaoTranslateTypeResult.errorInfo)}`);
      updateTranslateDisplayResult(null);
      return;
    }
    let formatResult = formatYoudaoDictionaryResult(youdaoTranslateTypeResult);
    downloadYoudaoAudio(formatResult.queryWordInfo, () => {
      if (myPreferences.isAutomaticPlayWordAudio && formatResult.queryWordInfo.isWord) {
        playWordAudio(formatResult.queryWordInfo.word);
      }
    });

    const [from, to] = youdaoResult.l.split("2"); // from2to
    if (from === to) {
      const target = getAutoSelectedTargetLanguageId(from);
      setAutoSelectedTargetLanguageItem(getLanguageItemFromLanguageId(target));
      queryTextFromLanguage(from, target);
      return;
    }

    setCurrentFromLanguageItem(getLanguageItemFromLanguageId(from));
    updateTranslateDisplayResult(formatResult);
    checkIsInstalledEudic(setIsInstalledEudic);

    if (isShowMultipleTranslations(formatResult)) {
      if (myPreferences.enableBaiduTranslate) {
        console.log("requestBaiduTextTranslate");
        requestBaiduTextTranslate(searchText, fromLanguage, targetLanguage)
          .then((baiduRes) => {
            console.log("requestBaiduTextTranslate success");
            const baiduTranslateResult = baiduRes.result as BaiduTranslateResult;
            const baiduErrorCode = baiduTranslateResult.error_code;

            if (baiduErrorCode) {
              if (baiduErrorCode === BaiduRequestStateCode.AccessFrequencyLimited.toString()) {
                delayQueryTextFromLanguage(fromLanguage, targetLanguage);
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

      if (myPreferences.enableTencentTranslate) {
        console.log(`requestTencentTextTranslate`);
        requestTencentTextTranslate(searchText, fromLanguage, targetLanguage)
          .then((tencentRes) => {
            console.log(`requestTencentTextTranslate success`);
            formatResult = updateFormateResultWithTencentTranslation(tencentRes, formatResult);
            updateTranslateDisplayResult(formatResult);
          })
          .catch((err) => {
            console.error(err);
          });
      }

      if (myPreferences.enableCaiyunTranslate) {
        console.log("requestCaiyunTextTranslate");
        requestCaiyunTextTranslate(searchText, fromLanguage, targetLanguage)
          .then((caiyunRes) => {
            console.log("requestCaiyunTextTranslate success");
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

    return;
  }

  // function to update translate display result, loading state, showing detail
  function updateTranslateDisplayResult(formatResult: TranslateFormatResult | null) {
    setLoadingState(false);
    setIsShowingDetail(isTranslateResultTooLong(formatResult));
    setTranslateDisplayResult(formatTranslateDisplayResult(formatResult));
  }

  // function to delay query search text, later can cancel the query
  function delayQueryTextFromLanguage(fromLanguage: string, targetLanguage: string) {
    delayUpdateTargetLanguageTimer = setTimeout(() => {
      queryTextFromLanguage(fromLanguage, targetLanguage);
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
          subtitle={youdaoErrorMessage?.length ? `: ${youdaoErrorMessage}` : ""}
          accessories={[
            {
              text: `Error Code: ${youdaoErrorCode}`,
            },
          ]}
          icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="See Error Code Meaning" icon={Icon.QuestionMark} url={youdaoErrorCodeLink} />
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
                        onLanguageUpdate={(value) => {
                          setAutoSelectedTargetLanguageItem(value);
                          setUserSelectedTargetLanguageItem(value);
                          queryTextFromLanguage(currentFromLanguageItem.youdaoLanguageId, value.youdaoLanguageId);
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

  // function to update input text and search text
  function updateInputText(text: string) {
    setInputText(text);

    const trimText = text.trim().substring(0, maxInputTextLength);
    if (trimText.length === 0) {
      updateTranslateDisplayResult(null);
      return;
    }

    clearTimeout(delayFetchTranslateAPITimer);

    // start delay timer for fetch translate API
    if (trimText !== searchText) {
      delayFetchTranslateAPITimer = setTimeout(() => {
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
