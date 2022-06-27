/*
 * @author: tisfeng
 * @createTime: 2022-06-22 16:22
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-06-27 13:07
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

/**
 * Max length of text to play sound, to avoid play sound too long that can't be stoped.
 */
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
      console.error(`afplay error: ${error}`);
    }
    console.log(`afplay stdout: ${stdout}`);
  });
}

/**
  use shell say to play text sound, if text is too long, truncate it.
  */
export function sayTruncateCommand(text: string, youdaoLanguageId: string) {
  if (text.length > maxPlaySoundTextLength) {
    text = text.substring(0, maxPlaySoundTextLength) + "...";
  }
  sayCommand(text, youdaoLanguageId);
}

/**
  use shell say to play text sound
*/
function sayCommand(text: string, youdaoLanguageId: string) {
  if (youdaoLanguageId && text) {
    const languageItem = languageItemList.find((languageItem) => languageItem.youdaoLanguageId === youdaoLanguageId);
    if (!languageItem || !languageItem.voiceList) {
      console.warn(`say command language not supported: ${youdaoLanguageId}`);
      return;
    }

    // replace " with blank space, otherwise say command will not work.
    text = text.replace(/"/g, " ");
    const voice = languageItem.voiceList[0];
    const sayCommand = `say -v ${voice} "${text}"`; // you're so beautiful, my "unfair" girl
    console.log(sayCommand);
    exec(sayCommand, (error, stdout) => {
      if (error) {
        console.error(`sayCommand error: ${error}`);
      }
      console.log(`sayCommand stdout: ${stdout}`);
    });
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
    console.error(`download url audio error: ${error}, url: ${url}`);
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
