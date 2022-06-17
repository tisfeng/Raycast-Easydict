import { environment } from "@raycast/api";
import axios from "axios";
import { execFile } from "child_process";
import fs from "fs";

let audioDirPath = `${environment.supportPath}/audio`;

// use shell afplay to play audio
export function playAudio(audioPath: string) {
  console.log(`play audio: ${audioPath}`);
  if (!fs.existsSync(audioPath)) {
    console.error(`audio file not exists: ${audioPath}`);
    return;
  }
  execFile("afplay", [audioPath], (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
    }
    console.log(stdout);
  });
}

export function playWordAudio(word: string) {
  const audioPath = getWordAudioPath(word);
  playAudio(audioPath);
}

export function downloadWordAudio(
  url: string,
  audioPath: string,
  callback?: () => void
) {
  if (fs.existsSync(audioPath)) {
    callback && callback();
    return;
  }

  console.log(`download url audio: ${url}`);
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
      console.error(error);
    });
}

// function: get audio file name, if audio directory is empty, create it
export function getWordAudioPath(word: string) {
  if (!fs.existsSync(audioDirPath)) {
    fs.mkdirSync(audioDirPath);
  }
  return `${audioDirPath}/${word}.mp3`;
}
