import {
  downloadWordAudio,
  getWordAudioPath,
  playAudioPath,
} from "../../audio";
import { icibaDictionary } from "../../request";
import { IcibaDictionaryResult } from "./interface";

// function download icicba audio file
export async function downloadIcibaWordAudio(
  word: string,
  callback?: () => void
) {
  try {
    const icibaResult = await icibaDictionary(word);
    const icibaDictionaryResult = icibaResult.result as IcibaDictionaryResult;
    const symbol = icibaDictionaryResult.symbols[0];
    const phoneticUrl = symbol.ph_am_mp3.length
      ? symbol.ph_am_mp3
      : symbol.ph_tts_mp3.length
      ? symbol.ph_tts_mp3
      : symbol.ph_en_mp3;
    if (phoneticUrl.length) {
      const audioPath = getWordAudioPath(word);
      downloadWordAudio(phoneticUrl, audioPath, callback);
    }

    console.log(
      `iciba dictionary result: ${JSON.stringify(
        icibaDictionaryResult,
        null,
        4
      )}`
    );
  } catch (error) {
    console.error(error);
  }
}
