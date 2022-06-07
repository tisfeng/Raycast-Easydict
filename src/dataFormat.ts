import { SectionType, TranslateType } from "./consts";
import {
  QueryWordInfo,
  TranslateDisplayResult,
  TranslateFormatResult,
  TranslateSourceResult,
  TranslateItem,
} from "./types";
import { isPreferredChinese } from "./utils";

export function formatTranslateResult(
  src: TranslateSourceResult
): TranslateFormatResult {
  let translations: TranslateItem[] = [];

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
  const queryTextInfo: QueryWordInfo = {
    query: src.youdaoResult.query,
    phonetic: src.youdaoResult.basic?.phonetic,
    from: from,
    to: to,
    isWord: src.youdaoResult.isWord,
    examTypes: src.youdaoResult.basic?.exam_type,
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
  formatResult: TranslateFormatResult
): TranslateDisplayResult[] {
  let displayResult: Array<TranslateDisplayResult> = [];

  // console.log("reformatResult: ", JSON.stringify(reformatResult));

  const isShowMultipleTranslations =
    !formatResult.explanations &&
    !formatResult.forms &&
    !formatResult.webPhrases &&
    !formatResult.webTranslation;

  for (const [i, translation] of formatResult.translations.entries()) {
    let sectionType = isShowMultipleTranslations
      ? translation.type
      : SectionType.Translation;
    let sectionTitle: any = sectionType;
    let tooltip: string = translation.type;

    if (isShowMultipleTranslations) {
      tooltip = "";
    }

    let oneLineTranslation = translation.text.split("\n").join(" ");

    displayResult.push({
      type: sectionType,
      sectionTitle: sectionTitle,
      items: [
        {
          key: oneLineTranslation + i,
          title: oneLineTranslation,
          tooltip: tooltip,
          copyText: oneLineTranslation,
          phonetic: formatResult.queryWordInfo.phonetic,
          examTypes: formatResult.queryWordInfo.examTypes,
          translationDetail: formatAllTypeTranslation(
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

export function formatAllTypeTranslation(
  type: TranslateType | SectionType,
  formatResult: TranslateFormatResult
) {
  const sourceText = formatResult.queryWordInfo.query;
  let translations = [] as TranslateItem[];
  for (const translation of formatResult.translations) {
    const formatTranslation = formatTranslationType(
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
export function formatTranslationType(
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
