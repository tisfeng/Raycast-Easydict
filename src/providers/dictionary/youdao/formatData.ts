/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { chineseLanguageItem } from "@/core/language/consts";
import { DictionaryType } from "@/types/api";
import type { DisplaySection, ListAccessoryItem, ListDisplayItem } from "@/types/display";
import { logTrace } from "@/utils/logger";

import type {
  BaikeSummary,
  ExplanationItem,
  KeyValueItem,
  ModernChineseDataList,
  QueryWordInfo,
  Sense,
  WordExplanation,
  WordForms,
  YoudaoDictionaryFormatResult,
  YoudaoWebDictionaryModel,
} from "./types";
import { YoudaoDictionaryListItemType } from "./types";

/**
 * Compute detailsMarkdown for a Youdao dictionary list item.
 *
 */
function computeYoudaoDetailsMarkdown(title: string, subtitle?: string): string {
  if (!subtitle || subtitle.startsWith(title)) {
    return subtitle || title;
  }
  const match = subtitle.match(/"(.*?)"/);
  if (match?.[1] === title) {
    return subtitle;
  }
  return `${title} ${subtitle}`;
}

interface DictionaryItemOptions {
  key: string;
  title: string;
  subtitle?: string;
  copyText: string;
  detailsMarkdown?: string;
  accessoryItem?: ListAccessoryItem;
}

function buildDictionaryItem(
  displayType: YoudaoDictionaryListItemType,
  queryWordInfo: QueryWordInfo,
  { key, title, subtitle, copyText, detailsMarkdown, accessoryItem }: DictionaryItemOptions,
): ListDisplayItem {
  return {
    displayCategory: "dictionary",
    displayType,
    queryType: DictionaryType.Youdao,
    queryWordInfo,
    tooltip: displayType,
    key,
    title,
    subtitle,
    copyText,
    detailsMarkdown: detailsMarkdown ?? computeYoudaoDetailsMarkdown(title, subtitle),
    accessoryItem,
  };
}

function buildSummarySection(
  type: YoudaoDictionaryListItemType.Baike | YoudaoDictionaryListItemType.Wikipedia,
  queryWordInfo: QueryWordInfo,
  summaryData: BaikeSummary | undefined,
): DisplaySection | undefined {
  const key = summaryData?.key || "";
  const summary = summaryData?.summary || "";
  if (!summary) return;
  const copyText = `${key} ${summary}`;
  return {
    type,
    items: [buildDictionaryItem(type, queryWordInfo, { key: copyText, title: key, subtitle: summary, copyText })],
  };
}

/**
 * Update Youdao dictionary display result.
 */
