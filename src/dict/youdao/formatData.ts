/*
 * @author: tisfeng
 * @createTime: 2022-08-03 00:02
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-10 17:32
 * @fileName: formatData.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { DicionaryType, DisplaySection } from "../../types";
import {
  QueryWordInfo,
  YoudaoDictionaryFormatResult,
  YoudaoDictionaryListItemType,
  YoudaoDictionaryResult,
} from "./types";

/**
 * Format the Youdao original data for later use.
 */
export function formatYoudaoDictionaryResult(youdaoResult: YoudaoDictionaryResult): YoudaoDictionaryFormatResult {
  const [from, to] = youdaoResult.l.split("2"); // from2to
  let usPhonetic = youdaoResult.basic?.["us-phonetic"]; // may be two phonetic "trænzˈleɪʃn; trænsˈleɪʃn"
  usPhonetic = usPhonetic?.split("; ")[1] || usPhonetic;
  const queryWordInfo: QueryWordInfo = {
    word: youdaoResult.query,
    phonetic: usPhonetic || youdaoResult.basic?.phonetic,
    fromLanguage: from,
    toLanguage: to,
    isWord: youdaoResult.isWord,
    examTypes: youdaoResult.basic?.exam_type,
    speechUrl: youdaoResult.speakUrl,
  };

  let webTranslation;
  if (youdaoResult.web) {
    webTranslation = youdaoResult.web[0];
  }
  const webPhrases = youdaoResult.web?.slice(1);
  // * only use the first translation
  const translations = youdaoResult.translation[0].split("\n");
  const formateResult: YoudaoDictionaryFormatResult = {
    queryWordInfo: queryWordInfo,
    translations: translations,
    explanations: youdaoResult.basic?.explains,
    forms: youdaoResult.basic?.wfs,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
  queryWordInfo.hasDictionaryEntries = hasYoudaoDictionaryEntries(formateResult);

  return formateResult;
}

/**
 * Update Youdao dictionary display result.
 */
export function updateYoudaoDictionaryDisplay(formatResult: YoudaoDictionaryFormatResult | null): DisplaySection[] {
  const sectionResult: Array<DisplaySection> = [];
  if (!formatResult) {
    return sectionResult;
  }

  const queryWordInfo = formatResult.queryWordInfo;
  const youdaoType = DicionaryType.Youdao;
  const oneLineTranslation = formatResult.translations.join(", ");
  const phoneticText = queryWordInfo.phonetic ? `[${queryWordInfo.phonetic}]` : undefined;
  const isShowWordSubtitle = phoneticText || queryWordInfo.examTypes;
  const wordSubtitle = isShowWordSubtitle ? queryWordInfo.word : undefined;

  sectionResult.push({
    type: youdaoType,
    sectionTitle: youdaoType,
    items: [
      {
        displayType: YoudaoDictionaryListItemType.Translation,
        queryType: youdaoType,
        key: oneLineTranslation + youdaoType,
        title: oneLineTranslation,
        subtitle: wordSubtitle,
        tooltip: `Translate`,
        copyText: oneLineTranslation,
        queryWordInfo: queryWordInfo,
        accessoryItem: {
          phonetic: phoneticText,
          examTypes: queryWordInfo.examTypes,
        },
      },
    ],
  });

  let hasShowDetailsSectionTitle = false;
  const detailsSectionTitle = "Details";

  formatResult.explanations?.forEach((explanation, i) => {
    sectionResult.push({
      type: YoudaoDictionaryListItemType.Explanations,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.Explanations,
          queryType: youdaoType,
          key: explanation + i,
          title: explanation,
          queryWordInfo: queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.Explanations,
          copyText: explanation,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  const wfs = formatResult.forms?.map((wfItem) => {
    return wfItem.wf?.name + " " + wfItem.wf?.value;
  });

  // [ 复数 goods   比较级 better   最高级 best ]
  const wfsText = wfs?.join("   ") || "";
  if (wfsText.length) {
    sectionResult.push({
      type: YoudaoDictionaryListItemType.Forms,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.Forms,
          queryType: youdaoType,
          key: wfsText,
          title: "",
          queryWordInfo: queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.Forms,
          subtitle: `[ ${wfsText} ]`,
          copyText: wfsText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  }

  if (formatResult.webTranslation) {
    const webResultKey = formatResult.webTranslation?.key;
    const webResultValue = formatResult.webTranslation.value.join("；");
    const copyText = `${webResultKey} ${webResultValue}`;
    sectionResult.push({
      type: YoudaoDictionaryListItemType.WebTranslation,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.WebTranslation,
          queryType: youdaoType,
          key: copyText,
          title: webResultKey,
          queryWordInfo: queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.WebTranslation,
          subtitle: webResultValue,
          copyText: copyText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  }

  formatResult.webPhrases?.forEach((phrase, i) => {
    const phraseKey = phrase.key;
    const phraseValue = phrase.value.join("；");
    const copyText = `${phraseKey} ${phraseValue}`;
    sectionResult.push({
      type: YoudaoDictionaryListItemType.WebPhrase,
      sectionTitle: !hasShowDetailsSectionTitle ? detailsSectionTitle : undefined,
      items: [
        {
          displayType: YoudaoDictionaryListItemType.WebPhrase,
          queryType: youdaoType,
          key: copyText + i,
          title: phraseKey,
          queryWordInfo: queryWordInfo,
          tooltip: YoudaoDictionaryListItemType.WebPhrase,
          subtitle: phraseValue,
          copyText: copyText,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  return sectionResult;
}

/**
 * Check if Youdao dictionary has entries.
 */
export function hasYoudaoDictionaryEntries(formatResult: YoudaoDictionaryFormatResult) {
  return (
    (formatResult.explanations || formatResult.forms || formatResult.webPhrases || formatResult.webTranslation) !==
    undefined
  );
}
