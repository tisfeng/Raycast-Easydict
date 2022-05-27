import axios from "axios";
import crypto from "crypto";
import querystring from "node:querystring";
import { getPreferenceValues } from "@raycast/api";
import { LANGUAGE_LIST, SectionType } from "./consts";

import {
  ILanguageListItem,
  IPreferences,
  IReformatTranslateResult,
  YoudaoTranslateReformatResult,
  YoudaoTranslateResult,
} from "./types";

export function truncate(string: string, length = 40, separator = "...") {
  if (string.length <= length) return string;
  return string.substring(0, length) + separator;
}

export function getItemFromLanguageList(value: string): ILanguageListItem {
  for (const langItem of LANGUAGE_LIST) {
    if (langItem.languageId === value) {
      return langItem;
    }
  }

  return {
    languageId: "",
    languageTitle: "",
    languageVoice: [""],
  };
}

export function reformatTranslateResult(
  data: YoudaoTranslateResult
): YoudaoTranslateReformatResult[] {
  const reformatData: YoudaoTranslateReformatResult[] = [];

  reformatData.push({
    type: SectionType.Translation,
    children: data.translation?.map((text, idx) => {
      return {
        title: text,
        key: text + idx,
        copyText: text,
        phonetic: data.basic?.phonetic,
        examTypes: data.basic?.exam_type,
      };
    }),
  });

  // Delete repeated text item
  // 在有道结果中 Translation 目前观测虽然是数组，但只会返回length为1的结果，而且重复只是和explains[0]。
  if (data.basic?.explains && data?.translation) {
    data.basic?.explains[0] === data?.translation[0] &&
      data.basic.explains.shift();
  }

  reformatData.push({
    type: SectionType.Detail,
    children: data.basic?.explains?.map((text, idx) => {
      return { title: text, key: text + idx, copyText: text };
    }),
  });

  const wfs = data.basic?.wfs?.map((wfItem, idx) => {
    return wfItem.wf?.name + " " + wfItem.wf?.value;
  });

  // [ 复数 goods   比较级 better   最高级 best ]
  const wfsText = wfs?.join("   ") || "";
  if (wfsText.length) {
    reformatData.push({
      type: SectionType.Wfs,
      children: [
        {
          title: "",
          key: wfsText,
          subtitle: `[ ${wfsText} ]`,
          copyText: wfsText,
        },
      ],
    });
  }

  // good  好的；善；良好
  const webResults = data.web?.map((webResultItem, idx) => {
    const webResultKey = webResultItem.key;
    const webResultVaule = useSymbolSegmentationArrayText(webResultItem.value);
    return {
      type: idx === 0 ? SectionType.WebTranslation : SectionType.WebPhrase,
      children: [
        {
          title: webResultKey,
          key: webResultKey,
          subtitle: webResultVaule,
          copyText: `${webResultKey} ${webResultVaule}`,
        },
      ],
    };
  });

  webResults?.map((webResultItem) => {
    reformatData.push(webResultItem);
  });

  return reformatData;
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

  const preferences: IPreferences = getPreferenceValues();
  const APP_ID = preferences.appId;
  const APP_KEY = preferences.appKey;

  const sha256 = crypto.createHash("sha256");
  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const sha256Content =
    APP_ID + truncate(queryText) + salt + timestamp + APP_KEY;
  const sign = sha256.update(sha256Content).digest("hex");

  return axios.post(
    "https://openapi.youdao.com/api",
    querystring.stringify({
      sign,
      salt,
      from: fromLanguage,
      signType: "v3",
      q: queryText,
      appKey: APP_ID,
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
  const preferences: IPreferences = getPreferenceValues();
  const APP_ID = "20220428001194113";
  const APP_KEY = "kiaee1BtT9d2MGJUdAMi";

  const md5 = crypto.createHash("md5");
  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = APP_ID + queryText + salt + APP_KEY;
  const sign = md5.update(md5Content).digest("hex");

  const apiServer = "https://fanyi-api.baidu.com/api/trans/vip/translate";

  const from = getItemFromLanguageList(fromLanguage).baiduLanguageId;
  const to = getItemFromLanguageList(targetLanguage).baiduLanguageId;

  let url =
    apiServer +
    `?q=${encodeURI(
      queryText
    )}&from=${from}&to=${to}&appid=${APP_ID}&salt=${salt}&sign=${sign}`;
  return axios.get(url);

  const params = {
    q: encodeURI(queryText),
    from: from,
    to: to,
    salt: salt,
    appid: APP_ID,
    sign: sign,
  };
  return axios.get(url, { params });
}
