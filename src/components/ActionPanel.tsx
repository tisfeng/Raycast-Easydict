/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Action, ActionPanel, Detail, Icon, Keyboard, openCommandPreferences } from "@raycast/api";
import { sayTruncateCommand } from "@/audio";
import { getShowMoreDetailMarkdown } from "@/query/utils";
import { getLingueeWebDictionaryURL } from "@/dictionary/linguee/parse";
import { QueryWordInfo } from "@/dictionary/youdao/types";
import { getYoudaoWebDictionaryURL } from "@/dictionary/youdao/utils";
import { playYoudaoWordAudioAfterDownloading } from "@/dictionary/youdao/youdao";
import { languageItemList } from "@/language/consts";
import {
  getBaiduWebTranslateURL,
  getDeepLWebTranslateURL,
  getEudicWebDictionaryURL,
  getGoogleWebTranslateURL,
} from "@/language/languages";
import { myPreferences } from "@/preferences";
import ReleaseNotesPage from "@/releaseVersion/releaseNotePage";
import { FEEDBACK_URL, EASYDICT_VERSION, getReleaseTagUrl } from "@/consts";
import { openInEudic } from "@/scripts";
import { ActionListPanelProps, DictionaryType, QueryType, TranslationType, WebQueryItem } from "@/types";
import { logTrace } from "@/devLog";
import { playSoundIconBlack, getQueryTypeIcon } from "./icons";

const shortcuts = {
  showDetail: { modifiers: ["cmd"] as Keyboard.KeyModifier[], key: "m" as Keyboard.KeyEquivalent },
  playText: { modifiers: ["cmd"] as Keyboard.KeyModifier[], key: "s" as Keyboard.KeyEquivalent },
  openOnline: Keyboard.Shortcut.Common.Open,
};

const queryWebItemTypes = [
  DictionaryType.Youdao,
  DictionaryType.Linguee,
  DictionaryType.Eudic,
  TranslationType.DeepL,
  TranslationType.DeepLX,
  TranslationType.Google,
  TranslationType.Baidu,
  TranslationType.Volcano,
];

/**
 * Current type web query item.
 */
function CurrentTypeWebQueryAction(props: { queryType: QueryType; queryWordInfo: QueryWordInfo }) {
  const { queryType, queryWordInfo } = props;

  if (!queryWebItemTypes.includes(queryType)) {
    return null;
  }

  const currentWebItem = getWebQueryItem(queryType, queryWordInfo);
  return <WebQueryAction webQueryItem={currentWebItem} enableShortcutKey={true} />;
}

/**
 * Except current type web query item.
 */
function ExceptCurrentTypeWebQueryActionPanel(props: { queryType: QueryType; queryWordInfo: QueryWordInfo }) {
  const { queryType, queryWordInfo } = props;

  const exceptWebItemTypes = queryWebItemTypes.filter((item) => item !== queryType);
  return (
    <ActionPanel.Section title="Search Query Text Online">
      {exceptWebItemTypes.map((queryType) => {
        const webQueryItem = getWebQueryItem(queryType, queryWordInfo);
        return <WebQueryAction webQueryItem={webQueryItem} enableShortcutKey={false} key={queryType} />;
      })}
    </ActionPanel.Section>
  );
}

/**
 * Get the list action panel item with ListItemActionPanelItem
 */
