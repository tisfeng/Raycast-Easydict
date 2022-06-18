import {
  downloadAudio,
  downloadWordAudioWithURL,
  getWordAudioPath,
} from "../../audio";
import { QueryWordInfo } from "../../types";

/**
download word audio file. if query text is a word, download audio file from youdao wild api, otherwise download from youdao tts.
 */
export function downloadYoudaoAudio(
  queryWordInfo: QueryWordInfo,
  callback?: () => void
) {
  if (queryWordInfo.word) {
    downloadYoudaoWordAudio(queryWordInfo.word, callback);
  } else {
    downloadWordAudioWithURL(
      queryWordInfo.word,
      queryWordInfo.speechUrl,
      callback
    );
  }
}

/**
Note: this function is used to download word audio file from youdao, if not a word, the pronunciation audio is not accurate.
this is a wild web API from https://cloud.tencent.com/developer/article/1596467 , also can find in web https://dict.youdao.com/w/good
example https://dict.youdao.com/dictvoice?type=0&audio=good
 */
export function downloadYoudaoWordAudio(word: string, callback?: () => void) {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURI(
    word
  )}`;
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback);
}
