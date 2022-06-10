import * as cheerio from "cheerio";
import { environment } from "@raycast/api";
import { execFile } from "child_process";
import axios from "axios";
import fs from "fs";

// var fs = require("fs");

/**
<ul id="fruits">
  <li class="apple">Apple</li>
  <li class="orange">Orange</li>
  <li class="pear">Pear</li>
</ul>

$('.apple', '#fruits').text()
//=> Apple

$('ul .pear').attr('class')
//=> pear

$('li[class=orange]').html()
//=> Orange
 */

// good
export function bingTranslate(word: string) {
  const queryWordUrl = `https://cn.bing.com/dict/search?q=${encodeURI(word)}`;

  axios.get(queryWordUrl).then((response) => {
    console.log(`data: ${response.data}`);

    const $ = cheerio.load(response.data);

    const pronounceText = $(".hd_p1_1>.hd_prUS").text();
    console.warn(`pronounce: ${pronounceText}`);

    const pronounceElement = $(".hd_p1_1>.hd_tf:first");
    console.log(`pronounceElement: ${pronounceElement}`);

    let data = [];
    for (const element of $(".qdef>ul>li")) {
      const part = $(element).find(".pos").text();
      const meam = $(element).find(".def").text();
      const partMean = `${part} ${meam}`;

      data.push(partMean);
      console.warn(partMean);
    }

    const fomrs = $(".hd_div1>.hd_if").text();
    console.warn(`forms: ${fomrs}`);

    let title = $(".hd_p1_1").find(".hd_tf").first().attr("class");
    console.warn(`title: ${title}`);

    // onClick = "javascript:BilingualDict.Click(this,'https://dictionary.blob.core.chinacloudapi.cn/media/audio/tom/8e/00/8E00A7C3C07F3A1E7B6706E266B8FC3B.mp3','akicon.png',false,'dictionaryvoiceid')"

    const onClick = $(".bigaud").first().attr("onclick");
    console.warn(`onClick: ${onClick}`);

    if (onClick) {
      const url = onClick.split("'")[1];
      console.warn(`url: ${url}`);

      const audioPath = getWordAudioPath(word);

      downloadWordAudio(url, audioPath, () => {
        playAudio(audioPath);
      });
    }
  });
}

export function playAudio(audioPath: string) {
  console.log(`play audio file: ${audioPath}`);
  execFile("afplay", [audioPath]);
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

function downloadWordAudio(
  url: string,
  audioPath: string,
  callback: () => void
) {
  if (fs.existsSync(audioPath)) {
    console.log(`audio file already exists: ${audioPath}`);
    callback();
    return;
  }

  console.log(`download url audio: ${url}`);
  axios({
    method: "get",
    url: url,
    responseType: "stream",
  })
    .then((response) => {
      response.data.pipe(fs.createWriteStream(audioPath).on("close", callback));
    })
    .catch((error) => {
      console.error(error);
    });
}
