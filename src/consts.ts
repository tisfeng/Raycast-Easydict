import { LanguageItem, RequestErrorInfo } from "./types";

export enum SectionType {
  Translation = "Translate",
  Explanations = "Explanation",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
}

export enum TranslationType {
  Youdao = "Youdao Translate",
  Baidu = "Baidu Translate",
  Caiyun = "Caiyun Translate",
}

export enum YoudaoRequestStateCode {
  Success = "0",
  AccessFrequencyLimited = "207",
  InsufficientAccountBalance = "401",
  TargetLanguageNotSupported = "102",
}

// https://fanyi-api.baidu.com/doc/21
export enum BaiduRequestStateCode {
  Success = "52000",
  AccessFrequencyLimited = "54003",
  InsufficientAccountBalance = "54004",
  TargetLanguageNotSupported = "58001",
}

export const requestStateCodeLinkMap = new Map([
  [TranslationType.Youdao, "https://ai.youdao.com/DOCSIRMA/html/%E8%87%AA%E7%84%B6%E8%AF%AD%E8%A8%80%E7%BF%BB%E8%AF%91/API%E6%96%87%E6%A1%A3/%E6%96%87%E6%9C%AC%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1/%E6%96%87%E6%9C%AC%E7%BF%BB%E8%AF%91%E6%9C%8D%E5%8A%A1-API%E6%96%87%E6%A1%A3.html#section-11"],
  [TranslationType.Baidu, "https://fanyi-api.baidu.com/doc/21"],
])

export const youdaoErrorList: RequestErrorInfo[] = [
  {
    errorCode: YoudaoRequestStateCode.Success,
    errorMessage: "Success",
  },
  {
    errorCode: YoudaoRequestStateCode.AccessFrequencyLimited,
    errorMessage: "Access frequency limited",
  },
  {
    errorCode: YoudaoRequestStateCode.InsufficientAccountBalance,
    errorMessage: "Insufficient account balance",
  },
  {
    errorCode: YoudaoRequestStateCode.TargetLanguageNotSupported,
    errorMessage: "Target language not supported",
  },
]

export function getYoudaoErrorInfo(errorCode: string): RequestErrorInfo {
  return youdaoErrorList.find(item => item.errorCode === errorCode) || {
    errorCode,
    errorMessage: "Unknown error",
  }
}

export const baiduErrorList: RequestErrorInfo[] = [
  {
    errorCode: BaiduRequestStateCode.Success,
    errorMessage: "Success",
  },
  {
    errorCode: BaiduRequestStateCode.AccessFrequencyLimited,
    errorMessage: "Access frequency limited",
  },
  {
    errorCode: BaiduRequestStateCode.InsufficientAccountBalance,
    errorMessage: "Insufficient account balance",
  },
  {
    errorCode: BaiduRequestStateCode.TargetLanguageNotSupported,
    errorMessage: "Target language not supported",
  },
]

export function getBaiduErrorInfo(errorCode: string): RequestErrorInfo {
  return baiduErrorList.find(item => item.errorCode === errorCode) || {
    errorCode,
    errorMessage: "Unknown error",
  }
}


export const LANGUAGE_LIST: LanguageItem[] = [
  {
    languageId: "auto",
    baiduLanguageId: "auto",
    caiyunLanguageId: "auto",
    googleLanguageId: "auto",
    languageTitle: "Auto Language",
    languageVoice: ["Ting-Ting"],
  },
  {
    languageId: "zh-CHS",
    baiduLanguageId: "zh",
    caiyunLanguageId: "zh",
    googleLanguageId: "zh-CN",
    languageTitle: "Chinese-Simplified",
    languageVoice: ["Ting-Ting"],
  },
  {
    languageId: "zh-CHT",
    baiduLanguageId: "cht",
    caiyunLanguageId: "zh",
    googleLanguageId: "zh-TW",
    languageTitle: "Chinese-Traditional",
    languageVoice: ["Ting-Ting"],
  },
  {
    languageId: "en",
    baiduLanguageId: "en",
    caiyunLanguageId: "en",
    languageTitle: "English",
    languageVoice: [
      "Samantha",
      "Alex",
      "Fred",
      "Victoria",
      "Daniel",
      "Karen",
      "Moira",
      "Rishi",
      "Tessa",
      "Veena",
      "Fiona",
    ],
  },
  {
    languageId: "ja",
    baiduLanguageId: "jp",
    caiyunLanguageId: "ja",
    languageTitle: "Japanese",
    languageVoice: ["Kyoko"],
  },
  {
    languageId: "ko",
    baiduLanguageId: "kor",
    languageTitle: "Korean",
    languageVoice: ["Yuna"],
  },
  {
    languageId: "fr",
    baiduLanguageId: "fra",
    languageTitle: "French",
    languageVoice: ["Amelie", "Thomas"],
  },
  {
    languageId: "es",
    baiduLanguageId: "spa",
    languageTitle: "Spanish",
    languageVoice: ["Jorge", "Juan", "Diego", "Monica", "Paulina"],
  },
  {
    languageId: "pt",
    baiduLanguageId: "pt",
    languageTitle: "Portuguese",
    languageVoice: ["Joana", "Luciana"],
  },
  {
    languageId: "it",
    baiduLanguageId: "it",
    languageTitle: "Italian",
    languageVoice: ["Alice", "Luca"],
  },
  {
    languageId: "ru",
    baiduLanguageId: "ru",
    languageTitle: "Russian",
    languageVoice: ["Milena", "Yuri"],
  },
  {
    languageId: "de",
    baiduLanguageId: "de	",
    languageTitle: "German",
    languageVoice: ["Anna"],
  },
  {
    languageId: "ar",
    baiduLanguageId: "ara",
    languageTitle: "Arabic",
    languageVoice: ["Maged"],
  },
  {
    languageId: "sv",
    baiduLanguageId: "swe",
    languageTitle: "Swedish",
    languageVoice: ["Alva"],
  },
  {
    languageId: "nl",
    baiduLanguageId: "nl",
    languageTitle: "Dutch",
    languageVoice: ["Ellen", "Xander"],
  },
  {
    languageId: "ro",
    baiduLanguageId: "rom",
    languageTitle: "Romanian",
    languageVoice: ["Ioana"],
  },
  {
    languageId: "th",
    baiduLanguageId: "th",
    languageTitle: "Thai",
    languageVoice: ["Kanya"],
  },
  {
    languageId: "sk",
    baiduLanguageId: "slo",
    languageTitle: "Slovak",
    languageVoice: ["Laura"],
  },
  {
    languageId: "hu",
    baiduLanguageId: "hu",
    languageTitle: "Hungarian",
    languageVoice: ["Mariska"],
  },
  {
    languageId: "el",
    baiduLanguageId: "el",
    languageTitle: "Greek",
    languageVoice: ["Melina"],
  },
  {
    languageId: "da",
    baiduLanguageId: "dan",
    languageTitle: "Danish",
    languageVoice: ["Sara"],
  },
  {
    languageId: "fi",
    baiduLanguageId: "fin",
    languageTitle: "Finnish",
    languageVoice: ["Satu"],
  },
  {
    languageId: "pl",
    baiduLanguageId: "pl",
    languageTitle: "Polish",
    languageVoice: ["Zosia"],
  },
  {
    languageId: "cs",
    baiduLanguageId: "cs",
    languageTitle: "Czech",
    languageVoice: ["Zuzana"],
  },
];
