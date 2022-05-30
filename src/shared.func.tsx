import axios from "axios";
import crypto from "crypto";
import querystring from "node:querystring";
import { getPreferenceValues } from "@raycast/api";
import { LANGUAGE_LIST, SectionType, TranslationType } from "./consts";

import {
  LanguageItem,
  Preferences,
  QueryTextInfo,
  TranslateDisplayResult,
  TranslateReformatResult,
  TranslateSourceResult,
  TranslationItem,
} from "./types";

export function truncate(string: string, length = 40, separator = "...") {
  if (string.length <= length) return string;
  return string.substring(0, length) + separator;
}

function isPreferredChinese(): boolean {
  const lanuguageIdPrefix = "zh";
  const preferences: Preferences = getPreferenceValues();
  if (
    preferences.language1.startsWith(lanuguageIdPrefix) ||
    preferences.language2.startsWith(lanuguageIdPrefix)
  ) {
    return true;
  }
  return false;
}

export function getItemFromLanguageList(value: string): LanguageItem {
  for (const langItem of LANGUAGE_LIST) {
    if (langItem.youdaoLanguageId === value) {
      return langItem;
    }
  }

  return {
    youdaoLanguageId: "",
    languageTitle: "",
    languageVoice: [""],
  };
}

// API Document https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
export function requestYoudaoAPI(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  function truncate(q: string): string {
    const len = q.length;
    return len <= 20
      ? q
      : q.substring(0, 10) + len + q.substring(len - 10, len);
  }

  const preferences: Preferences = getPreferenceValues();
  const AppId = preferences.youdaoAppId;
  const AppSecret = preferences.youdaoAppSecret;

  const sha256 = crypto.createHash("sha256");
  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const sha256Content =
    AppId + truncate(queryText) + salt + timestamp + AppSecret;
  const sign = sha256.update(sha256Content).digest("hex");
  const url = "https://openapi.youdao.com/api";

  return axios.post(
    url,
    querystring.stringify({
      sign,
      salt,
      from: fromLanguage,
      signType: "v3",
      q: queryText,
      appKey: AppId,
      curtime: timestamp,
      to: targetLanguage,
    })
  );
}

export function useSymbolSegmentationArrayText(textArray: string[]): string {
  return textArray.join("；");
}

// 百度翻译API https://fanyi-api.baidu.com/doc/21
export function requestBaiduAPI(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  const preferences: Preferences = getPreferenceValues();
  const AppId = preferences.baiduAppId;
  const AppSecret = preferences.baiduAppSecret;

  const md5 = crypto.createHash("md5");
  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = AppId + queryText + salt + AppSecret;
  const sign = md5.update(md5Content).digest("hex");
  const apiServer = "https://fanyi-api.baidu.com/api/trans/vip/translate";

  const from = getItemFromLanguageList(fromLanguage).baiduLanguageId;
  const to = getItemFromLanguageList(targetLanguage).baiduLanguageId;

  let encodeQueryText = encodeURIComponent(queryText);

  const url =
    apiServer +
    `?q=${encodeQueryText}&from=${from}&to=${to}&appid=${AppId}&salt=${salt}&sign=${sign}`;

  return axios.get(url);
}

// 彩云小译 https://docs.caiyunapp.com/blog/2018/09/03/lingocloud-api/#%E7%94%B3%E8%AF%B7%E8%AE%BF%E9%97%AE%E4%BB%A4%E7%89%8C
export function requestCaiyunAPI(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  const preferences: Preferences = getPreferenceValues();
  const AppToken = preferences.caiyunAppToken;

  const url = "https://api.interpreter.caiyunai.com/v1/translator";

  const from = getItemFromLanguageList(fromLanguage).caiyunLanguageId || "auto";
  const to = getItemFromLanguageList(targetLanguage).caiyunLanguageId;
  const trans_type = `${from}2${to}`; // "auto2xx";
  // console.log("requestCaiyunAPI: ", trans_type);

  // Note that Caiyun Xiaoyi only supports these types of translation at present, ["zh2en", "zh2ja", "en2zh", "ja2zh"]
  const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
  if (!supportedTranslatType.includes(trans_type)) {
    return Promise.resolve(null);
  }

  return axios.post(
    url,
    {
      source: queryText,
      trans_type,
      detect: from === "auto",
    },
    {
      headers: {
        "content-type": "application/json",
        "x-authorization": "token " + AppToken,
      },
    }
  );
}

