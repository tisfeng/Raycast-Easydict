/*
 * @author: tisfeng
 * @createTime: 2022-08-04 23:21
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-28 22:24
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LanguageDetectTypeResult } from "../../detectLanauge/types";

export interface YoudaoDictionaryFormatResult {
  queryWordInfo: QueryWordInfo;
  translation: string;
  explanations?: string[];
  forms?: WordForms[];
  webTranslation?: KeyValueItem;
  webPhrases?: KeyValueItem[];
}

export enum YoudaoDictionaryListItemType {
  Translation = "Translate",
  Explanation = "Explanation",
  Forms = "Forms and Tenses",
  WebTranslation = "Web Translation",
  WebPhrase = "Web Phrase",
}

export interface YoudaoDictionaryResult {
  l: string;
  query: string;
  returnPhrase: [];
  errorCode: string;
  translation: string[]; // ! do not change property name! current only has one translation.
  web?: KeyValueItem[];
  basic?: YoudaoTranslateResultBasicItem;
  isWord: boolean;
  speakUrl: string;
}

export type YoudaoTranslateResult = YoudaoDictionaryResult;

export interface QueryWordInfo {
  word: string;
  fromLanguage: string; // ! must be Youdao language id.
  toLanguage: string;
  isWord?: boolean; // * Dictionary Type should has value, show web url need this value.
  hasDictionaryEntries?: boolean; // it is true if the word has dictionary entries.
  detectedLanguage?: LanguageDetectTypeResult;
  phonetic?: string; // ɡʊd
  examTypes?: string[];
  audioPath?: string;
  speechUrl?: string; // word audio url. some language not have tts url, such as "ຂາດ"
  tld?: string; // google tld
}

export interface YoudaoTranslateResultBasicItem {
  explains: string[];
  "us-phonetic"?: string; // American phonetic
  "us-speech"?: string;
  phonetic?: string; // Chinese word phonetic
  exam_type?: string[];
  wfs?: WordForms[]; // word forms
}

export interface WordForms {
  wf?: WordForm;
}

export interface WordForm {
  name: string;
  value: string;
}

export interface KeyValueItem {
  key: string;
  value: string[];
}

/**
Youdao Web Translation.

eg:
{
  "errorCode": 0,
  "translateResult": [[{ "tgt": "壁虎", "src": "Gecko" }]],
  "type": "en2zh-CHS",
  "smartResult": { "entries": ["", "n. [脊椎] 壁虎\r\n"], "type": 1 }
}
*/
export interface YoudaoWebTranslateResult {
  errorCode: number;
  translateResult: [[{ tgt: string; src: string }]];
  type: string;
  smartResult: {
    entries: string[];
    type: number;
  };
}

//-----------------------Youdao web dictionary------------------------------

/**
 * Youdao web dictionary model.
 *
 * Ref: https://www.showdoc.com.cn/justapi/957479750776060#explain
 */
export interface YoudaoWebDictionaryModel {
  // English --> Chinese.
  auth_sents_part?: AuthSentsPart; // 权威例句
  baike?: Baike; // 百科
  blng_sents_part?: BlngSentsPart; // 双语例句
  collins?: Collins; // 柯林斯英汉双解大辞典
  collins_primary?: CollinsPrimary; // 柯林斯？
  discriminate?: Discriminate; // 辨析
  ec?: Ec; // 英汉词典
  ee?: Ee; // 英英词典
  etym?: Etym; // 词源
  expand_ec?: ExpandEc; // 英汉词典扩展
  individual?: Individual; // 独有，考试类
  input: string;
  lang: string; // 目标语言，eng。 eg: https://www.youdao.com/w/eng/good
  le: string; // 目标语言，en
  media_sents_part?: MediaSentsPart; // 原声例句
  meta: Meta; // 元数据
  oxford?: Oxford; // 牛津辞典
  oxfordAdvance?: OxfordAdvance; // 新版牛津辞典
  oxfordAdvanceHtml?: OxfordAdvanceHtml;
  phrs?: Phrs; // 词组短语
  rel_word?: RelWord; // 同根词
  senior?: Senior; // 高级？
  simple: Simple; // 简易词典
  special?: Special; // 专业释义
  syno?: SynoModal; // 同近义词
  video_sents?: VideoSents; // 视频例句
  web_trans?: WebTrans; // 网络释义
  webster?: Webster; // 韦氏词典
  word_video?: WordVideo; // 单词视频资料

