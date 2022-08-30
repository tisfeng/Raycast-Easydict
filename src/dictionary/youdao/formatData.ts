/*
 * @author: tisfeng
 * @createTime: 2022-08-03 00:02
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-30 18:04
 * @fileName: formatData.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { chineseLanguageItem } from "../../language/consts";
import { DicionaryType, DisplaySection, ListDisplayItem } from "../../types";
import { copyToClipboard } from "../../utils";
import {
  KeyValueItem,
  QueryWordInfo,
  WordExplanation,
  WordForms,
  YoudaoDictionaryFormatResult,
  YoudaoDictionaryListItemType,
  YoudaoDictionaryResult,
  YoudaoWebDictionaryModel,
} from "./types";

/**
 * Format the Youdao original data for later use.
 */
export function formatYoudaoDictionaryResult(
  youdaoResult: YoudaoDictionaryResult
): YoudaoDictionaryFormatResult | undefined {
  // when youdao request error, query is not exist.
  if (!youdaoResult.query) {
    return;
  }

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
  const translation = youdaoResult.translation[0].split("\n")[0];
  const formateResult: YoudaoDictionaryFormatResult = {
    queryWordInfo: queryWordInfo,
    translation: translation,
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
export function updateYoudaoDictionaryDisplay(
  formatResult: YoudaoDictionaryFormatResult | undefined
): DisplaySection[] {
  const displaySections: Array<DisplaySection> = [];
  if (!formatResult) {
    return displaySections;
  }

  const queryWordInfo = formatResult.queryWordInfo;
  const youdaoDictionaryType = DicionaryType.Youdao;
  const oneLineTranslation = formatResult.translation.split("\n").join(", ");
  const phoneticText = queryWordInfo.phonetic ? `[${queryWordInfo.phonetic}]` : undefined;
  const subtitle = queryWordInfo.word.split("\n").join(" ");

  // 1. Translation.
  const translationType = YoudaoDictionaryListItemType.Translation;
  const translationItem: ListDisplayItem = {
    displayType: translationType,
    queryType: youdaoDictionaryType,
    key: oneLineTranslation + youdaoDictionaryType,
    title: oneLineTranslation,
    subtitle: subtitle,
    tooltip: translationType,
    copyText: oneLineTranslation,
    queryWordInfo: queryWordInfo,
    accessoryItem: {
      phonetic: phoneticText,
      examTypes: queryWordInfo.examTypes,
    },
  };
  displaySections.push({
    type: youdaoDictionaryType,
    sectionTitle: youdaoDictionaryType,
    items: [translationItem],
  });

  // 2. Explanation.
  const explanationType = YoudaoDictionaryListItemType.Explanation;
  const explanationItems = formatResult.explanations?.map((explanation, i) => {
    const displayItem: ListDisplayItem = {
      displayType: explanationType,
      queryType: youdaoDictionaryType,
      key: explanation + i,
      title: explanation,
      queryWordInfo: queryWordInfo,
      tooltip: explanationType,
      copyText: explanation,
    };
    return displayItem;
  });
  if (explanationItems) {
    displaySections.push({
      type: youdaoDictionaryType,
      items: explanationItems,
    });
  }

  // 3. Forms.
  const formsType = YoudaoDictionaryListItemType.Forms;
  const wfs = formatResult.forms?.map((wfItem) => {
    return wfItem.wf?.name + ": " + wfItem.wf?.value;
  });
  // [ 复数: goods   比较级: better   最高级: best ]
  const wfsText = wfs?.join("   ");
  if (wfsText) {
    const formsItem: ListDisplayItem = {
      displayType: formsType,
      queryType: youdaoDictionaryType,
      key: wfsText,
      title: "",
      queryWordInfo: queryWordInfo,
      tooltip: formsType,
      subtitle: ` [ ${wfsText} ]`,
      copyText: wfsText,
    };
    displaySections.push({
      type: youdaoDictionaryType,
      items: [formsItem],
    });
  }

  // 4. Web Translation.
  if (formatResult.webTranslation) {
    const webResultKey = formatResult.webTranslation.key;
    const webResultValue = formatResult.webTranslation.value.join("；");
    const copyText = `${webResultKey} ${webResultValue}`;

    const webTranslationItem: ListDisplayItem = {
      displayType: YoudaoDictionaryListItemType.WebTranslation,
      queryType: youdaoDictionaryType,
      key: copyText,
      title: webResultKey,
      queryWordInfo: queryWordInfo,
      tooltip: YoudaoDictionaryListItemType.WebTranslation,
      subtitle: webResultValue,
      copyText: copyText,
    };
    displaySections.push({
      type: YoudaoDictionaryListItemType.WebTranslation,
      items: [webTranslationItem],
    });
  }

  // 5. Web Phrases.
  const webPhraseItems = formatResult.webPhrases?.map((phrase, i) => {
    const phraseKey = phrase.key;
    const phraseValue = phrase.value.join("；");
    const copyText = `${phraseKey} ${phraseValue}`;

    const webPhraseItem: ListDisplayItem = {
      displayType: YoudaoDictionaryListItemType.WebPhrase,
      queryType: youdaoDictionaryType,
      key: copyText + i,
      title: phraseKey,
      queryWordInfo: queryWordInfo,
      tooltip: YoudaoDictionaryListItemType.WebPhrase,
      subtitle: phraseValue,
      copyText: copyText,
    };
    return webPhraseItem;
  });
  if (webPhraseItems) {
    displaySections.push({
      type: YoudaoDictionaryListItemType.WebPhrase,
      items: webPhraseItems,
    });
  }

  // Add section title: "Details"
  if (displaySections.length > 1) {
    const secondSection = displaySections[1];
    secondSection.sectionTitle = "Details";
  }

  return displaySections;
}

/**
 * Check if Youdao dictionary has entries.
 */
export function hasYoudaoDictionaryEntries(formatResult: YoudaoDictionaryFormatResult | undefined) {
  if (!formatResult) {
    return false;
  }

  return (
    (formatResult.explanations || formatResult.forms || formatResult.webPhrases || formatResult.webTranslation) !==
    undefined
  );
}

/**
 * Format YoudaoWebDictionaryModel to YoudaoDictionaryFormatResult.
 */
export function formateYoudaoWebDictionaryModel(
  model: YoudaoWebDictionaryModel
): YoudaoDictionaryFormatResult | undefined {
  // dicts always has at least one dict: meta
  if (model.meta.dicts.length < 2) {
    return;
  }

  const [from, to] = getFromToLanguage(model);
  let isWord = false;
  let phonetic: string | undefined;
  let speechUrl: string | undefined;

  const simpleWord = model.simple.word;
  if (simpleWord?.length) {
    const word = simpleWord[0];
    phonetic = word.usphone || word.phone;
  }

  let examTypes: string[] | undefined;
  let forms: WordForms[] | undefined;

  const webTrans = model.web_trans;
  const webTransList: KeyValueItem[] = [];
  if (webTrans) {
    const webTransItems = webTrans["web-translation"];
    if (webTransItems) {
      for (const webTransItem of webTransItems) {
        if (webTransItem.trans) {
          const transTextList: string[] = [];
          for (const trans of webTransItem.trans) {
            if (trans.value) {
              transTextList.push(trans.value);
            }
          }
          const trans: KeyValueItem = {
            key: webTransItem.key,
            value: transTextList,
          };
          webTransList.push(trans);
        }
      }
    }
  }
  console.log(`webTransList: ${JSON.stringify(webTransList, null, 4)}`);

  const webTranslation = webTransList.length ? webTransList[0] : undefined;
  const webPhrases = webTransList.slice(1, 4); // only get 3 web phrases.
  const firstWebTranslation = webTranslation ? webTranslation.value[0] : undefined;
  const firstTranslation = firstWebTranslation?.split("; ")[0];
  const translations = firstTranslation ?? "";
  const explanations: string[] = [];

  // format English-->Chinese dictionary.
  if (model.ec) {
    const word = model.ec.word?.length ? model.ec.word[0] : undefined;

    // word audio url:  https://dict.youdao.com/dictvoice?audio=good?type=2
    const usspeech = word?.usspeech;
    const audioUrl = usspeech ? `https://dict.youdao.com/dictvoice?audio=${usspeech}` : undefined;

    explanations.length = 0;
    const trs = word?.trs;
    if (trs?.length) {
      for (const tr of trs) {
        if (tr.tr?.length && tr.tr[0].l?.i?.length) {
          const explanation = tr.tr[0].l?.i[0];
          explanations.push(explanation);
        }
      }
    }
    console.log(`ec, explanations: ${JSON.stringify(explanations, null, 2)}`);

    isWord = model.ec.word !== undefined;
    examTypes = model.ec.exam_type;
    speechUrl = audioUrl;
    forms = word?.wfs;
  }

  // format Chinese-->English dictionary.
  if (model.ce) {
    const word = model.ce.word?.length ? model.ce.word[0] : undefined;

    explanations.length = 0;
    const trs = word?.trs;
    if (trs) {
      for (const trsOjb of trs) {
        if (trsOjb.tr && trsOjb.tr.length) {
          const l = trsOjb.tr[0].l;
          if (l) {
            const explanationItemList = l.i.filter((item) => typeof item !== "string") as WordExplanation[];
            const text = explanationItemList.map((item) => item["#text"]).join(" ");
            const pos = l.pos ? `  ${l.pos}` : "";
            const tran = l["#tran"] ? `${l["#tran"]}` : "";
            const explanation = `${text}${pos}   ${tran}`;
            explanations.push(explanation);
          }
        }
      }
    }
    console.log(`ce, explanations: ${JSON.stringify(explanations, null, 2)}`);
  }

  const queryWordInfo: QueryWordInfo = {
    word: model.input,
    fromLanguage: from,
    toLanguage: to,
    phonetic: phonetic,
    examTypes: examTypes,
    speechUrl: speechUrl,
    isWord: isWord,
  };
  console.log(`format queryWordInfo: ${JSON.stringify(queryWordInfo, null, 2)}`);

  const formateResult: YoudaoDictionaryFormatResult = {
    queryWordInfo: queryWordInfo,
    translation: translations,
    explanations: explanations,
    forms: forms,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
  queryWordInfo.hasDictionaryEntries = hasYoudaoDictionaryEntries(formateResult);

  copyToClipboard(JSON.stringify(formateResult, null, 4));

  return formateResult;
}

/**
 * Get Youdao from to language.
 */
export function getFromToLanguage(model: YoudaoWebDictionaryModel): [from: string, to: string] {
  let from = chineseLanguageItem.youdaoId;
  let to = chineseLanguageItem.youdaoId;
  const guessLanguage = model.meta.guessLanguage;
  if (guessLanguage === "zh") {
    to = model.le;
  } else {
    from = model.le;
  }
  return [from, to];
}
