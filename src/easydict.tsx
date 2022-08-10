/*
 * @author: tisfeng
 * @createTime: 2022-06-23 14:19
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-11 00:57
 * @fileName: easydict.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { Color, getSelectedText, Icon, List } from "@raycast/api";
import { Fragment, useEffect, useState } from "react";
import { configAxiosProxy } from "./axiosConfig";
import { getListItemIcon, getWordAccessories, ListActionPanel } from "./components";
import { DataManager } from "./dataManager";
import { detectLanguage, LanguageDetectTypeResult } from "./detectLanguage";
import { QueryWordInfo } from "./dict/youdao/types";
import { getAutoSelectedTargetLanguageId, getLanguageItemFromYoudaoId, LanguageItem } from "./language/languages";
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

  function updateDisplaySections(displayItems: DisplaySection[]) {
    console.log(`updateDisplaySections`);
    setIsShowingDetail(dataManager.isShowDetail);
    setDisplayResult(displayItems);
  }

  dataManager.updateListDisplaySections = updateDisplaySections;
  dataManager.updateLoadingState = setLoadingState;

  /**
   * the language type of text, depending on the language type of the current input text.
   */
  const [currentFromLanguageItem, setCurrentFromLanguageItem] = useState<LanguageItem>(preferrdLanguage1);
  /**
   * default translation language, based on user's preference language, can only defaultLanguage1 or defaultLanguage2 depending on the currentFromLanguageState. cannot be changed manually.
   */
  const [autoSelectedTargetLanguageItem, setAutoSelectedTargetLanguageItem] = useState<LanguageItem>(preferrdLanguage1);
  /**
   * the user selected translation language, for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
   */
  const [userSelectedTargetLanguageItem, setUserSelectedTargetLanguageItem] =
    useState<LanguageItem>(autoSelectedTargetLanguageItem);

  useEffect(() => {
    console.log("enter useEffect");
    if (inputText === undefined) {
      setup();
    }
    if (searchText) {
      queryText(searchText);
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

  /**
   * Query text, automatically detect the language of input text
   */
  function queryText(text: string) {
    console.log("start queryText: " + text);
    setLoadingState(true);

    detectLanguage(text, (detectedLanguageResult) => {
      console.log(
        `---> final confirmed: ${detectedLanguageResult.confirmed}, type: ${detectedLanguageResult.type}, detectLanguage: ${detectedLanguageResult.youdaoLanguageId}`
      );
      queryTextFromDetectedLanguage(detectedLanguageResult);
    });
  }

  /**
   * Query text with from detected language
   */
  function queryTextFromDetectedLanguage(detectedLanguageResult: LanguageDetectTypeResult) {
    const fromYoudaoLanguageId = detectedLanguageResult.youdaoLanguageId;
    console.log("queryTextWithFromLanguageId:", fromYoudaoLanguageId);
    setCurrentFromLanguageItem(getLanguageItemFromYoudaoId(fromYoudaoLanguageId));

    // priority to use user selected target language, if conflict, use auto selected target language
    let targetLanguageId = userSelectedTargetLanguageItem.youdaoLanguageId;
    console.log("userSelectedTargetLanguage:", targetLanguageId);
    if (fromYoudaoLanguageId === targetLanguageId) {
      targetLanguageId = getAutoSelectedTargetLanguageId(fromYoudaoLanguageId);
      setAutoSelectedTargetLanguageItem(getLanguageItemFromYoudaoId(targetLanguageId));
      console.log("autoSelectedTargetLanguage: ", targetLanguageId);
    }
    const queryTextInfo: QueryWordInfo = {
      word: searchText,
      fromLanguage: fromYoudaoLanguageId,
      toLanguage: targetLanguageId,
      // detectedLanguage: detectedLanguageResult, // maybe use it later.
    };
    dataManager.queryTextWithTextInfo(queryTextInfo);
  }

  function ListDetail() {
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
    // console.log("---> update:", text);
    setInputText(text);

    const trimText = trimTextLength(text);
    if (trimText.length === 0) {
      // If input text is empty, need to update search text to empty.
      setSearchText("");
      dataManager.clearQueryResult();
      return;
    }

    clearTimeout(delayQueryTextTimer);
    console.log(`update input text: ${text}, length: ${text.length}, isNow: ${isNow}`);

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
          setSearchText(trimText);
        }, dataManager.delayRequestTime);
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