  // Chinese --> English
  ce?: Ce; // （有道）汉英字典
  wuguanghua?: Wuguanghua; // 吴光华汉英大辞典
  ce_new?: CeNew; // 新汉英大辞典
  newhh?: Newhh; // 现代汉语规范词典
}

/**
 * 权威例句
 */
export interface AuthSentsPart {
  more: string;
  sent: AuthSentsPartSent[];
  "sentence-count": number;
}

export interface AuthSentsPartSent {
  foreign: string;
  score: number;
  source: string;
  speech: string;
  "speech-size": string;
  url: string;
}

export interface Baike {
  source?: BaikeSource;
  summarys?: SummaryElement[];
}

export interface BaikeSource {
  name: string;
  url: string;
}

export interface SummaryElement {
  key?: string;
  summary?: string;
}

export interface BlngSentsPart {
  more: string;
  "sentence-count": number;
  "sentence-pair": SentencePair[];
  "trs-classify": TrsClassify[];
}

export interface SentencePair {
  "aligned-words": AlignedWords;
  sentence: string;
  "sentence-eng": string;
  "sentence-speech": string;
  "sentence-translation": string;
  source: string;
  "speech-size": string;
  url: string;
}

export interface AlignedWords {
  src: Src;
  tran: AlignedWordsTran;
}

export interface Src {
  chars: SrcChar[];
}

export interface SrcChar {
  "@e": string;
  "@id": string;
  "@s": string;
  aligns: PurpleAligns;
}

export interface PurpleAligns {
  sc: PurpleSc[];
  tc: PurpleTc[];
}

export interface PurpleSc {
  "@id": string;
}

export interface PurpleTc {
  "@id": string;
}

export interface AlignedWordsTran {
  chars: TranChar[];
}

export interface TranChar {
  "@e": string;
  "@id": string;
  "@s": string;
  aligns: FluffyAligns;
}

export interface FluffyAligns {
  sc: FluffySc[];
  tc: FluffyTc[];
}

export interface FluffySc {
  "@id": string;
}

export interface FluffyTc {
  "@id": string;
}

export interface TrsClassify {
  proportion: string;
  tr: string;
}

export interface Collins {
  collins_entries: CollinsEntry[];
  super_headwords: SuperHeadwords;
}

export interface CollinsEntry {
  basic_entries: BasicEntries;
  entries: Entries;
  headword: string;
  phonetic: string;
  star: string;
  super_headword: string;
}

export interface BasicEntries {
  basic_entry: BasicEntry[];
}

export interface BasicEntry {
  cet?: string;
  headword: string;
  wordforms: Wordforms;
}

export interface Wordforms {
  wordform: Wordform[];
}

export interface Wordform {
  word: string;
}

export interface Entries {
  entry: EntriesEntry[];
}

export interface EntriesEntry {
  tran_entry: TranEntry[];
}

export interface TranEntry {
  box_extra: string;
  exam_sents: ExamSents;
  gram: string;
  headword: string;
  loc?: string;
  pos_entry: PosEntry;
  seeAlsos: SeeAlsos;
  sees: Sees;
  tran: string;
}

export interface ExamSents {
  sent: ExamSentsSent[];
}

export interface ExamSentsSent {
  chn_sent: string;
  eng_sent: string;
}

export interface PosEntry {
  pos: string;
  pos_tips: string;
}

export interface SeeAlsos {
  seealso: string;
  seeAlso: SeeAlso[];
}

