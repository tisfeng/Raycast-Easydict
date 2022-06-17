import { downloadAudio, getWordAudioPath } from "../../audio";

// Web API from:  https://cloud.tencent.com/developer/article/1596467
export function downloadYoudaoWordAudio(word: string, callback?: () => void) {
  const url = `https://dict.youdao.com/dictvoice?type=0&audio=${encodeURI(
    word
  )}`;

  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback);
}
