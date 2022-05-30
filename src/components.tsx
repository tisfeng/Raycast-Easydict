import { Component } from "react";
import { exec, execFile } from "child_process";
import { LANGUAGE_LIST } from "./consts";
import { truncate } from "./shared.func";
import { ListItemActionPanelItem, IPreferences } from "./types";
import {
  Action,
  ActionPanel,
  getPreferenceValues,
  Icon,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";

const preferences: IPreferences = getPreferenceValues();

export const eudicBundleId = "com.eusoft.freeeudic";

export function playSoundIcon(lightTintColor: string) {
  return {
    source: { light: "speak.png", dark: "speak.png" },
    tintColor: { light: lightTintColor, dark: "lightgray" },
  };
}

export function ActionFeedback() {
  return (
    <Action.OpenInBrowser
      icon={Icon.QuestionMark}
      title="Feedback"
      url="https://github.com/raycast/extensions/issues"
    />
  );
}

export class ListActionPanel extends Component<ListItemActionPanelItem> {
  onPlaySound(text?: string, language?: string) {
    if (language && text) {
      const voiceIndex = 0;
      for (const LANG of LANGUAGE_LIST) {
        if (language === LANG.youdaoLanguageId) {
          const escapeText = truncate(text).replace(/"/g, " ");
          const sayCommand = `say -v ${LANG.languageVoice[voiceIndex]} '${escapeText}'`;
          console.log(sayCommand);
          LANG.languageVoice.length > 0 && exec(sayCommand);
        }
      }
    }
  }

  getGoogleTranslateURL(): string {
    const from =
      this.props.currentFromLanguage?.googleLanguageId ||
      this.props.currentFromLanguage?.youdaoLanguageId;
    const to =
      this.props.currentTargetLanguage?.googleLanguageId ||
      this.props.currentTargetLanguage?.youdaoLanguageId;
    const text = encodeURI(this.props.queryText!);
    return `https://translate.google.cn/?sl=${from}&tl=${to}&text=${text}&op=translate`;
  }

  openInEudic = (queryText?: string) => {
    const url = `eudic://dict/${queryText}`;
    execFile("open", [url], (error, stdout, stderr) => {
      if (error) {
        console.log("error:", error);
        LocalStorage.removeItem(eudicBundleId);

        showToast({
          title: "Eudic is not installed.",
          style: Toast.Style.Failure,
        });
      }
      console.log(stdout);
    });
  };

  render() {
    return (
      <ActionPanel>
        <ActionPanel.Section>
          <Action.CopyToClipboard
            onCopy={() => {
              console.log("copy: ", this.props.copyText);
            }}
            title={`Copy  ${this.props.copyText}`}
            content={this.props.copyText || ""}
          />
          {this.props.isInstalledEudic && (
            <Action
              icon={Icon.MagnifyingGlass}
              title="Open in Eudic"
              onAction={() => this.openInEudic(this.props.queryText)}
            />
          )}
        </ActionPanel.Section>

        <ActionPanel.Section title="Search Query Text Online">
          <Action.OpenInBrowser
            icon={Icon.Link}
            title="See Eudic Translate Results"
            url={`https://dict.eudic.net/dicts/en/${encodeURI(
              this.props.queryText!
            )}`}
          />
          <Action.OpenInBrowser
            icon={Icon.Link}
            title="See Youdao Translate Results"
            url={`https://www.youdao.com/w/eng/${encodeURI(
              this.props.queryText!
            )}`}
          />
          <Action.OpenInBrowser
            icon={Icon.Link}
            title="See Google Translate Results"
            url={this.getGoogleTranslateURL()}
          />
        </ActionPanel.Section>

        <ActionPanel.Section title="Play Sound">
          <Action
            title="Play Query Text Sound"
            icon={playSoundIcon("black")}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
            onAction={() =>
              this.onPlaySound(
                this.props?.queryText,
                this.props.currentFromLanguage?.youdaoLanguageId
              )
            }
          />
          <Action
            title="Play Result Text Sound"
            icon={playSoundIcon("black")}
            onAction={() =>
              this.onPlaySound(
                this.props.copyText,
                this.props.currentTargetLanguage?.youdaoLanguageId
              )
            }
          />
        </ActionPanel.Section>

        {preferences.isDisplayTargetTranslationLanguage && (
          <ActionPanel.Section title="Target Language">
            {LANGUAGE_LIST.map((region) => {
              if (
                this.props.currentFromLanguage?.youdaoLanguageId ===
                region.youdaoLanguageId
              )
                return null;

              return (
                <Action
                  key={region.youdaoLanguageId}
                  title={region.languageTitle}
                  onAction={() => this.props.onLanguageUpdate(region)}
                  icon={
                    this.props.currentTargetLanguage?.youdaoLanguageId ===
                    region.youdaoLanguageId
                      ? Icon.ArrowRight
                      : Icon.Globe
                  }
                />
              );
            })}
          </ActionPanel.Section>
        )}

        <ActionPanel.Section>
          <ActionFeedback />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }
}