export interface SeeAlso {
  seeword: string;
}

export interface Sees {
  see: See[];
}

export interface See {
  seeword: string;
}

export interface SuperHeadwords {
  super_headword: string[];
}

export interface CollinsPrimary {
  gramcat: Gramcat[];
  words: Words;
}

export interface Gramcat {
  audio: string;
  audiourl: string;
  forms: Form[];
  partofspeech: string;
  phrases?: Phrase[];
  pronunciation: string;
  senses: GramcatSense[];
}

export interface Form {
  form: string;
}

export interface Phrase {
  phrase: string;
  senses: PhraseSense[];
}

export interface PhraseSense {
  definition: string;
  examples: PurpleExample[];
  lang: string;
  word: string;
}

export interface PurpleExample {
  example: string;
  sense: PurpleSense;
}

export interface PurpleSense {
  lang: string;
  word: string;
}

export interface GramcatSense {
  definition: string;
  examples: FluffyExample[];
  labelgrammar?: string;
  lang: string;
  sensenumber: string;
  word: string;
}

export interface FluffyExample {
  example: string;
  sense: FluffySense;
}

export interface FluffySense {
  lang: string;
  word: string;
}

export interface Words {
  indexforms: string[];
  word: string;
}

export interface Discriminate {
  data: Datum[];
  "return-phrase": string;
}

export interface Datum {
  headwords?: string[];
  source?: string;
  usages?: DatumUsage[];
}

export interface DatumUsage {
  headword: string;
  usage: string;
}

export interface Ec {
  exam_type: string[];
  source: EcSource;
  special: SpecialElement[];
  web_trans: string[];
  word: EcWord;
}

export interface EcSource {
  name: string;
  url: string;
}

export interface SpecialElement {
  major: string;
  nat: string;
}

export interface EcWord {
  "return-phrase": string;
  trs: PurpleTr[];
  ukphone: string;
  ukspeech: string;
  usphone: string; // ɡʊd
  usspeech: string; // good&type=2
  wfs: WordForms[];
}

export interface PurpleTr {
  pos?: string;
  tran: string;
}

export interface Ee {
  source: EeSource;
  word: EeWord;
}

export interface EeSource {
  name: string;
  url: string;
}

export interface EeWord {
  phone: string;
  "return-phrase": string;
  speech: string;
  trs: FluffyTr[];
}

export interface FluffyTr {
  pos: string;
  tr: TentacledTr[];
}

export interface TentacledTr {
  examples: string[];
  "similar-words": string[];
  tran: string;
}

export interface Etym {
  etyms: Etyms;
  word: string;
}

export interface Etyms {
  zh: Zh[];
}

export interface Zh {
  desc: string;
  source: string;
  url: string;
  value: string;
  word: string;
}

export interface ExpandEc {
  "return-phrase": string;
  source: ExpandEcSource;
  word: ExpandEcWord[];
}

export interface ExpandEcSource {
  name: string;
  url: string;
}

export interface ExpandEcWord {
  pos: string;
  transList: TransList[];
  wfs: FluffyWf[];
}

export interface TransList {
  content: Content;
  trans: string;
}

export interface Content {
  detailPos: string;
  examType?: ExamType[];
  sents?: ContentSent[];
}

export interface ExamType {
  en: string;
  zh: string;
}

export interface ContentSent {
  sentOrig: string;
  sentSpeech: string;
  sentTrans: string;
  source: string;
  sourceType: string;
  type: string;
  usages: SentUsage[];
}

export interface SentUsage {
  phrase: string;
  phraseTrans: string;
}

export interface FluffyWf {
  name: string;
  value: string;
}

export interface Individual {
  examInfo: ExamInfo;
  idiomatic: Idiomatic[];
  level: string;
  pastExamSents: PastExamSent[];
  "return-phrase": string;
  trs: IndividualTr[];
}

export interface ExamInfo {
  frequency: number;
  questionTypeInfo: QuestionTypeInfo[];
  recommendationRate: number;
  year: number;
}

