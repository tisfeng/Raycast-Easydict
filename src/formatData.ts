import { SectionType, TranslateType } from "./consts";
import { IcibaDictionaryResult } from "./dict/iciba/interface";
import {
  QueryWordInfo,
  TranslateDisplayResult,
  TranslateFormatResult,
  TranslateSourceResult,
  TranslateItem,
  YoudaoTranslateResult,
  TranslateTypeResult,
  BaiduTranslateResult,
  TencentTranslateResult,
  CaiyunTranslateResult,
} from "./types";
import { isShowMultipleTranslations } from "./utils";

export function updateFormateResultWithBaiduTranslation(
  baiduTypeResult: TranslateTypeResult,
  formatResult: TranslateFormatResult
): TranslateFormatResult {
  const baiduResult = baiduTypeResult.result as BaiduTranslateResult;
  if (baiduResult?.trans_result) {
    const baiduTranslation = baiduResult.trans_result
      .map((item) => {
        return item.dst;
      })
      .join("\n");

    formatResult.translations.push({
      type: TranslateType.Baidu,
      text: baiduTranslation,
    });
  }
  return sortTranslations(formatResult);
}

export function updateFormateResultWithTencentTranslation(
  tencentTypeResult: TranslateTypeResult,
  formatResult: TranslateFormatResult
): TranslateFormatResult {
  const tencentResult = tencentTypeResult.result as TencentTranslateResult;
  if (tencentResult) {
    const tencentTranslation = tencentResult.TargetText;

    formatResult.translations.push({
      type: TranslateType.Tencent,
      text: tencentTranslation,
    });
  }
  return sortTranslations(formatResult);
}

export function updateFormateResultWithCaiyunTranslation(
  caiyunTypeResult: TranslateTypeResult,
  formatResult: TranslateFormatResult
): TranslateFormatResult {
  const caiyunResult = caiyunTypeResult.result as CaiyunTranslateResult;
  if (caiyunResult) {
    formatResult.translations.push({
      type: TranslateType.Caiyun,
      text: caiyunResult?.target.join("\n"),
    });
  }
  return sortTranslations(formatResult);
}

// function sort formatResult translations, by type: baidu > tencent > youdao > caiyun
export function sortTranslations(
  formatResult: TranslateFormatResult
): TranslateFormatResult {
  const sortByOrders = [
    TranslateType.Baidu,
    TranslateType.Tencent,
    TranslateType.Youdao,
    TranslateType.Caiyun,
  ];
  const sortTranslations: TranslateItem[] = [];
  for (const translationItem of formatResult.translations) {
    const index = sortByOrders.indexOf(translationItem.type);
    sortTranslations[index] = translationItem;
  }
  // filter undefined
  const translations = sortTranslations.filter((item) => item);
  formatResult.translations = translations;
  return formatResult;
}