// 并发请求多个翻译接口
export function requestAllTranslateAPI(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<any> {
  return axios.all([
    requestYoudaoAPI(queryText, fromLanguage, targetLanguage),
    requestBaiduAPI(queryText, fromLanguage, targetLanguage),
    requestCaiyunAPI(queryText, fromLanguage, targetLanguage),
  ]);
}

export function reformatTranslateResult(
  src: TranslateSourceResult
): TranslateReformatResult {
  let translations: TranslationItem[] = [];

  const youdaoTranslations = src.youdaoResult.translation.map(
    (translationText) => {
      return {
        type: TranslationType.Youdao,
        text: translationText,
      };
    }
  );

  translations.push(...youdaoTranslations);

  const baiduTranslation = src.baiduResult.trans_result
    .map((item) => {
      return item.dst;
    })
    .join(" ");

  translations.push({
    type: TranslationType.Baidu,
    text: baiduTranslation,
  });

  if (src.caiyunResult) {
    translations.push({
      type: TranslationType.Caiyun,
      text: src.caiyunResult?.target,
    });
  }

  const [from, to] = src.youdaoResult.l.split("2"); // from2to
  const queryTextInfo: QueryTextInfo = {
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
    queryTextInfo: queryTextInfo,
    translations: translations,
    explanations: src.youdaoResult.basic?.explains,
    forms: src.youdaoResult.basic?.wfs,
    webTranslation: webTranslation,
    webPhrases: webPhrases,
  };
}

export function reformatTranslateDisplayResult(
  reformatResult: TranslateReformatResult
): TranslateDisplayResult[] {
  let displayResult: Array<TranslateDisplayResult> = [];

  // console.log("reformatResult: ", JSON.stringify(reformatResult));

  const isShowMultipleTranslations =
    !reformatResult.explanations &&
    !reformatResult.forms &&
    !reformatResult.webPhrases &&
    !reformatResult.webTranslation;

  const sectionTitleMap = new Map([
    [TranslationType.Youdao, "有道翻译"],
    [TranslationType.Baidu, "百度翻译"],
    [TranslationType.Caiyun, "彩云小译"],
  ]);

  for (const [i, translation] of reformatResult.translations.entries()) {
    let sectionType = isShowMultipleTranslations
      ? translation.type
      : SectionType.Translation;
    let sectionTitle: any = sectionType;

    let tooltip: string = translation.type;

    if (isShowMultipleTranslations) {
      if (isPreferredChinese()) {
        sectionTitle = sectionTitleMap.get(sectionTitle as TranslationType);
      }
      tooltip = "";
    }

    displayResult.push({
      type: sectionType,
      sectionTitle: sectionTitle,
      items: [
        {
          key: translation.text + i,
          title: translation.text,
          tooltip: tooltip,
          copyText: translation.text,
          phonetic: reformatResult.queryTextInfo.phonetic,
          examTypes: reformatResult.queryTextInfo.examTypes,
        },
      ],
    });

    if (!isShowMultipleTranslations) {
      break;
    }
  }

  let hasShowDetailsSectionTitle = false;
  let detailsSectionTitle = "Details";

  reformatResult.explanations?.forEach((explanation, i) => {
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

  const wfs = reformatResult.forms?.map((wfItem, idx) => {
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

  if (reformatResult.webTranslation) {
    const webResultKey = reformatResult.webTranslation?.key;
    const webResultValue = reformatResult.webTranslation.value.join("；");
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

  reformatResult.webPhrases?.forEach((phrase, i) => {
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

  // console.log("displayResult: ", JSON.stringify(displayResult));

  return displayResult;
}
