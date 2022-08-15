/*
 * @author: tisfeng
 * @createTime: 2022-06-23 14:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-15 16:43
 * @fileName: easydict.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Color, getSelectedText, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { configAxiosProxy } from "./axiosConfig";
import { getListItemIcon, getWordAccessories, ListActionPanel } from "./components";
import { DataManager } from "./dataManager";
import { QueryWordInfo } from "./dict/youdao/types";
import { LanguageItem } from "./language/type";
import { myPreferences, preferrdLanguage1, preferrdLanguage2 } from "./preferences";
import { DisplaySection } from "./types";
import { checkIfInstalledEudic, trimTextLength } from "./utils";

const dataManager = new DataManager();

export default function () {
  if (preferrdLanguage1.youdaoLanguageId === preferrdLanguage2.youdaoLanguageId) {
    return (
      <List searchBarPlaceholder="Error">
        <List.Item
          title={"Preferrd Languages Conflict"}
          icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
          subtitle={"Your First Language and Second Language must be different!"}
        />
      </List>
    );
  }

  const [isLoadingState, setLoadingState] = useState<boolean>(false);
  const [isShowingDetail, setIsShowingDetail] = useState<boolean>(false);
  const [isInstalledEudic, setIsInstalledEudic] = useState<boolean>(false);

  /**
   * use to display input text
   */
  const [inputText, setInputText] = useState<string>();
  /**
   * searchText = inputText.trim(), avoid frequent request API with blank input.
   */
  const [searchText, setSearchText] = useState<string>("");

  const [displayResult, setDisplayResult] = useState<DisplaySection[]>([]);

  /**
   * the language type of text, depending on the language type of the current input text.
   */
  const [currentFromLanguageItem, setCurrentFromLanguageItem] = useState<LanguageItem>(preferrdLanguage1);
  /**
   * default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
   */
  const [autoSelectedTargetLanguageItem, setAutoSelectedTargetLanguageItem] = useState<LanguageItem>(preferrdLanguage1);
  /**
   * the user selected translation language, used for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
   */
  const [userSelectedTargetLanguageItem, setUserSelectedTargetLanguageItem] =
    useState<LanguageItem>(autoSelectedTargetLanguageItem);

  function updateDisplaySections(displayItems: DisplaySection[]) {
    setIsShowingDetail(dataManager.isShowDetail);
    setDisplayResult(displayItems);
  }

  // Todo: need to optimize these callbacks.
  dataManager.updateLoadingState = setLoadingState;
  dataManager.updateListDisplaySections = updateDisplaySections;
  dataManager.updateCurrentFromLanguageItem = setCurrentFromLanguageItem;
  dataManager.updateAutoSelectedTargetLanguageItem = setAutoSelectedTargetLanguageItem;

  useEffect(() => {
    console.log("enter useEffect");
    if (inputText === undefined) {
      setup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  /**
   * Do something setup when the extension is activated. Only run once.
   */
  function setup() {
    if (myPreferences.enableAutomaticQuerySelectedText) {
      tryQuerySelecedtText();
    }
    checkIfInstalledEudic().then((isInstalled) => {
      setIsInstalledEudic(isInstalled);
    });
    configAxiosProxy();
  }

  /**
   * Try to detect the selected text, if detect success, then query the selected text.
   */
  function tryQuerySelecedtText() {
    const startTime = Date.now();
    getSelectedText()
      .then((selectedText) => {
        selectedText = trimTextLength(selectedText);
        console.log(`getSelectedText: ${selectedText}, cost time: ${Date.now() - startTime} ms`);
        updateInputTextAndQueryText(selectedText, false);
      })
      .catch(() => {
        // do nothing
      });
  }

  /**
   * User select target language manually.
   */
  const updateSelectedTargetLanguageItem = (selectedLanguageItem: LanguageItem) => {
    console.log(
      `selected language: ${selectedLanguageItem.youdaoLanguageId}, current target language: ${userSelectedTargetLanguageItem.youdaoLanguageId}`
    );
    if (selectedLanguageItem.youdaoLanguageId === userSelectedTargetLanguageItem.youdaoLanguageId) {
      return;
    }

    console.log(`updateSelectedTargetLanguageItem: ${selectedLanguageItem.youdaoLanguageId}`);
    setAutoSelectedTargetLanguageItem(selectedLanguageItem);
    setUserSelectedTargetLanguageItem(selectedLanguageItem);

    const quertWordInfo: QueryWordInfo = {
      word: searchText,
      fromLanguage: currentFromLanguageItem.youdaoLanguageId,
      toLanguage: selectedLanguageItem.youdaoLanguageId,
    };

    // * Clean up previous query results immediately before new query.
    dataManager.clearQueryResult();
    dataManager.queryTextWithTextInfo(quertWordInfo);
  };

  /**
   * Update input text and search text, then query text according to @isDelay
   */
  function updateInputTextAndQueryText(text: string, isDelay: boolean) {
    console.log(`update input text: ${text}, length: ${text.length}`);

    setInputText(text);
    const trimText = trimTextLength(text);
    setSearchText(trimText);

    // If trimText is empty, then do not query.
    if (trimText.length === 0) {
      console.log("trimText is empty, do not query");
      dataManager.clearQueryResult();
      return;
    }

    // Only different input text, then clear old results before new input text query.
    if (trimText !== searchText) {
      dataManager.clearQueryResult();

      const toLanguage = userSelectedTargetLanguageItem.youdaoLanguageId;
      dataManager.delayQueryText(trimText, toLanguage, isDelay);
    }
  }

  function onInputChange(text: string) {
    // Delay query text.
    updateInputTextAndQueryText(text, true);
  }

  return (
    <List
      isLoading={isLoadingState}
      isShowingDetail={isShowingDetail}
      searchBarPlaceholder={"Search word or translate text..."}
      searchText={inputText}
      onSearchTextChange={onInputChange}
      actions={null}
    >
      {displayResult.map((resultItem, idx) => {
        return (
          <List.Section key={idx} title={resultItem.sectionTitle}>
            {resultItem.items?.map((item) => {
              return (
                <List.Item
                  key={item.key}
                  icon={{
                    value: getListItemIcon(item.displayType),
                    tooltip: item.tooltip || "",
                  }}
                  title={item.title}
                  subtitle={item.subtitle}
                  accessories={getWordAccessories(item)}
                  detail={<List.Item.Detail markdown={item.translationMarkdown} />}
                  actions={
                    <ListActionPanel
                      displayItem={item}
                      isInstalledEudic={isInstalledEudic && myPreferences.enableOpenInEudic}
                      onLanguageUpdate={updateSelectedTargetLanguageItem}
                    />
                  }
                />
              );
            })}
          </List.Section>
        );
      })}
      <List.EmptyView icon={Icon.BlankDocument} title="Type a word to look up or translate" />
    </List>
  );
}

/**
 * Easter egg: if you use PopClip and have added a shortcut for `Easydict`, such as `Cmd + E`, then you can use PopClip to quickly open Easydict!
 * 
 * Reference: https://github.com/pilotmoon/PopClip-Extensions#extension-snippets-examples
 * 
 * Usage: select following text, then PopClip will show "Install Easydict", click it! 

  # popclip
  name: Easydict
  icon: search E
  key combo: command E

 */
