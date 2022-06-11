import { environment } from "@raycast/api";
import axios from "axios";
import { execFile } from "child_process";
import fs from "fs";

let audioPath = `${environment.supportPath}/audio`;
console.log(`audioPath: ${audioPath}`);

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

export function downloadWordAudio(
  url: string,
  audioPath: string,
  callback?: () => void
) {
  if (fs.existsSync(audioPath)) {
    console.log(`audio file already exists: ${audioPath}`);
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
        fs
          .createWriteStream(audioPath)
          .on("close", callback ? callback : () => {})
      );
    })
    .catch((error) => {
      console.error(error);
    });
}

// function: get audio file name, if audio directory is empty, create it
export function getWordAudioPath(word: string) {
  const audioPath = `${environment.supportPath}/audio/${word}.mp3`;
  if (!fs.existsSync(environment.supportPath)) {
    console.log(`create directory: ${environment.supportPath}`);
    fs.mkdirSync(`${environment.supportPath}/audio`);
  }
  return `${environment.supportPath}/audio/${word}.mp3`;
}
