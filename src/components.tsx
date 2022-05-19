import { Component } from "react";
import { exec, execFile } from "child_process";
import { COPY_TYPE, LANGUAGE_LIST } from "./consts";
import { reformatCopyTextArray, truncate } from "./shared.func";
import {
  IActionCopyListSection,
  IListItemActionPanelItem,
  IPreferences,
} from "./types";
import {
  Action,
  ActionPanel,
  Clipboard,
  getApplications,
  getPreferenceValues,
  Icon,
  Keyboard,
  showToast,
  Toast,
} from "@raycast/api";

const preferences: IPreferences = getPreferenceValues();

export function ActionFeedback() {
  return (
    <Action.OpenInBrowser
      icon={Icon.QuestionMark}
      title="Feedback"
      url="https://github.com/Haojen/raycast-Parrot"
    />
  );
}

export function ActionCopyListSection(props: IActionCopyListSection) {
  if (!props.copyText) {
    return null;
  }

  const SEPARATOR = "；";
  const copyTextArray = props.copyText.split(SEPARATOR);
  copyTextArray.length > 1 && copyTextArray.push(props.copyText);
  // const finalTextArray = reformatCopyTextArray(copyTextArray, 4)
  const finalTextArray = [props.copyText];

  console.log("props.copyText", JSON.stringify(props.copyText));

  const shortcutKeyEquivalent: Keyboard.KeyEquivalent[] = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
  ];

  function changeTextCopyStyle(text: string): string {
    return text;
  }

  console.log("copytext", JSON.stringify(props.copyText));
  console.log("finalTextArray", JSON.stringify(finalTextArray));

  return (
    <ActionPanel.Section>
      {finalTextArray.map((textItem, key) => {
        console.log("key", key);
        console.log("textItem", JSON.stringify(textItem));
        return (
          <Action.CopyToClipboard
            onCopy={() =>
              preferences.isAutomaticPaste &&
              Clipboard.paste(props.copyText || "")
            }
            shortcut={{ modifiers: ["cmd"], key: "enter" }}
            title={`Copy ${props.copyText}`}
            content={props.copyText || ""}
            key={key}
          />
        );
      })}
    </ActionPanel.Section>
  );
}

export class ListActionPanel extends Component<IListItemActionPanelItem> {
  onPlaySound(text?: string, language?: string) {
    if (language && text) {
      const voiceIndex = 0;
      for (const LANG of LANGUAGE_LIST) {
        if (language === LANG.languageId) {
          const sayCommand = `say -v ${
            LANG.languageVoice[voiceIndex]
          } ${truncate(text)}`;
          LANG.languageVoice.length > 0 && exec(sayCommand);
        }
      }
    }
  }

  getGoogleTranslateURL(): string {
    const from =
      this.props.currentFromLanguage?.googleLanguageId ||
      this.props.currentFromLanguage?.languageId;
    const to =
      this.props.currentTargetLanguage?.googleLanguageId ||
      this.props.currentTargetLanguage?.languageId;
    const text = encodeURI(this.props.queryText!);
    return `https://translate.google.com/?sl=${from}&tl=${to}&text=${text}&op=translate`;
  }

  openInEudic = (queryText?: string) => {
    getApplications().then((applications) => {
      const isInstalledEudic = applications.find(
        (app) => ((app.bundleId as string) || "").indexOf("eudic") != -1
      );
      if (isInstalledEudic) {
        // open in eudic and query
        const url = `eudic://dict/${queryText}`;
        execFile(`open`, [url]);
      } else {
        showToast({
          title: "Eudic is not installed.",
          style: Toast.Style.Failure,
        });
      }
    });
  };

  render() {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <Action
            icon={Icon.MagnifyingGlass}
            title="Look up Query Text in Eudic"
            onAction={() => this.openInEudic(this.props.queryText)}
          />
          <Action.CopyToClipboard
            onCopy={() =>
              preferences.isAutomaticPaste &&
              Clipboard.paste(this.props.copyText || "")
            }
            // shortcut={{ modifiers: ["cmd"], key: "enter" }}
            title={`Copy  ${this.props.copyText}`}
            content={this.props.copyText || ""}
          />
        </ActionPanel.Section>

        {/* <ActionCopyListSection
          copyText={this.props.copyText}
          copyMode={this.props.copyMode}
        /> */}

        <ActionPanel.Section title="Play Sound">
          <Action
            title="Play Query Text Sound"
            icon={Icon.Message}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
            onAction={() =>
              this.onPlaySound(
                this.props?.queryText,
                this.props.currentFromLanguage?.languageId
              )
            }
          />
          <Action
            title="Play Result Text Sound"
            icon={Icon.Message}
            onAction={() =>
              this.onPlaySound(
                this.props.copyText,
                this.props.currentTargetLanguage?.languageId
              )
            }
          />
        </ActionPanel.Section>

        <ActionPanel.Section title="Open in">
          <Action
            title="Search Query Text in Eudic"
            icon={Icon.MagnifyingGlass}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={() => this.openInEudic(this.props.queryText)}
          />
        </ActionPanel.Section>

        <ActionPanel.Section title="Target Language">
          {LANGUAGE_LIST.map((region) => {
            const isCurrentFromLanguage =
              this.props.currentFromLanguage?.languageId === region.languageId;
            if (isCurrentFromLanguage) return null;

            return (
              <Action
                key={region.languageId}
                title={region.languageTitle}
                onAction={() => this.props.onLanguageUpdate(region)}
                icon={
                  this.props.currentTargetLanguage?.languageId ===
                  region.languageId
                    ? Icon.ArrowRight
                    : Icon.Globe
                }
              />
            );
          })}
        </ActionPanel.Section>
        <ActionPanel.Section title="Others">
          <ActionFeedback />
          <Action.OpenInBrowser
            icon={Icon.Link}
            title="See Google Translate Results"
            url={this.getGoogleTranslateURL()}
          />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }
}
