import { Component } from "react";
import { exec, execFile } from "child_process";
import { LANGUAGE_LIST } from "./consts";
import { truncate } from "./shared.func";
import { IListItemActionPanelItem, IPreferences } from "./types";
import {
  Action,
  ActionPanel,
  getApplications,
  getPreferenceValues,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";

const preferences: IPreferences = getPreferenceValues();

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

export class ListActionPanel extends Component<IListItemActionPanelItem> {
  onPlaySound(text?: string, language?: string) {
    if (language && text) {
      const voiceIndex = 0;
      for (const LANG of LANGUAGE_LIST) {
        if (language === LANG.languageId) {
          const escapeText = truncate(text)
            .replace(/'/g, " ")
            .replace(/"/g, " ");
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
      this.props.currentFromLanguage?.languageId;
    const to =
      this.props.currentTargetLanguage?.googleLanguageId ||
      this.props.currentTargetLanguage?.languageId;
    const text = encodeURI(this.props.queryText!);
    return `https://translate.google.cn/?sl=${from}&tl=${to}&text=${text}&op=translate`;
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
            title="Open in Eudic"
            onAction={() => this.openInEudic(this.props.queryText)}
          />
          <Action.CopyToClipboard
            onCopy={() => {
              console.log("copy: ", this.props.copyText);
            }}
            title={`Copy  ${this.props.copyText}`}
            content={this.props.copyText || ""}
          />
        </ActionPanel.Section>

        <ActionPanel.Section title="Open In Browser">
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
                this.props.currentFromLanguage?.languageId
              )
            }
          />
          <Action
            title="Play Result Text Sound"
            icon={playSoundIcon("black")}
            onAction={() =>
              this.onPlaySound(
                this.props.copyText,
                this.props.currentTargetLanguage?.languageId
              )
            }
          />
        </ActionPanel.Section>

        {preferences.isDisplayTargetTranslationLanguage && (
          <ActionPanel.Section title="Target Language">
            {LANGUAGE_LIST.map((region) => {
              if (
                this.props.currentFromLanguage?.languageId === region.languageId
              )
                return null;

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
        )}

        <ActionPanel.Section title="Help">
          <ActionFeedback />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }
}
