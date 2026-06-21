/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { Image } from "@raycast/api";
import { Action, ActionPanel, Detail, Icon, Keyboard, open, openCommandPreferences } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";

import ReleaseNotesPage from "@/components/pages/ReleaseNotePage";
import { EASYDICT_VERSION, FEEDBACK_URL, getReleaseTagUrl, myPreferences } from "@/consts";
import { playQueryWordAudio, playTTS } from "@/core/audio";
import { languageItemList } from "@/core/language/consts";
import type { LanguageItem } from "@/core/language/types";
import { getShowMoreDetailMarkdown } from "@/core/query/utils";
import { dictionaryServices } from "@/providers/dictionary";
import { translationServices } from "@/providers/translation";
import type { ListDisplayItem } from "@/types/display";
import type { QueryType, QueryWordInfo } from "@/types/query";
import { logError, logTrace } from "@/utils/logger";

import { getQueryTypeIcon, playSoundIconBlack } from "./Icons";

interface ActionListPanelProps {
  displayItem: ListDisplayItem;
  isInstalledEudic: boolean;
  isShowingReleasePrompt: boolean;
  onHideReleasePrompt: () => void;
  onLanguageUpdate: (language: LanguageItem) => void;
}

interface WebQueryItem {
  type: QueryType;
  webUrl: string;
  icon: Image.ImageLike;
  title: string;
}

const shortcuts = {
  showDetail: { macOS: { modifiers: ["cmd"], key: "m" }, Windows: { modifiers: ["ctrl"], key: "m" } },
  playText: { macOS: { modifiers: ["cmd"], key: "s" }, Windows: { modifiers: ["ctrl"], key: "s" } },
  openOnline: Keyboard.Shortcut.Common.Open,
} satisfies Record<string, Keyboard.Shortcut>;

const allServices = [...translationServices, ...dictionaryServices];
const queryWebItemTypes = allServices.filter((s) => s.getWebUrl).map((s) => s.type);

function openInEudic(queryText: string) {
  const url = `eudic://dict/${queryText}`;
  open(url).catch((error) => {
    logError("ActionPanel", `open in eudic error: ${error}`);
    showFailureToast(String(error), { title: "Eudic is not installed." });
  });
}

function getWebQueryItem({
  queryType,
  wordInfo,
}: {
  queryType: QueryType;
  wordInfo: QueryWordInfo;
}): WebQueryItem | undefined {
  const service = allServices.find((s) => s.type === queryType);
  const webUrl = service?.getWebUrl?.(wordInfo);
  if (!webUrl) return undefined;
  return { type: queryType, webUrl, icon: getQueryTypeIcon(queryType), title: `Open in ${queryType}` };
}

function WebQueryAction({
  webQueryItem,
  enableShortcutKey,
}: {
  webQueryItem?: WebQueryItem;
  enableShortcutKey?: boolean;
}) {
  if (!webQueryItem?.webUrl) return null;
  return (
    <Action.OpenInBrowser
      icon={webQueryItem.icon}
      title={webQueryItem.title}
      url={webQueryItem.webUrl}
      shortcut={enableShortcutKey ? shortcuts.openOnline : undefined}
    />
  );
}

function ReleaseNotesAction({ title, onPush }: { title?: string; onPush?: () => void }) {
  return (
    <Action.Push icon={Icon.Stars} title={title || "Recent Updates"} target={<ReleaseNotesPage />} onPush={onPush} />
  );
}

function PrimaryActions({
  displayItem,
  isInstalledEudic,
  isShowingReleasePrompt,
  onHideReleasePrompt,
}: {
  displayItem: ListDisplayItem;
  isInstalledEudic: boolean;
  isShowingReleasePrompt: boolean;
  onHideReleasePrompt: () => void;
}) {
  const { queryWordInfo, queryType, copyText } = displayItem;
  const { word } = queryWordInfo;
  const showEudic = isInstalledEudic && myPreferences.showOpenInEudicFirst;

  const currentWebQueryAction = queryWebItemTypes.includes(queryType) ? (
    <WebQueryAction webQueryItem={getWebQueryItem({ queryType, wordInfo: queryWordInfo })} enableShortcutKey />
  ) : null;

  return (
    <ActionPanel.Section>
      {isShowingReleasePrompt && <ReleaseNotesAction title="✨ New Version Released" onPush={onHideReleasePrompt} />}

      {showEudic && <Action icon={Icon.MagnifyingGlass} title="Open in Eudic App" onAction={() => openInEudic(word)} />}

      <Action.CopyToClipboard
        title="Copy Text"
        content={copyText}
        onCopy={() => logTrace("ActionPanel", `copy: ${copyText}`)}
      />

      {!showEudic && isInstalledEudic && (
        <Action icon={Icon.MagnifyingGlass} title="Open in Eudic App" onAction={() => openInEudic(word)} />
      )}

      <Action.Push
        title="Show More Details"
        icon={Icon.Eye}
        shortcut={shortcuts.showDetail}
        target={
          <Detail
            markdown={getShowMoreDetailMarkdown(displayItem)}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy Text"
                  content={copyText}
                  onCopy={() => logTrace("ActionPanel", `copy: ${copyText}`)}
                />
                {currentWebQueryAction}
              </ActionPanel>
            }
          />
        }
      />
      {currentWebQueryAction}
    </ActionPanel.Section>
  );
}

