import { LanguageItem } from "./types";

export enum SectionType {
  Translation = "Translate",
  Explains = "Explains",
  Detail = "Details",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
}

export enum TranslationType {
  Youdao = "Youdao Translate",
  Baidu = "Baidu Translate",
  Caiyun = "Caiyun Translate",

  YoudaoZh = "有道翻译",
  BaiduZh = "百度翻译",
  CaiyunZh = "彩云小译",
}

// https://fanyi-api.baidu.com/doc/21
export enum BaiduRequestErrorCode {
  Success = "52000",
  AccessFrequencyLimited = "54003",
  InsufficientAccountBalance = "54004",
  TargetLanguageNotSupported = "58001",
}

export enum YoudaoRequestErrorCode {
  Success = "0",
  AccessFrequencyLimited = "207",
  InsufficientAccountBalance = "401",
  TargetLanguageNotSupported = "102",
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
