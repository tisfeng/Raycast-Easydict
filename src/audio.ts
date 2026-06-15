/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { timedFetch } from "@/fetchConfig";
import { ExecException } from "child_process";
import { execa } from "execa";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import playerImport from "play-sound";
import { languageItemList } from "@/language/consts";
import { printObject, trimTextLength } from "@/utils";
import { logTrace, logWarn, logError } from "@/devLog";

logTrace("audio", "module loaded");

const audioDirPath = `${environment.supportPath}/audio`;
logTrace("audio", `path: ${audioDirPath}`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let audioPlayer: any; // Play

/**
 * Use play-sound to play local audio file, use say command when audio not exist. if error, use say command to play.
 */
export async function playWordAudio(word: string, fromLanguage: string, useSayCommand = true) {
  let audioPath = getWordAudioPath(word);
  if (!fs.existsSync(audioPath)) {
    logTrace("audio", `file not found: ${word}`);
    if (useSayCommand) {
      sayTruncateCommand(word, fromLanguage);
    }
    return;
  }

  logTrace("audio", `play: ${path.basename(audioPath)}`);

  if (!audioPlayer) {
    // * Note: this new object will cost ~0.4s
    audioPlayer = playerImport({});
    logTrace("audio", "creating player instance");
  }

  // Because afplay can't play audio files with .mp3 suffix that are actually .wav, let's try to convert the format.
  if (await isWavFile(audioPath)) {
    const m4aFilePath = await tryConvertAudioToM4a(audioPath);
    if (m4aFilePath) {
      audioPath = m4aFilePath;
    }
  }

  // const audioPlayer = playerImport({});
  audioPlayer.play(audioPath, (err: ExecException) => {
    if (err) {
      if (err.killed) {
        logTrace("audio", "killed previous playback");
        return;
      }

      // afplay play the word 'set' throw error: Fail: AudioFileOpenURL failed ???
      logError("audio", `play word audio error: ${err}`);
      logTrace("audio", `path: ${encodeURI(audioPath)}`);
      sayTruncateCommand(word, fromLanguage);
    }
  });
}

/**
  Use shell say to play text sound, if text is too long that can't be stopped, so truncate it.
  */
export function sayTruncateCommand(text: string, youdaoLanguageId: string) {
  const truncateText = trimTextLength(text, 40);
  return sayCommand(truncateText, youdaoLanguageId);
}

/**
  use shell say to play text sound
*/
function sayCommand(text: string, youdaoLanguageId: string) {
  if (process.platform !== "darwin") {
    logWarn("audio", "Apple TTS only supported on macOS");
    return;
  }

  if (youdaoLanguageId && text) {
    const languageItem = languageItemList.find((languageItem) => languageItem.youdaoLangCode === youdaoLanguageId);
    if (!languageItem || !languageItem.voiceList) {
      logWarn("audio", `language not supported: ${youdaoLanguageId}`);
      return;
    }

    // replace " with blank space, otherwise say command will not work.
    text = text.replace(/"/g, " ");
    const voice = languageItem.voiceList[0]; // say -v Ting-Ting hello

    /**
     * Specify play rate, in words per minute. The default is?, seems has valid range.
     *
     * say -r 60 "hello"
     * say "[[rate 60]] hello"
     */
    logTrace("audio", `say -v ${voice} "${text}"`);

    execa("say", ["-v", voice, text]).catch((error) => {
      logError("audio", `sayCommand error: ${error}`);
    });
}

export function downloadWordAudioWithURL(
  word: string,
  url: string,
  callback?: () => void,
  forceDownload = false,
): void {
  logTrace("audio", `download: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}

/**
 * @param url the audio url to download
 * @param audioPath the path to store audio
 * @param callback callback when after download audio
 * @param forceDownload is forced download when audio has exist
 */
export async function downloadAudio(url: string, audioPath: string, callback?: () => void, forceDownload = false) {
  if (fs.existsSync(audioPath)) {
    if (!forceDownload) {
      const word = audioPath.substring(audioPath.lastIndexOf("/") + 1);
      logTrace("audio", `cached: ${word}`);
      callback?.();
      return;
    }
    logTrace("audio", `force download: ${audioPath}`);
  }
  logTrace("audio", `downloading: ${audioPath}`);

  timedFetch(url, {
    responseType: "blob",
  })
    .then(async (blob) => {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(audioPath, buffer);
      await tryConvertAudioToM4a(audioPath);
      callback?.();
    })
    .catch((error) => {
      if (error.message === "canceled" || error.name === "AbortError") {
        logTrace("audio", "download canceled");
        return;
      }
      logError("audio", `download failed`);
    });
}

/**
 * Get audio file name. If audio directory is empty, create it.
 */
export function getWordAudioPath(word: string) {
  if (!fs.existsSync(audioDirPath)) {
    fs.mkdirSync(audioDirPath);
  }

  const m4aFile = `${audioDirPath}/${word}.m4a`;
  if (fs.existsSync(m4aFile)) {
    return m4aFile;
  }

  const mp3File = `${audioDirPath}/${word}.mp3`;
  return mp3File;
}

/**
 * Try to convert wav file to m4a. eg: false
 */
async function tryConvertAudioToM4a(filePath: string) {
  if (await isWavFile(filePath)) {
    logWarn("audio", "downloaded format is wav, converting");
    // rename file extension from mp3 to wav
    const wavPath = filePath.replace(".mp3", ".wav");
    fs.renameSync(filePath, wavPath);

    // convert wav to m4a
    return convertWavToM4a(wavPath);
  }
}

/**
 * Check file extension is wav or not.
 */
async function isWavFile(filePath: string) {
  const fileType = await fileTypeFromFile(filePath);
  printObject(`fileType`, fileType, 0);
  // good: { "ext": "mp3", "mime": "audio/mpeg" }
  // false: { "ext": "wav", "mime": "audio/vnd.wave" }

  const ext = fileType?.ext;
  return ext === "wav";
}

/**
 * Use afconver to convert wav file to m4a file in the same directory, if success, remove wav file.
 *
 * * Because wav file is too large, so convert to m4a file, which can be reduced to 1/10 of the original size.
 */
export function convertWavToM4a(filePath: string): Promise<string> {
  logTrace("audio", "converting wav→m4a");

  if (process.platform !== "darwin") {
    logWarn("audio", "afconvert only on macOS");
    return Promise.resolve(filePath);
  }

  return new Promise((resolve, reject) => {
    const m4aFilePath = filePath.replace(".wav", ".m4a");

    execa("afconvert", ["-f", "m4af", "-d", "aac", filePath, m4aFilePath])
      .then(() => {
        logTrace("audio", "conversion complete");
        fs.unlinkSync(filePath);
        resolve(m4aFilePath);
      })
      .catch((error) => {
        logError("audio", `conversion failed`);
        reject(error);
      });
  });
}
