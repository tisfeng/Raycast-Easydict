import { Fragment, useEffect, useState } from "react";
import {
  ActionFeedback,
  eudicBundleId,
  ListActionPanel,
  playSoundIcon,
} from "./components";
import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  getApplications,
  getPreferenceValues,
  Icon,
  Image,
  List,
  LocalStorage,
} from "@raycast/api";
import {
  BaiduTranslateResult,
  CaiyunTranslateResult,
  LanguageItem,
  IPreferences,
  TranslateSourceResult,
  TranslateDisplayResult,
  YoudaoTranslateReformatResult,
  YoudaoTranslateReformatResultItem,
  YoudaoTranslateResult,
} from "./types";
import {
  getItemFromLanguageList,
  reformatYoudaoTranslateResult,
  requestAllTranslateAPI,
  reformatTranslateResult,
  reformatTranslateDisplayResult,
} from "./shared.func";
import { SectionType, TranslationType } from "./consts";
import axios from "axios";

let fetchResultStateCode = "-1";
let delayFetchTranslateAPITimer: NodeJS.Timeout;
let delayUpdateTargetLanguageTimer: NodeJS.Timeout;

export default function () {
  // use to display input text
  const [inputText, updateInputText] = useState<string>();
  // searchText = inputText.trim(), avoid frequent request API
  const [searchText, updateSearchText] = useState<string>();

  const [isLoadingState, updateLoadingState] = useState<boolean>(false);

  const [isInstalledEudic, updateIsInstalledEudic] = useState<boolean>(false);

  const preferences: IPreferences = getPreferenceValues();
  const defaultLanguage1 = getItemFromLanguageList(preferences.language1);
  const defaultLanguage2 = getItemFromLanguageList(preferences.language2);

  // Delay the time to call the query API. The API has frequency limit.
  const delayRequestTime = 600;

  // Time interval for automatic query of the same clipboard text, avoid frequently querying the same word. Default 10min
  const clipboardQueryInterval = 60 * 1000;

  if (defaultLanguage1.languageId === defaultLanguage2.languageId) {
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

  const [youdaoTranslateResultState, updateYoudaoTranslateResultState] =
    useState<YoudaoTranslateReformatResult[]>();

  /**
     the language type of text, depending on the language type of the current input text, it is preferred to judge whether it is English or Chinese according to the preferred language, and then auto
     */
  const [currentFromLanguageState, updateCurrentFromLanguageState] =
    useState<LanguageItem>();

  /*
    default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
    */
  const [autoSelectedTargetLanguage, updateAutoSelectedTargetLanguage] =
    useState<LanguageItem>(defaultLanguage1);

  /*
    the user selected translation language, for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
    */
  const [userSelectedTargetLanguage, updateUserSelectedTargetLanguage] =
    useState<LanguageItem>(autoSelectedTargetLanguage);

  function translate(fromLanguage: string, targetLanguage: string) {
    requestAllTranslateAPI(searchText!, fromLanguage, targetLanguage).then(
      axios.spread((youdaoRes: any, baiduRes: any, caiyunRes: any) => {
        const youdaoTranslateResult: YoudaoTranslateResult = youdaoRes.data;
        console.log(`translate: ${fromLanguage} -> ${targetLanguage}`);
        console.log("youdao result: ", JSON.stringify(youdaoTranslateResult));

        const baiduTranslateResult: BaiduTranslateResult = baiduRes.data;
        console.log("baidu result: ", JSON.stringify(baiduTranslateResult));

        const caiyunTranslateResult: CaiyunTranslateResult = caiyunRes.data;
        console.log("caiyun result: ", JSON.stringify(caiyunRes.data));

        const sourceResult: TranslateSourceResult = {
          youdaoResult: youdaoTranslateResult,
          baiduResult: baiduTranslateResult,
          caiyunResult: caiyunTranslateResult,
        };
        const reformatResult = reformatTranslateResult(sourceResult);
        console.log("reformatResult: ", JSON.stringify(reformatResult));

        const [from, to] = youdaoTranslateResult.l.split("2"); // from2to
        if (from === to) {
          translate(from, getAutoSelectedTargetLanguageId(from));
          return;
        }

        if (
          youdaoRes.data.errorCode === "207" ||
          baiduRes.data.errorCode === "54003"
        ) {
          delayUpdateTargetLanguageTimer = setTimeout(() => {
            console.log(
              "--> error_code: ",
              youdaoRes.data.error_code || baiduRes.data.error_code
            );
            translate(from, to);
          }, delayRequestTime);
          return;
        }

        const displayResult = reformatTranslateDisplayResult(reformatResult);
        updateTranslateDisplayResult(displayResult);

        const baiduResultText = baiduTranslateResult.trans_result
          .map((item) => {
            return item.dst;
          })
          .join(" ");

        const caiyunResultText = caiyunTranslateResult.target;

        youdaoTranslateResult.translation.push(
          baiduResultText,
          caiyunResultText
        );

        updateLoadingState(false);
        fetchResultStateCode = youdaoRes.data.errorCode;
        const youdaoResult: YoudaoTranslateReformatResult[] =
          reformatYoudaoTranslateResult(youdaoTranslateResult);

        updateYoudaoTranslateResultState(
          reformatYoudaoTranslateResult(youdaoTranslateResult)
        );
        updateCurrentFromLanguageState(getItemFromLanguageList(from));
      })
    );
  }

  // function: save last Clipboard text and timestamp
  function saveQueryClipboardRecord(text: string) {
    LocalStorage.setItem(text, new Date().getTime());
    // console.log("save", text, new Date().getTime());
  }

  // function: remove all punctuation from the text
  function removeEnglishPunctuation(text: string) {
    return text.replace(
      /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g,
      ""
    );
  }

  // function: remove all Chinese punctuation and blank space from the text
  function removeChinesePunctuation(text: string) {
    return text.replace(
      /[\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g,
      ""
    );
  }

  // function: remove all punctuation from the text
  function removePunctuation(text: string) {
    return removeEnglishPunctuation(removeChinesePunctuation(text));
  }

  // function: remove all blank space from the text
  function removeBlankSpace(text: string) {
    return text.replace(/\s/g, "");
  }

  // function: check if the text contains Chinese characters
  function isContainChinese(text: string) {
    return /[\u4e00-\u9fa5]/g.test(text);
  }

  // function: check if text isEnglish or isNumber
  function isEnglishOrNumber(text: string) {
    const pureText = removePunctuation(removeBlankSpace(text));
    console.log("pureText: " + pureText);
    return /^[a-zA-Z0-9]+$/.test(pureText);
  }

  // function: get the language type represented by the string, priority to use English and Chinese, and then auto
  function getInputTextLanguageId(inputText: string): string {
    let fromLanguageId = "auto";
    const englishLanguageId = "en";
    const chineseLanguageId = "zh-CHS";
    if (
      isEnglishOrNumber(inputText) &&
      (defaultLanguage1.languageId === englishLanguageId ||
        defaultLanguage2.languageId === englishLanguageId)
    ) {
      fromLanguageId = englishLanguageId;
    } else if (
      isContainChinese(inputText) &&
      (defaultLanguage1.languageId === chineseLanguageId ||
        defaultLanguage2.languageId === chineseLanguageId)
    ) {
      fromLanguageId = chineseLanguageId;
    }

    console.log("fromLanguage-->:", fromLanguageId);
    return fromLanguageId;
  }

  // function: return and update the autoSelectedTargetLanguage according to the languageId
  function getAutoSelectedTargetLanguageId(
    accordingLanguageId: string
  ): string {
    let targetLanguageId = "auto";
    if (accordingLanguageId === defaultLanguage1.languageId) {
      targetLanguageId = defaultLanguage2.languageId;
    } else if (accordingLanguageId === defaultLanguage2.languageId) {
      targetLanguageId = defaultLanguage1.languageId;
    }

    const targetLanguage = getItemFromLanguageList(targetLanguageId);
    updateAutoSelectedTargetLanguage(targetLanguage);

    console.log(
      `languageId: ${accordingLanguageId}, auto selected target: ${targetLanguage.languageId}`
    );
    return targetLanguage.languageId;
  }

  async function traverseAllInstalledApplications() {
    const installedApplications = await getApplications();
    LocalStorage.setItem(eudicBundleId, false);
    updateIsInstalledEudic(false);

    for (const application of installedApplications) {
      console.log(application.bundleId);
      if (application.bundleId === eudicBundleId) {
        updateIsInstalledEudic(true);
        LocalStorage.setItem(eudicBundleId, true);

        console.log("isInstalledEudic: true");
      }
    }
  }

  function checkIsInstalledEudic() {
    LocalStorage.getItem<boolean>(eudicBundleId).then((isInstalledEudic) => {
      console.log("is install: ", isInstalledEudic);

      if (isInstalledEudic == true) {
        updateIsInstalledEudic(true);
      } else if (isInstalledEudic == false) {
        updateIsInstalledEudic(false);
      } else {
        traverseAllInstalledApplications();
      }
    });
  }

  // function: query the clipboard text from LocalStorage
  async function queryClipboardText() {
    let text = await Clipboard.readText();
    console.log("query clipboard text: " + text);
    if (text) {
      const timestamp = await LocalStorage.getItem<number>(text);
      const now = new Date().getTime();
      console.log(`timestamp: ${timestamp}, now: ${now}`);
      if (!timestamp || now - timestamp > clipboardQueryInterval) {
        text = text.trim();
        saveQueryClipboardRecord(text);
        updateSearchText(text);
        updateInputText(text);
      }
    }
  }

  useEffect(() => {
    if (searchText) {
      updateLoadingState(true);
      clearTimeout(delayUpdateTargetLanguageTimer);

      const currentLanguageId = getInputTextLanguageId(searchText);
      updateCurrentFromLanguageState(
        getItemFromLanguageList(currentLanguageId)
      );

      // priority to use user selected target language
      let tartgetLanguageId = userSelectedTargetLanguage.languageId;
      // if conflict, use auto selected target language
      if (currentLanguageId === tartgetLanguageId) {
        tartgetLanguageId = getAutoSelectedTargetLanguageId(currentLanguageId);
      }
      translate(currentLanguageId, tartgetLanguageId);
      checkIsInstalledEudic();

      return;
    }

    if (!searchText) {
      queryClipboardText();
    }
  }, [searchText]);

  // function: Returns the corresponding ImageLike based on the SectionType type
  function getListItemIcon(
    sectionType: SectionType | TranslationType
  ): Image.ImageLike {
    let dotColor: Color.ColorLike = Color.PrimaryText;
    switch (sectionType) {
      case TranslationType.Youdao: {
        dotColor = Color.Red;
        break;
      }
      case TranslationType.Baidu: {
        dotColor = "#4169E1";
        break;
      }
      case TranslationType.Caiyun: {
        dotColor = Color.Green;
        break;
      }

      case SectionType.Translation: {
        dotColor = Color.Red;
        break;
      }
      case SectionType.Detail || TranslationType.Baidu: {
        dotColor = Color.Blue;
        break;
      }
      case SectionType.WebTranslation || TranslationType.Caiyun: {
        dotColor = Color.Yellow;
        break;
      }
      case SectionType.WebPhrase: {
        dotColor = "teal"; //{ light: "#00B0FF", dark: "#0081EA" };
        break;
      }
    }

    let itemIcon: Image.ImageLike = {
      source: Icon.Dot,
      tintColor: dotColor,
    };
    if (sectionType === SectionType.Forms) {
      itemIcon = Icon.Text;
    }
    return itemIcon;
  }

  // function: return List.Item.Accessory[] based on the SectionType type
  function getWordAccessories(
    sectionType: string,
    item: YoudaoTranslateReformatResultItem
  ): List.Item.Accessory[] {
    let wordExamTypeAccessory = [];
    let pronunciationAccessory = [];
    let wordAccessories: any[] = [];
    if (sectionType === SectionType.Translation) {
      if (item.examTypes) {
        wordExamTypeAccessory = [
          {
            icon: { source: Icon.Star, tintColor: Color.SecondaryText },
            tooltip: "Word included in the types of exam",
          },
          { text: item.examTypes?.join("  ") },
        ];
        wordAccessories = [...wordExamTypeAccessory];
      }
      if (item.phonetic) {
        pronunciationAccessory = [
          {
            icon: playSoundIcon("gray"),
            tooltip: "Pronunciation",
          },
          { text: item.phonetic },
        ];
        wordAccessories = [
          ...wordAccessories,
          { text: " " },
          ...pronunciationAccessory,
        ];
      }
    }
    return wordAccessories;
  }

  function ListDetail() {
    if (fetchResultStateCode === "-1") return null;
    if (fetchResultStateCode === "0") {
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
                          queryText={searchText}
                          copyText={item.copyText}
                          currentFromLanguage={currentFromLanguageState}
                          currentTargetLanguage={autoSelectedTargetLanguage}
                          onLanguageUpdate={(value) => {
                            updateAutoSelectedTargetLanguage(value);
                            updateUserSelectedTargetLanguage(value);
                            translate(
                              currentFromLanguageState!.languageId,
                              value.languageId
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

    return (
      <List.Item
        title={`Sorry, network request service error.`}
        accessories={[{ text: `Error code: ${fetchResultStateCode}` }]}
        icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="See Error Code Meaning"
              icon={Icon.QuestionMark}
              url="https://ai.youdao.com/DOCSIRMA/html/%E8%87%AA%E7%84%B6%E8%AF%AD%E8%A8%80%E7%BF%BB%E8%AF%91/API%E6%96%87%E6%A1%A3/%E6%96%87%E6%9C%AC%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1/%E6%96%87%E6%9C%AC%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1-API%E6%96%87%E6%A1%A3.html#section-11"
            />
            <ActionFeedback />
          </ActionPanel>
        }
      />
    );
  }

  function onInputChangeEvent(text: string) {
    updateInputText(text);

    const trimText = text.trim();
    if (trimText.length == 0) {
      updateLoadingState(false);
      updateYoudaoTranslateResultState([]);
      return;
    }

    clearTimeout(delayFetchTranslateAPITimer);

    // start delay timer for fetch translate API
    if (trimText.length > 0 && trimText !== searchText) {
      delayFetchTranslateAPITimer = setTimeout(() => {
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