export function ListActionPanel(props: ActionListPanelProps) {
  const { isShowingReleasePrompt, onHideReleasePrompt } = props;

  const displayItem = props.displayItem;
  const { queryWordInfo, queryType, copyText } = displayItem;
  const { word, fromLanguage, toLanguage } = queryWordInfo;

  const showMoreDetailMarkdown = getShowMoreDetailMarkdown(displayItem);

  return (
    <ActionPanel>
      <ActionPanel.Section>
        {isShowingReleasePrompt && <ReleaseNotesAction title="✨ New Version Released" onPush={onHideReleasePrompt} />}
        {props.isInstalledEudic && myPreferences.showOpenInEudicFirst && (
          <Action icon={Icon.MagnifyingGlass} title="Open in Eudic App" onAction={() => openInEudic(word)} />
        )}
        {CopyTextAction({ copyText })}
        {props.isInstalledEudic && !myPreferences.showOpenInEudicFirst && (
          <Action icon={Icon.MagnifyingGlass} title="Open in Eudic App" onAction={() => openInEudic(word)} />
        )}
        <Action.Push
          title="Show More Details"
          icon={Icon.Eye}
          shortcut={shortcuts.showDetail}
          target={
            <Detail
              markdown={showMoreDetailMarkdown}
              actions={
                <ActionPanel>
                  {CopyTextAction({ copyText })}
                  <CurrentTypeWebQueryAction queryType={queryType} queryWordInfo={queryWordInfo} />
                </ActionPanel>
              }
            />
          }
        />
        <CurrentTypeWebQueryAction queryType={queryType} queryWordInfo={queryWordInfo} />
      </ActionPanel.Section>

      <ExceptCurrentTypeWebQueryActionPanel queryType={queryType} queryWordInfo={queryWordInfo} />

      <ActionPanel.Section title="Play Text Audio">
        <Action
          title="Play Query Text"
          icon={playSoundIconBlack}
          shortcut={shortcuts.playText}
          onAction={() => {
            logTrace("components", `start play sound: ${word}`);
            playYoudaoWordAudioAfterDownloading(queryWordInfo);
          }}
        />
        <Action
          title="Play Result Text"
          icon={playSoundIconBlack}
          onAction={() => {
            /**
             *  Directly use say command to play the result text.
             *  Because it is difficult to determine whether the result is a word, impossible to use Youdao web audio directly.
             *  In addition, TTS needs to send additional youdao query requests.
             *
             *  Todo: add a shortcut to stop playing audio.
             */
            sayTruncateCommand(copyText, toLanguage);
          }}
        />
      </ActionPanel.Section>

      {myPreferences.enableSelectTargetLanguage && (
        <ActionPanel.Section title="Target Language">
          {languageItemList.map((selectedLanguageItem) => {
            // hide auto language
            const isAutoLanguage = selectedLanguageItem.youdaoLangCode === "auto";
            // hide current detected language
            const isSameWithDetectedLanguage = selectedLanguageItem.youdaoLangCode === fromLanguage;
            const isSameWithTargetLanguage = selectedLanguageItem.youdaoLangCode === toLanguage;
            if (isAutoLanguage || isSameWithDetectedLanguage) {
              return null;
            }

            return (
              <Action
                key={selectedLanguageItem.youdaoLangCode}
                title={selectedLanguageItem.langEnglishName}
                onAction={() => props.onLanguageUpdate(selectedLanguageItem)}
                icon={isSameWithTargetLanguage ? Icon.ArrowRight : { source: selectedLanguageItem.emoji }}
              />
            );
          })}
        </ActionPanel.Section>
      )}

      <ActionPanel.Section>
        {!isShowingReleasePrompt && <ReleaseNotesAction />}
        <CurrentVersionAction />
        <ActionOpenCommandPreferences />
        <ActionFeedback />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

/**
 * Copy text action
 */
function CopyTextAction(props: { copyText: string }) {
  const { copyText } = props;
  return (
    <Action.CopyToClipboard
      onCopy={() => {
        logTrace("components", `copy: ${copyText}`);
      }}
      title={`Copy Text`}
      content={copyText}
    />
  );
}

export function ActionFeedback() {
  return <Action.OpenInBrowser icon={Icon.QuestionMark} title="Feedback" url={FEEDBACK_URL} />;
}

function ActionOpenCommandPreferences() {
  return <Action icon={Icon.Gear} title="Preferences" onAction={openCommandPreferences} />;
}

function ReleaseNotesAction(props: { title?: string; onPush?: () => void }) {
  return (
    <Action.Push
      icon={Icon.Stars}
      title={props.title || "Recent Updates"}
      target={<ReleaseNotesPage />}
      onPush={props.onPush}
    />
  );
}

function CurrentVersionAction() {
  return (
    <Action.OpenInBrowser
      icon={Icon.Document}
      title={`Version: ${EASYDICT_VERSION}`}
      url={getReleaseTagUrl(EASYDICT_VERSION)}
    />
  );
}

/**
 * Get WebQueryItem according to the query type and info
 */
function getWebQueryItem(queryType: QueryType, wordInfo: QueryWordInfo): WebQueryItem | undefined {
  const title = `Open in ${queryType}`;
  const icon = getQueryTypeIcon(queryType);

  let webUrl;
  switch (queryType) {
    case TranslationType.Google: {
      webUrl = getGoogleWebTranslateURL(wordInfo);
      break;
    }
    case TranslationType.DeepL: {
      webUrl = getDeepLWebTranslateURL(wordInfo);
      break;
    }
    case TranslationType.DeepLX: {
      // DeepLX uses the same web interface as DeepL
      webUrl = getDeepLWebTranslateURL(wordInfo);
      break;
    }
    case TranslationType.Baidu: {
      webUrl = getBaiduWebTranslateURL(wordInfo);
      break;
    }
    case DictionaryType.Linguee: {
      webUrl = getLingueeWebDictionaryURL(wordInfo);
      break;
    }
    case DictionaryType.Youdao: {
      webUrl = getYoudaoWebDictionaryURL(wordInfo);
      break;
    }
    case DictionaryType.Eudic: {
      webUrl = getEudicWebDictionaryURL(wordInfo);
      break;
    }
  }
  return webUrl ? { type: queryType, webUrl, icon, title } : undefined;
}

function WebQueryAction(props: { webQueryItem?: WebQueryItem; enableShortcutKey?: boolean }) {
  if (props.enableShortcutKey) {
    return props.webQueryItem?.webUrl ? (
      <Action.OpenInBrowser
        icon={props.webQueryItem.icon}
        title={props.webQueryItem.title}
        url={props.webQueryItem.webUrl}
        shortcut={shortcuts.openOnline}
      />
    ) : null;
  } else {
    return props.webQueryItem?.webUrl ? (
      <Action.OpenInBrowser
        icon={props.webQueryItem.icon}
        title={props.webQueryItem.title}
        url={props.webQueryItem.webUrl}
      />
    ) : null;
  }
}