export interface QuestionTypeInfo {
  time: number;
  type: string;
}

export interface Idiomatic {
  colloc: Colloc;
}

export interface Colloc {
  en: string;
  zh: string;
}

export interface PastExamSent {
  en: string;
  source: string;
  zh: string;
}

export interface IndividualTr {
  pos?: string;
  tran?: string;
}

export interface MediaSentsPart {
  more: string;
  query: string;
  sent: Sent[];
  "sentence-count": number;
}

export interface Sent {
  "@mediatype": string;
  chn: string;
  eng: string;
  snippets: Snippets;
  "speech-size": string;
}

export interface Snippets {
  snippet: Snippet[];
}

export interface Snippet {
  duration: string;
  imageUrl: string;
  name: string;
  source: string;
  sourceUrl: string;
  streamUrl: string;
  swf: string;
  win8: string;
}

export interface Meta {
  dicts: string[];
  guessLanguage: string; // 自动识别查询单词语言，中文 zh，英语 eng
  input: string;
  isHasSimpleDict: string;
  lang: string;
  le: string;
}

export interface Oxford {
  encryptedData: string;
}

export interface OxfordAdvance {
  encryptedData: string;
}

export interface OxfordAdvanceHtml {
  encryptedData: string;
}

export interface Phrs {
  phrs: Phr[];
  word: string;
}

export interface Phr {
  headword: string;
  translation: string;
}

export interface RelWord {
  rels: RelElement[];
  stem: string;
  word: string;
}

export interface RelElement {
  rel: RelRel;
}

export interface RelRel {
  pos: string;
  words: RelWord[];
}

export interface RelWord {
  tran: string;
  word: string;
}

export interface Senior {
  encryptedData: string;
  source: SeniorSource;
}

export interface SeniorSource {
  name: string;
}

export interface Simple {
  query: string;
  word: SimpleWord[];
}

export interface SimpleWord {
  "return-phrase"?: string;
  ukphone?: string;
  ukspeech?: string;
  usphone?: string;
  usspeech?: string;
}

export interface Special {
  "co-add": string;
  entries: SpecialEntry[];
  summary: SpecialSummary;
  total: string;
}

export interface SpecialEntry {
  entry: EntryEntry;
}

export interface EntryEntry {
  major: string;
  num: number;
  trs: EntryTr[];
}

export interface EntryTr {
  tr: StickyTr;
}

export interface StickyTr {
  chnSent?: string;
  cite: string;
  docTitle?: string;
  engSent?: string;
  nat: string;
  url?: string;
}

export interface SpecialSummary {
  sources: Sources;
  text: string;
}

export interface Sources {
  source: SourcesSource;
}

export interface SourcesSource {
  site: string;
  url: string;
}

export interface SynoModal {
  synos: SynoElement[];
  word: string;
}

export interface SynoElement {
  pos: string;
  tran: string;
  ws: string[];
}

export interface VideoSents {
  sents_data: SentsDatum[];
  word_info: WordInfo;
}

export interface SentsDatum {
  contributor: string;
  id: number;
  subtitle_srt: string;
  video: string;
  video_cover: string;
}

export interface WordInfo {
  "return-phrase": string;
  sense: string[];
}

export interface Webster {
  encryptedData: string;
}

export interface WordVideo {
  word_videos: WordVideoElement[];
}

export interface WordVideoElement {
  ad?: Ad;
  video?: Video;
}

export interface Ad {
  avatar: string;
  title: string;
  url: string;
}

export interface Video {
  cover: string;
  image: string;
  title: string;
  url: string;
}

//----------------------------------------------------
/**
 * Chinese --> English
 *
 * Generated by https://quicktype.io
 */
export interface BlngSentsPart {
  "sentence-count": number;
  "sentence-pair": SentencePair[];
  more: string;
  "trs-classify": TrsClassify[];
}

