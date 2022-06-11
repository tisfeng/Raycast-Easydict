import * as cheerio from "cheerio";
import axios from "axios";
import { downloadWordAudio, getWordAudioPath, playAudio } from "./audio";

export function bingTranslate(word: string) {
  // https://cn.bing.com/dict/search?q=good
  const queryWordUrl = `https://cn.bing.com/dict/search?q=${encodeURI(word)}`;

  axios.get(queryWordUrl).then((response) => {
    console.warn(
      `=================== Bing Translate: ${word} ===================`
    );

    const html = response.data;
    parsePhonetic(html);
    parseExplains(html);
    parseForms(html);
    parsePhrase(html);

    const audioUrl = parseAudioUrl(html);
    if (audioUrl) {
      const audioPath = getWordAudioPath(word);
      downloadWordAudio(audioUrl, audioPath, () => {
        playAudio(audioPath);
      });
    }
  });
}

// parse word pronounce from html
export function parsePhonetic(html: string) {
  const $ = cheerio.load(html);

  let phonetic;
  const pronounceText = $(".hd_p1_1>.hd_prUS").text();
  if (pronounceText) {
    phonetic = pronounceText.split("[")[1].split("]")[0];
    console.warn(`phonetic: [${phonetic}]`);
  }

  return phonetic;
}

// parse word audio url from html
export function parseAudioUrl(html: string) {
  const $ = cheerio.load(html);

  // onclick = "javascript:BilingualDict.Click(this,'https://dictionary.blob.core.chinacloudapi.cn/media/audio/tom/8e/00/8E00A7C3C07F3A1E7B6706E266B8FC3B.mp3','akicon.png',false,'dictionaryvoiceid')"

  const onclick = $(".bigaud").first().attr("onclick");
  let audioUrl;
  if (onclick) {
    audioUrl = onclick.split("'")[1];
  }
  return audioUrl;
}

// parse word expains from html
export function parseExplains(html: string) {
  const $ = cheerio.load(html);

  let data = [];
  for (const element of $(".qdef>ul>li")) {
    const part = $(element).find(".pos").text();
    const meam = $(element).find(".def").text();
    const partMean = `${part} ${meam}`;

    data.push(partMean);
    console.warn(partMean);
  }
  return data;
}

// parse word forms from html
export function parseForms(html: string) {
  const $ = cheerio.load(html);
  const fomrs = $(".hd_div1>.hd_if").text();
  if (fomrs) {
    console.warn(`forms: ${fomrs}`);
  }
  return fomrs;
}

// parse word pharase from html, class="dis, class="se_lis"
export function parsePhrase(html: string) {
  const $ = cheerio.load(html);
  const titles = $(".dis", "#pos_0").map((i, element) => {
    return $(".bil_dis", element).text() + " " + $(".val_dis", element).text();
  });
  const subtitles = $(".se_lis", "#pos_0").map((i, element) => {
    return (
      $(".se_d", element).text() +
      " " +
      $(".bil", element).text() +
      "；" +
      $(".val", element).text()
    );
  });

  if (titles.length) {
    console.log("");
    console.warn(`------------------ phrase ------------------`);
  }

  for (let i = 0; i < titles.length; i++) {
    console.log("\n");
    console.warn(`${titles[i]}`);
    console.warn(`${subtitles[i]}`);
  }

  return titles.map((i, element) => {
    `${titles[i]} ${subtitles[i]}`;
  });
}

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