export function updateYoudaoDictionaryDisplay(
  youdaoResult: YoudaoDictionaryFormatResult | undefined,
): DisplaySection[] | undefined {
  if (!youdaoResult) {
    return;
  }

  const displaySections: Array<DisplaySection> = [];

  const queryWordInfo = youdaoResult.queryWordInfo;
  const oneLineTranslation = youdaoResult.translation.split("\n").join(", ");
  const subtitle = queryWordInfo.word.split("\n").join(" ");

  // 1. Translation.
  const translationItem = buildDictionaryItem(YoudaoDictionaryListItemType.Translation, queryWordInfo, {
    key: oneLineTranslation + DictionaryType.Youdao,
    title: oneLineTranslation,
    subtitle,
    copyText: oneLineTranslation,
    accessoryItem: {
      phonetic: queryWordInfo.phonetic,
      examTypes: queryWordInfo.examTypes,
    },
  });
  displaySections.push({
    type: YoudaoDictionaryListItemType.Translation,
    sectionTitle: DictionaryType.Youdao,
    items: [translationItem],
  });

  // 2. Modern Chinese dictionary.
  logTrace("YoudaoFormatData", "Modern Chinese dictionary");

  if (youdaoResult.modernChineseDict?.length) {
    const modernChineseDictItems: ListDisplayItem[] = [];
    youdaoResult.modernChineseDict.forEach((phoneticDict) => {
      const placeholder = `~`;
      logTrace("YoudaoFormatData", `forms: ${JSON.stringify(phoneticDict, null, 4)}`);
      const pinyin = phoneticDict.pinyin ? `${phoneticDict.pinyin}` : "";
      const accessoryItem = translationItem.accessoryItem;
      if (pinyin && accessoryItem && !accessoryItem.phonetic) {
        accessoryItem.phonetic = `/ ${pinyin} /`;
      }

      if (phoneticDict.sense?.length) {
        const senseGroups: Sense[][] = [];
        let group: Sense[] = [];
        let lastCat: string | undefined;

        // * group senses by category
        for (const senseItem of phoneticDict.sense) {
          if (senseItem.cat !== lastCat) {
            if (group.length) senseGroups.push(group);
            group = [senseItem];
            lastCat = senseItem.cat;
          } else {
            group.push(senseItem);
          }
        }
        if (group.length) senseGroups.push(group);
        logTrace("YoudaoFormatData", `senseGroups: ${JSON.stringify(senseGroups, null, 4)}`);

        let markdown = pinyin;
        let subtitle = "";
        senseGroups.forEach((groups) => {
          logTrace("YoudaoFormatData", `group: ${JSON.stringify(groups, null, 4)}`);

          const firstGroup = groups[0];
          const cat = firstGroup.cat;
          let catText = cat ? `${cat} ` : "";
          if (!cat && firstGroup.def) {
            catText = placeholder;
          }

          markdown += `\n\n${catText}`;
          subtitle += catText;

          const defExampleMarkdown = getDefExampleMarkdown(groups, placeholder);
          markdown += defExampleMarkdown;

          const subtitleText = defExampleMarkdown.replace(/\n/g, " ").replace(/`/g, "");
          subtitle += subtitleText;
        });

        const title = pinyin ? `${pinyin}` : "";
        const copyText = `${title}  ${subtitle}`;
        logTrace("YoudaoFormatData", `markdown: ${markdown}`);
        logTrace("YoudaoFormatData", `copyText: ${copyText}`);

        modernChineseDictItems.push(
          buildDictionaryItem(YoudaoDictionaryListItemType.ModernChineseDict, queryWordInfo, {
            key: copyText,
            title: title,
            subtitle: subtitle,
            copyText: copyText,
            detailsMarkdown: markdown,
          }),
        );
      }
    });

    if (modernChineseDictItems?.length) {
      displaySections.push({
        type: YoudaoDictionaryListItemType.ModernChineseDict,
        items: modernChineseDictItems,
      });
    }
  }

  // 3. Explanation.
  const explanationType = YoudaoDictionaryListItemType.Explanation;
  const explanationItems = youdaoResult.explanations?.map((explanation, i) => {
    const title = explanation.title;
    const subtitle = explanation.subtitle ? ` ${explanation.subtitle}` : "";
    const copyText = `${title}${subtitle}`;
    return buildDictionaryItem(explanationType, queryWordInfo, { key: copyText + i, title, subtitle, copyText });
  });
  if (explanationItems?.length) {
    displaySections.push({
      type: YoudaoDictionaryListItemType.Explanation,
      items: explanationItems,
    });
  }

  // 4. Forms.
  const formsType = YoudaoDictionaryListItemType.Forms;
  const wfs = youdaoResult.forms?.map((wfItem) => {
    return wfItem.wf?.name + ": " + wfItem.wf?.value;
  });
  // [ 复数：goods   比较级：better   最高级：best ]
  const wfsText = wfs?.join("   ");
  if (wfsText) {
    const formsMarkdown = ` [ ${wfsText} ]`;
    displaySections.push({
      type: YoudaoDictionaryListItemType.Forms,
      items: [
        buildDictionaryItem(formsType, queryWordInfo, {
          key: wfsText,
          title: "",
          subtitle: formsMarkdown,
          copyText: wfsText,
          detailsMarkdown: formsMarkdown,
        }),
      ],
    });
  }

  // 5. Web Translation.
  if (youdaoResult.webTranslation) {
    const webResultKey = youdaoResult.webTranslation.key;
    const webResultValue = youdaoResult.webTranslation.value.join("；");
    const copyText = `${webResultKey} ${webResultValue}`;
    displaySections.push({
      type: YoudaoDictionaryListItemType.WebTranslation,
      items: [
        buildDictionaryItem(YoudaoDictionaryListItemType.WebTranslation, queryWordInfo, {
          key: copyText,
          title: webResultKey,
          subtitle: webResultValue,
          copyText,
        }),
      ],
    });
  }

  // 6. Web Phrases.
  const webPhraseItems = youdaoResult.webPhrases?.map((phrase, i) => {
    const phraseKey = phrase.key;
    const phraseValue = phrase.value.join("；");
    const copyText = `${phraseKey} ${phraseValue}`;
    return buildDictionaryItem(YoudaoDictionaryListItemType.WebPhrase, queryWordInfo, {
      key: copyText + i,
      title: phraseKey,
      subtitle: phraseValue,
      copyText,
    });
  });
  if (webPhraseItems?.length) {
    displaySections.push({
      type: YoudaoDictionaryListItemType.WebPhrase,
      items: webPhraseItems,
    });
  }

  // 7. Baike.
  const baikeSection = buildSummarySection(YoudaoDictionaryListItemType.Baike, queryWordInfo, youdaoResult.baike);
  if (baikeSection) displaySections.push(baikeSection);

  // 8. Wikipedia.
  const wikipediaSection = buildSummarySection(
    YoudaoDictionaryListItemType.Wikipedia,
    queryWordInfo,
    youdaoResult.wikipedia,
  );
  if (wikipediaSection) displaySections.push(wikipediaSection);

  // * Only has "Details" can show dictionary sections. Default has one translation section.
  if (displaySections.length > 1) {
    // Add section title: "Details"
    const secondSection = displaySections[1];
    secondSection.sectionTitle = "Details";
    return displaySections;
  }

  logTrace("YoudaoFormatData", "only one translation section, not showing dictionary sections");
}

/**
 * Check if Youdao dictionary has entries.
 */
function hasYoudaoDictionaryEntries(formatResult: YoudaoDictionaryFormatResult | undefined) {
  if (!formatResult) {
    return false;
  }

  return (
    (formatResult.explanations ||
      formatResult.forms ||
      formatResult.webPhrases ||
      formatResult.webTranslation ||
      formatResult.baike ||
      formatResult.wikipedia) !== undefined
  );
}

/**
 * Format YoudaoWebDictionaryModel to YoudaoDictionaryFormatResult.
 *
 * Todo: support more dictionary, currently only support English <--> Chinese.
 */
export function formatYoudaoWebDictionaryModel(model: YoudaoWebDictionaryModel): YoudaoDictionaryFormatResult {
  const [from, to] = getFromToLanguage(model);
  const input = model.input;
  let isWord = false;
  let phoneticText: string | undefined;
  let speechUrl: string | undefined;

  let translation = "";
  let examTypes: string[] | undefined;
  let forms: WordForms[] | undefined;

  // get baike info.
  let baike: BaikeSummary | undefined;
  // Todo: use baidu baike api to get baike info.
  const baikeSummarys = model.baike?.summarys;
  if (baikeSummarys?.length) {
    baike = baikeSummarys[0];
  }

  // get wikipedia_digest.
  let wikipediaDigest: BaikeSummary | undefined;
  const wikipediaDigests = model.wikipedia_digest?.summarys;
  if (wikipediaDigests?.length) {
    wikipediaDigest = wikipediaDigests[0];
  }

  let newChineseDataList: ModernChineseDataList[] | undefined;
  const dataList = model.newhh?.dataList;
  if (dataList?.length) {
    newChineseDataList = formatNewChineseDict(dataList);
  }

  // format web translation.
  const webTransList: KeyValueItem[] = (model.web_trans?.["web-translation"] || [])
    .filter((item) => item.trans?.length)
    .map((item) => ({
      key: item.key,
      value: item.trans!.map((t) => t.value).filter((v): v is string => !!v),
    }));

  let webTranslation: KeyValueItem | undefined;
  if (webTransList.length > 0) {
    const firstWebTranslation = webTransList[0];
    if (firstWebTranslation.key.toUpperCase() === input.toUpperCase()) {
      webTranslation = webTransList.shift();
      if (webTranslation?.value.length) {
        translation = webTranslation.value[0].split("; ")[0];
      }
    }
  }

  const webPhrases = webTransList.slice(0, 3); // only show 3 web phrases.
  const explanations: ExplanationItem[] = [];

  // format English-->Chinese dictionary.
  if (model.ec) {
    const wordItem = model.ec.word?.length ? model.ec.word[0] : undefined;

    // * Don't use simpleWord, because it maybe has multiple phonetics, eg: "record".
    phoneticText = getPhoneticDisplayText(wordItem?.usphone);

    // Word audio: https://dict.youdao.com/dictvoice?audio=good&type=2
    const usspeech = wordItem?.usspeech; // "good&type=2"
    const audioUrl = usspeech ? `https://dict.youdao.com/dictvoice?audio=${usspeech}` : undefined;
    logTrace("YoudaoFormatData", `${input}, audioUrl: ${audioUrl}`);

    explanations.length = 0;
    const trs = wordItem?.trs || [];
    for (const tr of trs) {
      const explanation = tr.tr?.[0]?.l?.i?.[0];
      if (explanation) {
        explanations.push({ title: explanation, subtitle: "" });
      }
    }

    isWord = wordItem !== undefined; // Todo: need to check more.
    examTypes = model.ec.exam_type?.slice(-6);
    speechUrl = audioUrl;
    forms = wordItem?.wfs;
  }

  // format Chinese-->English dictionary.
  if (model.ce) {
    const wordItem = model.ce.word?.length ? model.ce.word[0] : undefined;
    isWord = wordItem !== undefined;

    phoneticText = getPhoneticDisplayText(wordItem?.phone);

    explanations.length = 0;
    const trs = wordItem?.trs || [];
    for (const trsOjb of trs) {
      const l = trsOjb.tr?.[0]?.l;
      if (l) {
        const explanationItemList = l.i.filter((item) => typeof item !== "string") as WordExplanation[];
        const text = explanationItemList.map((item) => item["#text"]).join(" ");
        const pos = l.pos ? `${l.pos}` : "";
        const tran = l["#tran"] ? `${l["#tran"]}` : "";
        const tranText = pos ? `${pos}  ${tran}` : tran;
        explanations.push({ title: text, subtitle: tranText });
      }
    }
  }

  const queryWordInfo: QueryWordInfo = {
    word: input,
    fromLanguage: from,
    toLanguage: to,
    phonetic: phoneticText,
    examTypes: examTypes,
    speechUrl: speechUrl,
    isWord: isWord,
  };

  const formatResult: YoudaoDictionaryFormatResult = {
    queryWordInfo: queryWordInfo,
    translation: translation,
    explanations: explanations,
    forms: forms,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
    baike: baike,
    wikipedia: wikipediaDigest,
    modernChineseDict: newChineseDataList,
  };

  queryWordInfo.hasDictionaryEntries = hasYoudaoDictionaryEntries(formatResult);

  return formatResult;
}

/**
 * Get Youdao from to language.
 */
function getFromToLanguage(model: YoudaoWebDictionaryModel): [from: string, to: string] {
  let from = chineseLanguageItem.youdaoLangCode;
  let to = chineseLanguageItem.youdaoLangCode;
  // * Note: guessLanguage may be incorrect, eg: 鶗鴂 --> eng
  const guessLanguage = model.meta?.guessLanguage;
  if (guessLanguage === "zh") {
    to = model.le;
  } else {
    from = model.le;
  }
  return [from, to];
}

/**
 * Get word phonetic display text. eg: gʊd --> / gʊd /
 */
function getPhoneticDisplayText(phonetic: string | undefined): string | undefined {
  const phoneticText = phonetic ? `/ ${phonetic} /` : undefined;
  return phoneticText;
}

/**
 * Format New Chinese dictionary.
 */
function formatNewChineseDict(dataList: ModernChineseDataList[]): ModernChineseDataList[] | undefined {
  if (!dataList.length) return undefined;

  return dataList.map((dict) => ({
    ...dict,
    sense: dict.sense?.map((sense) => ({
      ...sense,
      examples: removeExamplesHtmlTag(sense.examples),
      subsense: sense.subsense?.map((subsense) => ({
        ...subsense,
        examples: removeExamplesHtmlTag(subsense.examples),
      })),
    })),
  }));
}

/**
 * Remove self html tag.
 */
function removeSelfHtmlTag(text: string): string {
  return text.replace(/<self>|<\/self>/g, "");
}

/**
 * Remove examples html tag.
 */
function removeExamplesHtmlTag(examples: string[] | undefined): string[] {
  if (!examples?.length) return [];
  return examples.map(removeSelfHtmlTag);
}

/**
 * Get defExample markdown from senseList.
 *
 * Test: 艾，为，的，帝
 */
function getDefExampleMarkdown(senseList: Sense[], word: string, preText = "\n\n", tag?: number): string {
  let markdown = "";
  senseList.forEach((senseItem, i) => {
    logTrace("YoudaoFormatData", `senseItem: ${JSON.stringify(senseItem, null, 4)}`);
    let defExampleText = preText;
    const tagText = tag ? `${tag}.` : "";
    defExampleText += tagText;
    const { def, examples } = senseItem;
    let defText = "";
    if (Array.isArray(def)) {
      const defList = def;
      defText = def?.length ? defList.join("; ") : "";
    } else {
      const defString = def as string;
      defText = defString;
    }
    defText = defText ? ` ${defText}` : "";

    // handle special case, eg. 为
    if (!defText.length && senseItem.subsense?.length) {
      defText = ` ${word}`;
    }
    logTrace("YoudaoFormatData", `defText: ${defText}`);

    const example = examples?.map((item) => `\`${item}\``).join("/");
    const exampleText = example ? `：${example}  ` : "";

    if (defText.length || exampleText.length) {
      defExampleText += `${i + 1}.${defText}${exampleText}`;
    }

    logTrace("YoudaoFormatData", `defExampleText: ${defExampleText}`);
    const subsensesList = senseItem.subsense;
    if (subsensesList?.length) {
      const subsenseDefExampleText = getDefExampleMarkdown(subsensesList, word, "\n", i + 1);
      logTrace("YoudaoFormatData", `subsenseDefExampleText: ${subsenseDefExampleText}`);
      defExampleText += "  " + subsenseDefExampleText + "";
    }

    markdown += defExampleText;
  });

  return markdown;
}
