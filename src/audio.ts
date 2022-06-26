/*
 * @author: tisfeng
 * @createTime: 2022-06-22 16:22
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-26 18:08
 * @fileName: audio.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment } from "@raycast/api";
import { exec, execFile } from "child_process";
import axios from "axios";
import fs from "fs";
import { languageItemList } from "./consts";
import playerImport = require("play-sound");
const player = playerImport({});

export const maxPlaySoundTextLength = 40;
const audioDirPath = `${environment.supportPath}/audio`;

/**
  use play-sound to play local audio file, use say command when audio not exist. if error, use say command to play.
*/
export function playWordAudio(word: string, fromLanguage: string, useSayCommand = true) {
  const audioPath = getWordAudioPath(word);
  if (!fs.existsSync(audioPath)) {
    console.warn(`audio file not found: ${audioPath}`);

    if (useSayCommand) {
      sayTruncateCommand(word, fromLanguage);
    }

    return;
  }

  player.play(audioPath, (err) => {
    if (err) {
      // afplay play the word 'set' throw error: Fail: AudioFileOpenURL failed ???
      console.error(`play word audio error: ${err}`);
      console.log(`audioPath: ${audioPath}`);

      sayTruncateCommand(word, fromLanguage);
    }
  });
}

/**
  use shell afplay to play audio
*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function afplayAudioPath(audioPath: string) {
  console.log(`play audio: ${audioPath}`);
  if (!fs.existsSync(audioPath)) {
    console.error(`audio file not exists: ${audioPath}`);
    return;
  }
  execFile("afplay", [audioPath], (error, stdout) => {
    if (error) {
      console.error(`exec error: ${error}`);
    }
    console.log(stdout);
  });
}

/**
  use shell say to play text sound, if text is too long, truncate it.
  */
export function sayTruncateCommand(text: string, language: string) {
  const truncateText = text.substring(0, maxPlaySoundTextLength) + "...";
  sayCommand(truncateText, language);
}

/**
  use shell say to play text sound
*/
function sayCommand(text: string, language: string) {
  if (language && text) {
    const voiceIndex = 0;
    for (const LANG of languageItemList) {
      if (language === LANG.youdaoLanguageId) {
        const safeText = text.replace(/"/g, " ");
        const sayCommand = `say -v ${LANG.languageVoice[voiceIndex]} '${safeText}'`;
        console.log(sayCommand);
        LANG.languageVoice.length > 0 && exec(sayCommand);
      }
    }
  }
}

export function downloadWordAudioWithURL(word: string, url: string, callback?: () => void): void {
  const audioPath = getWordAudioPath(word); // * @param {string} word
  downloadAudio(url, audioPath, callback);
}

export async function downloadAudio(url: string, audioPath: string, callback?: () => void) {
  if (fs.existsSync(audioPath)) {
    callback && callback();
    return;
  }

  try {
    const response = await axios.get(url, { responseType: "stream" });
    const fileStream = fs.createWriteStream(audioPath);
    response.data.pipe(fileStream);
    fileStream.on("finish", () => {
      fileStream.close();
      callback && callback();
    });
  } catch (error) {
    console.error(`download url audio error: ${error}`);
  }
}

/**
  get audio file name, if audio directory is empty, create it
*/
export function getWordAudioPath(word: string) {
  if (!fs.existsSync(audioDirPath)) {
    fs.mkdirSync(audioDirPath);
  }
  return `${audioDirPath}/${word}.mp3`;
}
