/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-02 17:33
 * @fileName: components.tsx
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { languageItemList, SectionType, TranslateType } from "./consts";
import { ActionListPanelProps, YoudaoTranslateReformatResultItem } from "./types";
import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import {
  checkIsInstalledEudic,
  getEudicWebTranslateURL,
  getGoogleWebTranslateURL,
  getYoudaoWebTranslateURL,
  myPreferences,
} from "./utils";
import { sayTruncateCommand } from "./audio";
import { openInEudic } from "./scripts";
import { playYoudaoWordAudioAfterDownloading } from "./dict/youdao/request";
import { ReleaseDetail } from "./releaseVersion/releaseDetail";
import { useState } from "react";
import { EasydictInfo } from "./releaseVersion/version";

export const eudicBundleId = "com.eusoft.freeeudic";

export function getPlaySoundIcon(lightTintColor: string) {
  return {
    source: { light: "play.png", dark: "play.png" },
    tintColor: { light: lightTintColor, dark: "lightgray" },
  };
}

/**
  return the corresponding ImageLike based on the SectionType type
*/
export function getListItemIcon(sectionType: SectionType | TranslateType): Image.ImageLike {
  let dotColor: Color.ColorLike = Color.PrimaryText;
  switch (sectionType) {
    case TranslateType.Youdao: {
      dotColor = Color.Red;
      break;
    }
    case TranslateType.Apple: {
      dotColor = "#408080";
      break;
    }
    case TranslateType.Baidu: {
      dotColor = "#4169E1";
      break;
    }
    case TranslateType.Tencent: {
      dotColor = Color.Purple;
      break;
    }
    case TranslateType.Caiyun: {
      dotColor = Color.Green;
      break;
    }

    case SectionType.Translation: {
      dotColor = Color.Red;
      break;
    }
    case SectionType.Explanations: {
      dotColor = Color.Blue;
      break;
    }
    case SectionType.WebTranslation: {
      dotColor = Color.Yellow;
      break;
    }
    case SectionType.WebPhrase: {
      dotColor = "teal";
      break;
    }
  }

  let itemIcon: Image.ImageLike = {
    source: Icon.Dot,
    tintColor: dotColor,
  };
  if (sectionType === SectionType.Forms) {
    itemIcon = Icon.Text;
  }

  if (sectionType in TranslateType) {
    itemIcon = getTranslateTypeIcon(sectionType as TranslateType);
  }

  return itemIcon;
}

/**
 * Get translate type icon based on the section type
 */
function getTranslateTypeIcon(translatType: TranslateType): Image.ImageLike {
  return {
    source: `${translatType}-Translate.png`,
    mask: Image.Mask.RoundedRectangle,
  };
}

/**
  return List.Item.Accessory[] based on the SectionType type
*/
export function getWordAccessories(
  sectionType: SectionType | TranslateType,
  item: YoudaoTranslateReformatResultItem
): List.Item.Accessory[] {
  let wordExamTypeAccessory = [];
  let pronunciationAccessory = [];
  let wordAccessories: List.Item.Accessory[] = [];
  if (sectionType === SectionType.Translation) {
    if (item.examTypes) {
      wordExamTypeAccessory = [
        {
          icon: { source: Icon.Star, tintColor: Color.SecondaryText },
          tooltip: "Word included in the types of exam",
        },
        { text: item.examTypes?.join("  ") },
      ];
      wordAccessories = [...wordExamTypeAccessory];
    }
    if (item.phonetic) {
      pronunciationAccessory = [
        {
          icon: getPlaySoundIcon("gray"),
          tooltip: "Pronunciation",
        },
        { text: item.phonetic },
      ];
      wordAccessories = [...wordAccessories, { text: " " }, ...pronunciationAccessory];
    }
  }
  return wordAccessories;
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

/**
 * Get the list action panel item with ListItemActionPanelItem
 */
export default function ListActionPanel(props: ActionListPanelProps) {
  const [isNeedPrompt, setIsNeedPrompt] = useState<boolean>(false);
  const [releaseMarkdown, setReleaseMarkdown] = useState<string>("");
  const [isInstalledEudic, setIsInstalledEudic] = useState<boolean>(false);

  checkIsInstalledEudic(setIsInstalledEudic);

  const easydict = new EasydictInfo();
  easydict.fetchReleaseMarkdown().then((markdown) => {
    if (markdown && markdown.length > 0) {
      setIsNeedPrompt(true);
      setReleaseMarkdown(markdown);
    } else {
      setIsNeedPrompt(false);
    }
  });

  const eudicWebUrl = getEudicWebTranslateURL(props.queryWordInfo);
  const youdaoWebUrl = getYoudaoWebTranslateURL(props.queryWordInfo);

  return (
    <ActionPanel>
      <ActionPanel.Section>
        {isNeedPrompt && (
          <Action.Push
            icon={Icon.TextDocument}
            title="✨ New Version Released!"
            target={<ReleaseDetail markdown={releaseMarkdown} />}
          />
        )}

        {isInstalledEudic && (
          <Action
            icon={Icon.MagnifyingGlass}
            title="Open in Eudic"
            onAction={() => openInEudic(props.queryWordInfo.word)}
          />
        )}
        <Action.CopyToClipboard
          onCopy={() => {
            console.log("copy: ", props.copyText);
          }}
          title={`Copy Text`}
          content={props.copyText || ""}
        />
      </ActionPanel.Section>

      <ActionPanel.Section title="Search Query Text Online">
        {eudicWebUrl.length !== 0 && (
          <Action.OpenInBrowser icon={Icon.Link} title="Eudic Dictionary" url={eudicWebUrl} />
        )}
        {youdaoWebUrl.length !== 0 && (
          <Action.OpenInBrowser icon={Icon.Link} title="Youdao Dictionary" url={youdaoWebUrl} />
        )}

        <Action.OpenInBrowser
          icon={Icon.Link}
          title="Google Translate"
          url={getGoogleWebTranslateURL(props.queryWordInfo)}
        />
      </ActionPanel.Section>

      <ActionPanel.Section title="Play Text Audio">
        <Action
          title="Play Query Text"
          icon={getPlaySoundIcon("black")}
          shortcut={{ modifiers: ["cmd"], key: "s" }}
          onAction={() => {
            console.log(`start play sound: ${props.queryWordInfo.word}`);
            playYoudaoWordAudioAfterDownloading(props.queryWordInfo);
          }}
        />
        <Action
          title="Play Result Text"
          icon={getPlaySoundIcon("black")}
          onAction={() => {
            /**
             *  directly use say command to play the result text.
             *  because it is difficult to determine whether the result is a word, impossible to use Youdao web audio directly.
             *  in addition, TTS needs to send additional youdao query requests.
             */
            sayTruncateCommand(props.copyText, props.queryWordInfo.toLanguage);
          }}
        />
      </ActionPanel.Section>

      {myPreferences.isDisplayTargetTranslationLanguage && (
        <ActionPanel.Section title="Target Language">
          {languageItemList.map((region) => {
            if (props.queryWordInfo.fromLanguage === region.youdaoLanguageId) {
              return null;
            }

            return (
              <Action
                key={region.youdaoLanguageId}
                title={region.languageTitle}
                onAction={() => props.onLanguageUpdate(region)}
                icon={props.queryWordInfo.fromLanguage === region.youdaoLanguageId ? Icon.ArrowRight : Icon.Globe}
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
