import { environment } from "@raycast/api";
import { exec, execFile } from "child_process";
import axios from "axios";
import fs from "fs";
import { languageItemList } from "./consts";
import playerImport = require("play-sound");
const player = playerImport({});

export const maxPlaySoundTextLength = 40;
const audioDirPath = `${environment.supportPath}/audio`;

// use play-sound to play local audio file, use say command when audio not exist. if error, use say command to play.
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

// use shell afplay to play audio
export function playAudioPath(audioPath: string) {
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

export function sayTruncateCommand(text: string, language: string) {
  const truncateText = text.substring(0, maxPlaySoundTextLength) + "...";
  sayCommand(truncateText, language);
}

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

export function downloadWordAudioWithURL(word: string, url: string, callback?: () => void) {
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback);
}

export function downloadAudio(url: string, audioPath: string, callback?: () => void) {
  if (fs.existsSync(audioPath)) {
    callback && callback();
    return;
  }

  axios({
    method: "get",
    url: url,
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(
        fs.createWriteStream(audioPath).on(
          "close",
          callback
            ? callback
            : () => {
                // do nothing
              }
        )
      );
    })
    .catch((error) => {
      console.error(`download url audio error: ${error}`);
    });
}

// function: get audio file name, if audio directory is empty, create it
export function getWordAudioPath(word: string) {
  if (!fs.existsSync(audioDirPath)) {
    fs.mkdirSync(audioDirPath);
  }
  return `${audioDirPath}/${word}.mp3`;
}
