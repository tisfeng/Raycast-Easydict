import { SectionType, TranslationType } from "./consts";

export interface YoudaoTranslateResult {
  l: string;
  query: string;
  returnPhrase: [];
  errorCode: string;
  translation: string[];
  web?: YoudaoTranslateResultWebItem[];
  basic?: YoudaoTranslateResultBasicItem;
}

export interface YoudaoTranslateReformatResult {
  type: SectionType;
  children?: YoudaoTranslateReformatResultItem[];
}

export interface YoudaoTranslateReformatResultItem {
  key: string;
  title: string;
  copyText: string;
  subtitle?: string;
  phonetic?: string;
  examTypes?: string[];
}

export interface YoudaoTranslateResultWebItem {
  key: string;
  value: string[];
}

export interface YoudaoTranslateResultBasicItem {
  explains: string[];
  phonetic?: string;
  "us-phonetic": string;
  "uk-phonetic": string;
  exam_type?: string[];
  wfs?: YoudaoTranslateResultBasicWfsItem[];
}

export interface YoudaoTranslateResultBasicWfsItem {
  wf?: YoudaoTranslateResultBasicWfItem;
}

export interface YoudaoTranslateResultBasicWfItem {
  name: string;
  value: string;
}
export interface IPreferences {
  language1: string;
  language2: string;
  appId: string;
  appKey: string;
  isAutomaticQueryClipboard: boolean;
  isDisplayTargetTranslationLanguage: boolean;
}

export interface IListItemActionPanelItem {
  isInstalledEudic: Boolean;
  copyText?: string;
  queryText?: string;
  currentFromLanguage?: ILanguageListItem;
  currentTargetLanguage?: ILanguageListItem;
  onLanguageUpdate: (language: ILanguageListItem) => void;
}

export interface ILanguageListItem {
  languageId: string;
  baiduLanguageId?: string;
  caiyunLanguageId?: string;
  languageTitle: string;
  languageVoice: string[];
  googleLanguageId?: string;
}


export interface BaiduTranslateResult {
  from: string;
  to: string;
  trans_result: BaiduTranslateItem[]
}
export interface BaiduTranslateItem {
  src: string;
  dst: string;
}


export interface CaiyunTranslateResult {
  rc: string;
  target: string;
  confidence: number;
}


export interface TranslateResult {
  from: string;
  to: string;
  query: string;
  returnPhrase: [];
  errorCode: string;
  translation: TranslateResultItem[];
  web?: YoudaoTranslateResultWebItem[];
  basic?: YoudaoTranslateResultBasicItem;
}

export interface TranslateResultItem {
  type: TranslationType;
  translationText: string;
}
