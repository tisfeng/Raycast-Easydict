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

export const LANGUAGE_LIST: LanguageItem[] = [
  {
    languageId: "zh-CHS",
    baiduLanguageId: "zh",
    caiyunLanguageId: "zh",

    googleLanguageId: "zh-CN",
    languageVoice: ["Ting-Ting"],
    languageTitle: "Chinese-Simplified",
  },
  {
    languageId: "zh-CHT",
    baiduLanguageId: "cht",
    googleLanguageId: "zh-TW",
    languageVoice: ["Ting-Ting"],
    languageTitle: "Chinese-Traditional",
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
    caiyunLanguageId: "ja",
    languageTitle: "Japanese",
    languageVoice: ["Kyoko"],
  },
  {
    languageId: "ko",
    languageTitle: "Korean",
    languageVoice: ["Yuna"],
  },
  {
    languageId: "fr",
    languageTitle: "French",
    languageVoice: ["Amelie", "Thomas"],
  },
  {
    languageId: "es",
    languageTitle: "Spanish",
    languageVoice: ["Jorge", "Juan", "Diego", "Monica", "Paulina"],
  },
  {
    languageId: "pt",
    languageTitle: "Portuguese",
    languageVoice: ["Joana", "Luciana"],
  },
  {
    languageId: "it",
    languageTitle: "Italian",
    languageVoice: ["Alice", "Luca"],
  },
  {
    languageId: "ru",
    languageTitle: "Russian",
    languageVoice: ["Milena", "Yuri"],
  },
  {
    languageId: "de",
    languageTitle: "German",
    languageVoice: ["Anna"],
  },
  {
    languageId: "ar",
    languageTitle: "Arabic",
    languageVoice: ["Maged"],
  },
  {
    languageId: "sv",
    languageTitle: "Swedish",
    languageVoice: ["Alva"],
  },
  {
    languageId: "he",
    googleLanguageId: "iw",
    languageTitle: "Hebrew",
    languageVoice: ["Carmit"],
  },
  {
    languageId: "id",
    languageTitle: "Indonesian",
    languageVoice: ["Damayanti"],
  },
  {
    languageId: "nl",
    languageTitle: "Dutch",
    languageVoice: ["Ellen", "Xander"],
  },
  {
    languageId: "ro",
    languageTitle: "Romanian",
    languageVoice: ["Ioana"],
  },
  {
    languageId: "th",
    languageTitle: "Thai",
    languageVoice: ["Kanya"],
  },
  {
    languageId: "sk",
    languageTitle: "Slovak",
    languageVoice: ["Laura"],
  },
  {
    languageId: "hi",
    languageTitle: "Hindi",
    languageVoice: ["Lekha"],
  },
  {
    languageId: "hu",
    languageTitle: "Hungarian",
    languageVoice: ["Mariska"],
  },
  {
    languageId: "el",
    languageTitle: "Greek",
    languageVoice: ["Melina"],
  },
  {
    languageId: "da",
    languageTitle: "Danish",
    languageVoice: ["Sara"],
  },
  {
    languageId: "fi",
    languageTitle: "Finnish",
    languageVoice: ["Satu"],
  },
  {
    languageId: "tr",
    languageTitle: "Turkish",
    languageVoice: ["Yelda"],
  },
  {
    languageId: "pl",
    languageTitle: "Polish",
    languageVoice: ["Zosia"],
  },
  {
    languageId: "cs",
    languageTitle: "Czech",
    languageVoice: ["Zuzana"],
  },
];
