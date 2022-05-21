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

// Time interval for automatic query of the same clipboard word.
const clipboardQueryDuration = 5 * 1000;

export default function () {
  const [inputState, updateInputState] = useState<string>();
  const [isLoadingState, updateLoadingState] = useState<boolean>(false);

  const preferences: IPreferences = getPreferenceValues();
  const defaultLanguage1 = getItemFromLanguageList(preferences.lang1);
  const defaultLanguage2 = getItemFromLanguageList(preferences.lang2);

  let delayRequestTime =
    parseInt(preferences.delayFetchTranslateAPITime) || 400;

  if (delayRequestTime < 50) {
    delayRequestTime = 50;
  } else if (delayRequestTime > 600) {
    delayRequestTime = 600;
  }

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

  const [currentFromLanguageState, updateCurrentFromLanguageState] =
    useState<ILanguageListItem>();
  const [translateTargetLanguage, updateTranslateTargetLanguage] =
    useState<ILanguageListItem>(defaultLanguage1);
  const [currentTargetLanguage, setCurrentTargetLanguage] =
    useState<ILanguageListItem>(defaultLanguage1);

  function translate(fromLanguage: string, targetLanguage: string) {
    requestYoudaoAPI(inputState!, fromLanguage, targetLanguage).then((res) => {
      const resData: ITranslateResult = res.data;

      console.log(
        "fromLanguage 0: " + fromLanguage,
        "targetLanguage: " + targetLanguage
      );
      // const result = JSON.stringify(resData);
      // console.log(JSON.stringify(resData));
      // Clipboard.copy(result);

      const [from, to] = resData.l.split("2"); // from2to

      if (from === to) {
        let target: string;
        if (from === preferences.lang1) {
          target = defaultLanguage2.languageId;
          setCurrentTargetLanguage(defaultLanguage2);
        } else {
          target = defaultLanguage1.languageId;
          setCurrentTargetLanguage(defaultLanguage1);
        }

        console.log("from===to: " + from + target);
        translate(from, target);
        return;
      }

      if (res.data.errorCode === "207") {
        delayUpdateTargetLanguageTimer = setTimeout(() => {
          console.log("207: " + from + to);
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
    console.log("save", text, new Date().getTime());
  }

  useEffect(() => {
    console.log("inputState: ", inputState);

    if (inputState) {
      updateLoadingState(true);
      clearTimeout(delayUpdateTargetLanguageTimer);
      console.log(
        "useEffect==>: " + "auto" + translateTargetLanguage.languageId
      );
      translate("auto", translateTargetLanguage.languageId);
      return;
    }

    if (!inputState) {
      console.log("inputState 2: ", inputState);
      Clipboard.readText().then((text) => {
        if (text) {
          console.log("text: ", text);
          LocalStorage.getItem<number>(text!).then((timestamp) => {
            console.log(text, "lastRecordTime: ", timestamp);
            if (
              !timestamp ||
              new Date().getTime() - timestamp > clipboardQueryDuration
            ) {
              updateInputState(text);
              saveQueryClipboardRecord(text);
            }
          });
        }
      });
    }
  }, [inputState]);

  // function: Returns the corresponding ImageLike based on the SectionType type
  function getSectionIcon(sectionType: SectionType): Image.ImageLike {
    let dotColor: Color = Color.PrimaryText;
    switch (sectionType) {
      case SectionType.Translation: {
        dotColor = Color.Red;
        break;
      }
      case SectionType.Detail: {
        dotColor = Color.Blue;
        break;
      }
      case SectionType.WebResults: {
        dotColor = Color.Yellow;
        break;
      }
    }
    let sectionIcon: Image.ImageLike = {
      source: Icon.Dot,
      tintColor: dotColor,
    };
    if (sectionType === SectionType.Wfs) {
      sectionIcon = Icon.Text;
    }
    return sectionIcon;
  }

  // function: return List.Item.Accessory[] based on the SectionType type
  function getSectionAccessories(
    sectionType: SectionType,
    item: ITranslateReformatResultItem
  ): List.Item.Accessory[] {
    let wordExamTypeAccessory: List.Item.Accessory[] = [];
    let pronunciationAccessory: List.Item.Accessory[] = [];
    let wordAccessories = wordExamTypeAccessory.concat(pronunciationAccessory);
    if (sectionType === SectionType.Translation) {
      if (item.subtitle) {
        wordExamTypeAccessory = [
          { icon: { source: Icon.Star, tintColor: Color.SecondaryText } },
          { text: item.subtitle },
        ];
      }
      if (item.phonetic) {
        pronunciationAccessory = [
          {
            icon: {
              source: "speak.png",
              tintColor: "gray", //"#696969",
            },
          },
          { text: item.phonetic },
        ];
      }
      wordAccessories = wordExamTypeAccessory
        .concat([{ text: "    " }])
        .concat(pronunciationAccessory);
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
          {translateResultState?.map((result, idx) => {
            const sectionTitle = idx < 2 ? SectionType[result.type] : undefined;
            return (
              <List.Section key={idx} title={sectionTitle}>
                {result.children?.map((item) => {
                  return (
                    <List.Item
                      key={item.key}
                      icon={getSectionIcon(result.type)}
                      title={item.title}
                      subtitle={idx == 0 ? "" : item.subtitle}
                      accessories={getSectionAccessories(result.type, item)}
                      actions={
                        <ListActionPanel
                          queryText={inputState}
                          copyText={item?.subtitle || item.title}
                          currentFromLanguage={currentFromLanguageState}
                          currentTargetLanguage={currentTargetLanguage}
                          onLanguageUpdate={(value) => {
                            setCurrentTargetLanguage(value);
                            updateTranslateTargetLanguage(value);
                            console.log(
                              "onLanguageUpdate: " + "auto" + value.languageId
                            );
                            translate("auto", value.languageId);
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

  function onInputChangeEvt(queryText: string) {
    updateLoadingState(false);
    clearTimeout(delayFetchTranslateAPITimer);

    const text = queryText.trim();
    if (text.length > 0) {
      delayFetchTranslateAPITimer = setTimeout(() => {
        updateInputState(text);
      }, delayRequestTime);
      return;
    }
    updateTranslateResultState([]);
  }

  return (
    <List
      isLoading={isLoadingState}
      searchBarPlaceholder={"Look up words"}
      searchText={inputState}
      onSearchTextChange={onInputChangeEvt}
      actions={
        <ActionPanel>
          <ActionFeedback />
        </ActionPanel>
      }
    >
      <List.EmptyView
        icon={Icon.TextDocument}
        title="Type something to look up."
      />
      <ListDetail />
    </List>
  );
}
