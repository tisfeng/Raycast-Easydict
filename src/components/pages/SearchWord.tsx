/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getSelectedText, Icon, List } from "@raycast/api";
import { useEffect, useRef, useState } from "react";

import { ListActionPanel } from "@/components/ui/ActionPanel";
import { getListItemIcon } from "@/components/ui/Icons";
import { getWordAccessories } from "@/components/ui/WordAccessories";
import { myPreferences } from "@/consts";
import { config } from "@/core/config";
import type { LanguageItem } from "@/core/language/types";
import { useAutoPlayAudio, useDebouncedQuery, useInstalledEudic, useQueryEngine, useReleasePrompt } from "@/hooks";
import type { QueryWordInfo } from "@/types/query";
import { md5 } from "@/utils/crypto";
import { logError, logTrace } from "@/utils/logger";

interface SearchWordProps {
  initialQueryText?: string;
  fallbackText?: string;
}

export default function SearchWord({ initialQueryText, fallbackText }: SearchWordProps) {
  const trimQueryText = initialQueryText ? initialQueryText.trim() : fallbackText?.trim();

  const [isInputChanged, setInputChangedState] = useState<boolean>(false);

  const { isShowingReleasePrompt, hideReleasePrompt } = useReleasePrompt();
  const { isInstalledEudic } = useInstalledEudic();

  const {
    displaySections,
    isLoading,
    isShowDetail,
    currentFromLanguageItem,
    autoSelectedTargetLanguageItem,
    queryText,
    queryTextWithTextInfo,
    clearQueryResult,
    setAutoSelectedTargetLanguageItem,
    queryResults,
    hasPlayedAudioRef,
    isCurrentQueryRef,
    abortControllerRef,
  } = useQueryEngine(config.preferredLanguage1, config.preferredLanguage1);

  const debouncedQuery = useDebouncedQuery(queryText);

  useAutoPlayAudio(queryResults, hasPlayedAudioRef, isCurrentQueryRef, abortControllerRef);

  /**
   * Use to display input text.
   */
  const [inputText, setInputText] = useState<string>(trimQueryText || "");
  /**
   * searchText = inputText.trim(), avoid frequent request API with blank input.
   */
  const [searchText, setSearchText] = useState<string>("");

  /**
   * the user selected translation language, used for display, can be changed manually. default userSelectedTargetLanguage is the autoSelectedTargetLanguage.
   */
  const [userSelectedTargetLanguageItem, setUserSelectedTargetLanguageItem] =
    useState<LanguageItem>(autoSelectedTargetLanguageItem);

  const setupCalled = useRef(false);
  useEffect(() => {
    if (!setupCalled.current) {
      setupCalled.current = true;
      setup();
    }
  }, []);

  /**
   * Do something setup when the extension is activated. Only run once.
   */
  function setup() {
    if (trimQueryText?.length) {
      logTrace("SearchWord", `arguments queryText: ${trimQueryText}`);
    }

    const userInputText = trimQueryText;

    if (userInputText?.length) {
      updateInputTextAndQueryText(userInputText, false);
    } else if (myPreferences.enableAutomaticQuerySelectedText) {
      querySelecedtText().then(() => {
        logTrace("SearchWord", "after query selected text");
      });
    }
  }

  /**
   * Try to detect the selected text, if detect success, then query the selected text.
   */
  function querySelecedtText(): Promise<void> {
    return new Promise((resolve) => {
      getSelectedText()
        .then((selectedText) => {
          selectedText = selectedText.trim();
          logTrace("SearchWord", `selected text: ${selectedText}`);
          updateInputTextAndQueryText(selectedText, false);
          resolve();
        })
        .catch((error) => {
          logError("SearchWord", `getSelectedText error: ${error}`);
          resolve();
        });
    });
  }

  /**
   * User select target language manually.
   *
   */
  const updateSelectedTargetLanguageItem = (selectedLanguageItem: LanguageItem) => {
    logTrace("SearchWord", `selected language: ${selectedLanguageItem.youdaoLangCode}`);
    logTrace("SearchWord", `current target language: ${userSelectedTargetLanguageItem.youdaoLangCode}`);

    if (selectedLanguageItem.youdaoLangCode === userSelectedTargetLanguageItem.youdaoLangCode) {
      return;
    }

    logTrace("SearchWord", `updateSelectedTargetLanguageItem: ${selectedLanguageItem.youdaoLangCode}`);
    setAutoSelectedTargetLanguageItem(selectedLanguageItem);
    setUserSelectedTargetLanguageItem(selectedLanguageItem);

    const queryWordInfo: QueryWordInfo = {
      word: searchText,
      fromLanguage: currentFromLanguageItem.youdaoLangCode,
      toLanguage: selectedLanguageItem.youdaoLangCode,
    };

    // Clean up previous query results immediately before new query.
    clearQueryResult();
    queryTextWithTextInfo(queryWordInfo);
  };

  /**
   * Update input text and search text, then query text according to @isDelay
   */
  function updateInputTextAndQueryText(text: string, isDelay: boolean) {
    // Normalize newlines to spaces to match Raycast's internal SearchBar behavior.
    // This prevents the SearchBar from firing an onSearchTextChange event with the collapsed
    // text later, which would cause a duplicate query and abort this initial one.
    const normalizedText = text.replace(/\r?\n/g, " ");

    logTrace("SearchWord", `update input text, length: ${normalizedText.length}`);

    setInputText(normalizedText);
    const trimText = normalizedText.trim();
    setSearchText(trimText);

    // If trimText is empty, then do not query.
    if (trimText.length === 0) {
      logTrace("SearchWord", "trimText is empty, do not query");
      debouncedQuery.cancel();
      clearQueryResult();
      return;
    }

    // Only different input text, then clear old results before new input text query.
    if (trimText !== searchText) {
      debouncedQuery.cancel();
      clearQueryResult();
      const toLanguage = userSelectedTargetLanguageItem.youdaoLangCode;
      if (isDelay) {
        debouncedQuery(trimText, toLanguage);
      } else {
        queryText(trimText, toLanguage);
      }
    }
  }

  function onInputChange(text: string) {
    // Ignore the first inputChange event to avoid lost queryText argument, fix https://github.com/tisfeng/Raycast-Easydict/issues/62
    if (!isInputChanged) {
      setInputChangedState(true);
      if (text === "") {
        logTrace("SearchWord", "ignore first inputChange event");
        return;
      }
    }
    updateInputTextAndQueryText(text, true);
  }

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={isShowDetail}
      searchBarPlaceholder={"Search word or translate text..."}
      searchText={inputText}
      onSearchTextChange={onInputChange}
      actions={null}
    >
      {displaySections.map((resultItem, idx) => {
        const currentWord = resultItem.items?.[0]?.queryWordInfo?.word || "";
        const wordHash = md5(currentWord);

        const provider = resultItem.items?.[0]?.queryType || "Unknown";
        // idx ensures that when items are reordered, they get new keys,
        // which forces Raycast to reset the cursor to the top result (index 0).
        // wordHash ensures that keys are never reused across different queries, fixing the blank space bug.
        const sectionKey = `${idx}-${provider}-${resultItem.type}-${wordHash}`;
        return (
          <List.Section key={sectionKey} title={resultItem.sectionTitle}>
            {resultItem.items?.map((item) => {
              const itemKey = `${idx}-${item.key}-${wordHash}`;
              return (
                <List.Item
                  key={itemKey}
                  icon={{
                    value: getListItemIcon(item),
                    tooltip: item.tooltip || "",
                  }}
                  title={item.title}
                  subtitle={item.subtitle}
                  accessories={getWordAccessories(item)}
                  detail={<List.Item.Detail markdown={item.detailsMarkdown} />}
                  actions={
                    <ListActionPanel
                      displayItem={item}
                      isShowingReleasePrompt={isShowingReleasePrompt}
                      onHideReleasePrompt={hideReleasePrompt}
                      isInstalledEudic={isInstalledEudic}
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
