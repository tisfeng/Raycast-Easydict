/*
 * @author: tisfeng
 * @createTime: 2022-06-23 14:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-15 09:40
 * @fileName: easydict.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Color, getSelectedText, Icon, List } from "@raycast/api";
import { Fragment, useEffect, useState } from "react";
import { configAxiosProxy } from "./axiosConfig";
import { getListItemIcon, getWordAccessories, ListActionPanel } from "./components";
import { DataManager } from "./dataManager";
import { QueryWordInfo } from "./dict/youdao/types";
import { LanguageItem } from "./language/type";
import { myPreferences, preferrdLanguage1, preferrdLanguage2 } from "./preferences";
import { DisplaySection } from "./types";
import { checkIfInstalledEudic, trimTextLength } from "./utils";

let delayQueryTextTimer: NodeJS.Timeout;
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
    if (searchText) {
      // Todo: need to optimize this. move timer to dataManager.
      const toLanguage = userSelectedTargetLanguageItem.youdaoLanguageId;
      dataManager.queryText(searchText, toLanguage);
      return;
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
    console.log("try query selected text");
    const startTime = Date.now();
    getSelectedText()
      .then((selectedText) => {
        selectedText = trimTextLength(selectedText);
        console.log(`getSelectedText: ${selectedText}, cost time: ${Date.now() - startTime} ms`);
        updateInputTextAndQueryTextNow(selectedText, true);
      })
      .catch(() => {
        // do nothing
      });
  }

  function ListDetail() {
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

      // * Clean up previous query results before new query.
      dataManager.clearQueryResult();
      dataManager.queryTextWithTextInfo(quertWordInfo);
    };

    return (
      <Fragment>
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
      </Fragment>
    );
  }

  /**
   * Update input text and search text, then query text according to @isNow
   *
   * @isNow if true, query text right now, false will delay query.
   */
  function updateInputTextAndQueryTextNow(text: string, isNow: boolean) {
    console.log(`update input text: ${text}, length: ${text.length}, isNow: ${isNow}`);

    setInputText(text);
    console.warn(`---> delayQueryTextTimer: ${delayQueryTextTimer}`);
    clearTimeout(delayQueryTextTimer);

    const trimText = trimTextLength(text);
    if (trimText.length === 0) {
      // If input text is empty, need to update search text to empty.
      setSearchText("");
      dataManager.clearQueryResult();
      return;
    }

    // Todo: need to check
    if (text !== searchText) {
      // clear old results before new input text query.
      if (trimText !== searchText) {
        dataManager.clearQueryResult();
      }
      if (isNow) {
        setSearchText(trimText);
      } else {
        // start delay timer for fetch translate API
        delayQueryTextTimer = setTimeout(() => {
          console.warn(`---> start delayQueryTextTimer`);
          setSearchText(trimText);
        }, dataManager.delayRequestTime);
        console.warn(`---> assign delayQueryTextTimer: ${delayQueryTextTimer}`);
      }
    }
  }

  function onInputChange(text: string) {
    updateInputTextAndQueryTextNow(text, false);
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
      <List.EmptyView icon={Icon.BlankDocument} title="Type a word to look up or translate" />
      <ListDetail />
    </List>
  );
}

/**
 * Easter egg: if you use PopClip and have added a shortcut for `Easydict`, such as `Cmd + E`, then you can use PopClip to open Easydict!
 * 
 * Reference: https://github.com/pilotmoon/PopClip-Extensions#extension-snippets-examples
 * 
 * Usage: select following text, then PopClip will show "Install Easydict", click it! 

  # popclip
  name: Easydict
  icon: search E
  key combo: command E

 */
