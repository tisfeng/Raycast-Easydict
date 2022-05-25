import { Fragment, useEffect, useState } from "react";
import { ActionFeedback, ListActionPanel } from "./components";
import {
  Action,
  ActionPanel,
  Clipboard,
  Color,
  getPreferenceValues,
  Icon,
  Image,
  List,
  LocalStorage,
} from "@raycast/api";
import {
  ILanguageListItem,
  IPreferences,
  ITranslateReformatResult,
  ITranslateReformatResultItem,
  ITranslateResult,
} from "./types";
import {
  requestYoudaoAPI,
  getItemFromLanguageList,
  reformatTranslateResult,
} from "./shared.func";
import { SectionType } from "./consts";

let fetchResultStateCode = "-1";
let delayFetchTranslateAPITimer: NodeJS.Timeout;
let delayUpdateTargetLanguageTimer: NodeJS.Timeout;

export default function () {
  // use to display input text
  const [inputText, updateInputText] = useState<string>();
  // searchText = inputText.trim(), avoid frequent request API
  const [searchText, updateSearchText] = useState<string>();

  const [isLoadingState, updateLoadingState] = useState<boolean>(false);

  const preferences: IPreferences = getPreferenceValues();
  const defaultLanguage1 = getItemFromLanguageList(preferences.language1);
  const defaultLanguage2 = getItemFromLanguageList(preferences.language2);
  const preferredLanguages = [defaultLanguage1, defaultLanguage2];

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

  const [translateResultState, updateTranslateResultState] =
    useState<ITranslateReformatResult[]>();

  // the language type of text, depending on the language type of the current input text, it is preferred to judge whether it is English or Chinese according to the preferred language, and then auto
  const [currentFromLanguageState, updateCurrentFromLanguageState] =
    useState<ILanguageListItem>();

  // default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
  const [autoSelectedTargetLanguage, updateAutoSelectedTargetLanguage] =
    useState<ILanguageListItem>(defaultLanguage1);

  // the user selected translation language, for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
  const [userSelectedTargetLanguage, updateUserSelectedTargetLanguage] =
    useState<ILanguageListItem>(autoSelectedTargetLanguage);

  function translate(fromLanguage: string, targetLanguage: string) {
    requestYoudaoAPI(searchText!, fromLanguage, targetLanguage).then((res) => {
      const resData: ITranslateResult = res.data;

      console.log(`translate: ${fromLanguage} -> ${targetLanguage}`);

      const result = JSON.stringify(resData);
      console.log("result: ", result);
      // Clipboard.copy(result);

      const [from, to] = resData.l.split("2"); // from2to
      if (from === to) {
        translate(from, getAutoSelectedTargetLanguageId(from));
        return;
      }

      if (res.data.errorCode === "207") {
        delayUpdateTargetLanguageTimer = setTimeout(() => {
          console.log("--> 207: " + from + to);
          translate(from, to);
        }, delayRequestTime);
        return;
      }

      updateLoadingState(false);
      fetchResultStateCode = res.data.errorCode;
      updateTranslateResultState(reformatTranslateResult(resData));
      updateCurrentFromLanguageState(getItemFromLanguageList(from));
    });
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
      return;
    }

    if (!searchText) {
      queryClipboardText();
    }
  }, [searchText]);

  // function: Returns the corresponding ImageLike based on the SectionType type
  function getListItemIcon(sectionType: SectionType): Image.ImageLike {
    let dotColor: Color.ColorLike = Color.PrimaryText;
    switch (sectionType) {
      case SectionType.Translation: {
        dotColor = Color.Red;
        break;
      }
      case SectionType.Detail: {
        dotColor = Color.Blue;
        break;
      }
      case SectionType.WebTranslation: {
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
    if (sectionType === SectionType.Wfs) {
      itemIcon = Icon.Text;
    }
    return itemIcon;
  }

  // function: return List.Item.Accessory[] based on the SectionType type
  function getWordAccessories(
    sectionType: SectionType,
    item: ITranslateReformatResultItem
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
            icon: {
              source: { light: "speak.png", dark: "speak.png" },
              tintColor: { light: "gray", dark: "lightgray" },
            },
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
    // const result = JSON.stringify(translateResultState);
    // console.log(JSON.stringify(translateResultState));
    // Clipboard.copy(result);
    // console.log(JSON.stringify(translateResultState, null, 4));

    if (fetchResultStateCode === "0") {
      return (
        <Fragment>
          {translateResultState?.map((resultItem, idx) => {
            const sectionTitle = idx < 2 ? resultItem.type : undefined;
            const itemTooltip = idx >= 2 ? resultItem.type : "";
            return (
              <List.Section key={idx} title={sectionTitle}>
                {resultItem.children?.map((item) => {
                  return (
                    <List.Item
                      key={item.key}
                      icon={{
                        value: getListItemIcon(resultItem.type),
                        tooltip: itemTooltip,
                      }}
                      title={item.title}
                      subtitle={item.subtitle}
                      accessories={getWordAccessories(resultItem.type, item)}
                      actions={
                        <ListActionPanel
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
        title={`Sorry! We have some problems..`}
        subtitle={`code: ${fetchResultStateCode}`}
        icon={{ source: Icon.XmarkCircle, tintColor: Color.Red }}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Help"
              icon={Icon.QuestionMark}
              url="https://github.com/Haojen/raycast-Parrot#error-code-information"
            />
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
      updateTranslateResultState([]);
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
