/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Action, ActionPanel, Detail, Icon, Keyboard, open, openCommandPreferences } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";

import ReleaseNotesPage from "@/components/pages/ReleaseNotePage";
import { EASYDICT_VERSION, FEEDBACK_URL, getReleaseTagUrl } from "@/constants";
import { playQueryWordAudio, sayTruncateCommand } from "@/core/audio";
import { languageItemList } from "@/core/language/consts";
import { getShowMoreDetailMarkdown } from "@/core/query/utils";
import { myPreferences } from "@/preferences";
import { dictionaryServices } from "@/providers/dictionary";
import { translationServices } from "@/providers/translation";
import { DictionaryType, TranslationType } from "@/types/api";
import type { QueryType, QueryWordInfo } from "@/types/query";
import type { ActionListPanelProps, WebQueryItem } from "@/types/ui";
import { logError, logTrace } from "@/utils/logger";

import { getQueryTypeIcon, playSoundIconBlack } from "./Icons";

const openInEudic = (queryText: string) => {
  const url = `eudic://dict/${queryText}`;
  open(url).catch((error) => {
    logError("scripts", `open in eudic error: ${error}`);
    showFailureToast(String(error), {
      title: "Eudic is not installed.",
    });
  });
};

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
            playQueryWordAudio(queryWordInfo);
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

function ActionFeedback() {
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
  const service = [...translationServices, ...dictionaryServices].find((s) => s.type === queryType);
  const webUrl = service?.getWebUrl?.(wordInfo);

  const title = `Open in ${queryType}`;
  const icon = getQueryTypeIcon(queryType);

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