function OtherWebQuerySection({ queryType, queryWordInfo }: { queryType: QueryType; queryWordInfo: QueryWordInfo }) {
  return (
    <ActionPanel.Section title="Search Query Text Online">
      {queryWebItemTypes
        .filter((t) => t !== queryType)
        .map((t) => (
          <WebQueryAction webQueryItem={getWebQueryItem({ queryType: t, wordInfo: queryWordInfo })} key={t} />
        ))}
    </ActionPanel.Section>
  );
}

function AudioActions({
  queryWordInfo,
  copyText,
  toLanguage,
}: {
  queryWordInfo: QueryWordInfo;
  copyText: string;
  toLanguage: string;
}) {
  return (
    <ActionPanel.Section title="Play Text Audio">
      <Action
        title="Play Query Text"
        icon={playSoundIconBlack}
        shortcut={shortcuts.playText}
        onAction={() => {
          logTrace("ActionPanel", `start play sound: ${queryWordInfo.word}`);
          playQueryWordAudio(queryWordInfo);
        }}
      />
      <Action
        title="Play Result Text"
        icon={playSoundIconBlack}
        onAction={() => playTTS(copyText, toLanguage, { truncate: true })}
      />
    </ActionPanel.Section>
  );
}

function TargetLanguageSection({
  fromLanguage,
  toLanguage,
  onLanguageUpdate,
}: {
  fromLanguage: string;
  toLanguage: string;
  onLanguageUpdate: (language: LanguageItem) => void;
}) {
  if (!myPreferences.enableSelectTargetLanguage) return null;
  return (
    <ActionPanel.Section title="Target Language">
      {languageItemList
        .filter((lang) => lang.youdaoLangCode !== "auto" && lang.youdaoLangCode !== fromLanguage)
        .map((lang) => (
          <Action
            key={lang.youdaoLangCode}
            title={lang.langEnglishName}
            onAction={() => onLanguageUpdate(lang)}
            icon={lang.youdaoLangCode === toLanguage ? Icon.ArrowRight : { source: lang.emoji }}
          />
        ))}
    </ActionPanel.Section>
  );
}

function SettingsActions({ isShowingReleasePrompt }: { isShowingReleasePrompt: boolean }) {
  return (
    <ActionPanel.Section>
      {!isShowingReleasePrompt && <ReleaseNotesAction />}
      <Action.OpenInBrowser
        icon={Icon.Document}
        title={`Version: ${EASYDICT_VERSION}`}
        url={getReleaseTagUrl(EASYDICT_VERSION)}
      />
      <Action icon={Icon.Gear} title="Preferences" onAction={openCommandPreferences} />
      <Action.OpenInBrowser icon={Icon.QuestionMark} title="Feedback" url={FEEDBACK_URL} />
    </ActionPanel.Section>
  );
}

export function ListActionPanel(props: ActionListPanelProps) {
  const { displayItem, isShowingReleasePrompt, onHideReleasePrompt, isInstalledEudic, onLanguageUpdate } = props;
  const { queryWordInfo, queryType, copyText } = displayItem;
  const { fromLanguage, toLanguage } = queryWordInfo;

  return (
    <ActionPanel>
      <PrimaryActions
        displayItem={displayItem}
        isInstalledEudic={isInstalledEudic}
        isShowingReleasePrompt={isShowingReleasePrompt}
        onHideReleasePrompt={onHideReleasePrompt}
      />
      <OtherWebQuerySection queryType={queryType} queryWordInfo={queryWordInfo} />
      <AudioActions queryWordInfo={queryWordInfo} copyText={copyText} toLanguage={toLanguage} />
      <TargetLanguageSection fromLanguage={fromLanguage} toLanguage={toLanguage} onLanguageUpdate={onLanguageUpdate} />
      <SettingsActions isShowingReleasePrompt={isShowingReleasePrompt} />
    </ActionPanel>
  );
}