export function formatYoudaoTranslateResult(
  youdaoResult: YoudaoTranslateResult
): TranslateFormatResult {
  const translations = youdaoResult!.translation.map((translationText) => {
    return {
      type: TranslateType.Youdao,
      text: translationText,
    };
  });

  const [from, to] = youdaoResult.l.split("2"); // from2to
  let usPhonetic = youdaoResult.basic?.["us-phonetic"]; // may be two phonetic "trænzˈleɪʃn; trænsˈleɪʃn"
  usPhonetic = usPhonetic?.split("; ")[1] || usPhonetic;
  const queryTextInfo: QueryWordInfo = {
    word: youdaoResult.query,
    phonetic: usPhonetic || youdaoResult.basic?.phonetic,
    speech: youdaoResult.basic?.["us-speech"],
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

  return {
    queryWordInfo: queryTextInfo,
    translations: translations,
    explanations: youdaoResult.basic?.explains,
    forms: youdaoResult.basic?.wfs,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
}

export function formatTranslateResult(
  src: TranslateSourceResult
): TranslateFormatResult {
  let translations: TranslateItem[] = [];

  const youdaoResult = src.youdaoResult;
  const youdaoTranslations = src.youdaoResult!.translation.map(
    (translationText) => {
      return {
        type: TranslateType.Youdao,
        text: translationText,
      };
    }
  );

  translations.push(...youdaoTranslations);

  if (src.baiduResult?.trans_result) {
    const baiduTranslation = src.baiduResult.trans_result
      .map((item) => {
        return item.dst;
      })
      .join("\n");

    translations.push({
      type: TranslateType.Baidu,
      text: baiduTranslation,
    });
  }

  if (src.tencentResult) {
    const tencentTranslation = src.tencentResult.TargetText;

    translations.push({
      type: TranslateType.Tencent,
      text: tencentTranslation,
    });
  }

  if (src.caiyunResult) {
    translations.push({
      type: TranslateType.Caiyun,
      text: src.caiyunResult?.target.join("\n"),
    });
  }

  const [from, to] = src.youdaoResult.l.split("2"); // from2to
  let usPhonetic = src.youdaoResult.basic?.["us-phonetic"]; // may be two phonetic "trænzˈleɪʃn; trænsˈleɪʃn"
  usPhonetic = usPhonetic?.split("; ")[1] ?? usPhonetic;
  const queryTextInfo: QueryWordInfo = {
    word: src.youdaoResult.query,
    phonetic: usPhonetic || youdaoResult.basic?.phonetic,
    speech: src.youdaoResult.basic?.["us-speech"],
    fromLanguage: from,
    toLanguage: to,
    isWord: src.youdaoResult.isWord,
    examTypes: src.youdaoResult.basic?.exam_type,
    speechUrl: src.youdaoResult.speakUrl,
  };

  let webTranslation;
  if (src.youdaoResult.web) {
    webTranslation = src.youdaoResult.web[0];
  }
  const webPhrases = src.youdaoResult.web?.slice(1);

  return {
    queryWordInfo: queryTextInfo,
    translations: translations,
    explanations: src.youdaoResult.basic?.explains,
    forms: src.youdaoResult.basic?.wfs,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
}

export function formatTranslateDisplayResult(
  formatResult: TranslateFormatResult | null
): TranslateDisplayResult[] {
  let displayResult: Array<TranslateDisplayResult> = [];
  if (!formatResult) {
    return displayResult;
  }

  const showMultipleTranslations = isShowMultipleTranslations(formatResult);

  for (const [i, translation] of formatResult.translations.entries()) {
    let sectionType = showMultipleTranslations
      ? translation.type
      : SectionType.Translation;
    let sectionTitle: any = sectionType;
    let tooltip: string = translation.type;

    if (showMultipleTranslations) {
      tooltip = "";
    }

    let oneLineTranslation = translation.text.split("\n").join(" ");

    const phoneticText = formatResult.queryWordInfo.phonetic
      ? `[${formatResult.queryWordInfo.phonetic}]`
      : undefined;

    const isShowWordSubtitle =
      phoneticText || formatResult.queryWordInfo.examTypes;
    const wordSubtitle = isShowWordSubtitle
      ? formatResult.queryWordInfo.word
      : undefined;

    displayResult.push({
      type: sectionType,
      sectionTitle: sectionTitle,
      items: [
        {
          key: oneLineTranslation + i,
          title: oneLineTranslation,
          subtitle: wordSubtitle,
          tooltip: tooltip,
          copyText: oneLineTranslation,
          queryWordInfo: formatResult.queryWordInfo,
          phonetic: phoneticText,
          speech: formatResult.queryWordInfo.speech,
          examTypes: formatResult.queryWordInfo.examTypes,
          translationMarkdown: formatAllTypeTranslationToMarkdown(
            sectionType,
            formatResult
          ),
        },
      ],
    });

    if (!isShowMultipleTranslations) {
      break;
    }
  }

  let hasShowDetailsSectionTitle = false;
  let detailsSectionTitle = "Details";

  formatResult.explanations?.forEach((explanation, i) => {
    displayResult.push({
      type: SectionType.Explanations,
      sectionTitle: !hasShowDetailsSectionTitle
        ? detailsSectionTitle
        : undefined,
      items: [
        {
          key: explanation + i,
          title: explanation,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: SectionType.Explanations,
          copyText: explanation,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  const wfs = formatResult.forms?.map((wfItem, idx) => {
    return wfItem.wf?.name + " " + wfItem.wf?.value;
  });

  // [ 复数 goods   比较级 better   最高级 best ]
  const wfsText = wfs?.join("   ") || "";
  if (wfsText.length) {
    displayResult.push({
      type: SectionType.Forms,
      sectionTitle: !hasShowDetailsSectionTitle
        ? detailsSectionTitle
        : undefined,
      items: [
        {
          key: wfsText,
          title: "",
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: SectionType.Forms,
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
    displayResult.push({
      type: SectionType.WebTranslation,
      sectionTitle: !hasShowDetailsSectionTitle
        ? detailsSectionTitle
        : undefined,
      items: [
        {
          key: webResultKey,
          title: webResultKey,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: SectionType.WebTranslation,
          subtitle: webResultValue,
          copyText: `${webResultKey} ${webResultValue}`,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  }

  formatResult.webPhrases?.forEach((phrase, i) => {
    const phraseKey = phrase.key;
    const phraseValue = phrase.value.join("；");
    displayResult.push({
      type: SectionType.WebPhrase,
      sectionTitle: !hasShowDetailsSectionTitle
        ? detailsSectionTitle
        : undefined,
      items: [
        {
          key: phraseKey + i,
          title: phraseKey,
          queryWordInfo: formatResult.queryWordInfo,
          tooltip: SectionType.WebPhrase,
          subtitle: phraseValue,
          copyText: `${phraseKey} ${phraseValue}`,
        },
      ],
    });

    hasShowDetailsSectionTitle = true;
  });

  return displayResult;
}

export function updateFormateIcibaDict(
  icibaResult: IcibaDictionaryResult,
  formatResult: TranslateFormatResult
) {
  if (!icibaResult) {
    return formatResult;
  }
}

export function formatAllTypeTranslationToMarkdown(
  type: TranslateType | SectionType,
  formatResult: TranslateFormatResult
) {
  const sourceText = formatResult.queryWordInfo.word;
  let translations = [] as TranslateItem[];
  for (const translation of formatResult.translations) {
    const formatTranslation = formatTranslationToMarkdown(
      translation.type,
      translation.text
    );
    translations.push({ type: translation.type, text: formatTranslation });
  }
  // Traverse the translations array. If the type of translation element is equal to it, move it to the first of the array.
  for (let i = 0; i < translations.length; i++) {
    if (translations[i].type === type) {
      const temp = translations[i];
      translations.splice(i, 1);
      translations.unshift(temp);
      break;
    }
  }
  return translations
    .map((translation) => {
      return translation.text;
    })
    .join("\n");
}

// function format translation result to display multiple translations
export function formatTranslationToMarkdown(
  type: TranslateType | SectionType,
  text: string
) {
  let string = text.replace(/\n/g, "\n\n");
  let markdown = `
  ## ${type} 
  ---  
  ${string}
  `;
  return markdown;
}