export interface SentencePair {
  sentence: string;
  "sentence-translation-speech": string;
  "sentence-eng": string;
  "sentence-translation": string;
  "speech-size": string;
  "aligned-words": AlignedWords;
  source: string;
  url: string;
}

export interface AlignedWords {
  src: Src;
  tran: Src;
}

export interface Src {
  chars: Char[];
}

export interface Char {
  "@s": string;
  "@e": string;
  aligns: Aligns;
  "@id": string;
}

export interface Aligns {
  sc: Sc[];
  tc: Sc[];
}

export interface Sc {
  "@id": string;
}

export interface TrsClassify {
  proportion: string;
  tr: string;
}

export interface Ce {
  source: BaikeSource;
  word: CeWord;
}

export interface CeWord {
  trs: PurpleTr[];
  phone: string;
  "return-phrase": string;
}

export interface PurpleTr {
  voice: string;
  "#text": string;
  "#tran": string;
}

export interface CeNew {
  source: CeNewSource;
  word: CeNewWord[];
}

export interface CeNewSource {
  name: string;
}

export interface CeNewWord {
  trs: FluffyTr[];
  phone: string;
  "return-phrase": ReturnPhrase;
}

export interface ReturnPhrase {
  l: ReturnPhraseL;
}

export interface ReturnPhraseL {
  i: string[];
}

export interface FluffyTr {
  pos: string;
  tr: TentacledTr[];
}

export interface TentacledTr {
  exam?: Exam[];
  l: ReturnPhraseL;
}

export interface Exam {
  i: I;
}

export interface I {
  f: F;
  n: F;
}

export interface F {
  l: FL;
}

export interface FL {
  i: string;
}

export interface Snippets {
  snippet: Snippet[];
}

export interface Snippet {
  sourceUrl: string;
  streamUrl: string;
  swf: string;
  imageUrl: string;
  name: string;
  source: string;
}

export interface Meta {
  input: string;
  guessLanguage: string;
  isHasSimpleDict: string;
  le: string;
  lang: string;
  dicts: string[];
}

export interface Newhh {
  dataList: NewhhDataList[];
  source: CeNewSource;
  word: string;
}

export interface NewhhDataList {
  pinyin: string;
  sense: Sense[];
  word: string;
}

export interface Sense {
  examples?: string[];
  def: string[];
  cat: string;
  style?: string;
}

export interface Simple {
  query: string;
  word: SimpleWord[];
}

export interface Special {
  summary: SpecialSummary;
  "co-add": string;
  total: string;
  entries: EntryElement[];
}

export interface EntryElement {
  entry: EntryEntry;
}

export interface EntryEntry {
  major: string;
  trs: EntryTr[];
  num: number;
}

export interface EntryTr {
  tr: StickyTr;
}

export interface StickyTr {
  nat: string;
  chnSent?: string;
  cite: string;
  docTitle?: string;
  engSent?: string;
  url?: string;
}

export interface SpecialSummary {
  sources: Sources;
  text: string;
}

export interface Sources {
  source: SourcesSource;
}

export interface SourcesSource {
  site: string;
  url: string;
}

export interface WebTrans {
  "web-translation"?: WebTranslation[];
}

export interface WebTranslation {
  "@same"?: string;
  key: string;
  "key-speech": string;
  trans: Tran[];
}

export interface Tran {
  summary?: TranSummary;
  value: string;
  support?: number;
  url?: string;
  cls?: Cls;
}

export interface Cls {
  cl: string[];
}

export interface TranSummary {
  line: string[];
}

export interface Wuguanghua {
  dataList: WuguanghuaDataList[];
  source: CeNewSource;
  word: string;
}

export interface WuguanghuaDataList {
  trs: DataListTr[];
  phone: string;
  speech: string;
}

export interface DataListTr {
  pos: string;
  tr: SentElement;
  sents?: SentElement[];
  rhetoric?: string;
}

export interface SentElement {
  en: string;
  cn: string;
}
