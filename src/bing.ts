import * as cheerio from "cheerio";
import axios from "axios";
import { downloadWordAudio, getWordAudioPath, playAudio } from "./audio";

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

export function bingTranslate(word: string) {
  // https://cn.bing.com/dict/search?q=good
  const queryWordUrl = `https://cn.bing.com/dict/search?q=${encodeURI(word)}`;

  axios.get(queryWordUrl).then((response) => {
    console.warn(
      `//=================== Bing Translate: ${word} ===================//`
    );

    const html = response.data;
    const [phonetic, phoneticUrl] = parsePhonetic(html);

    parseExplains(html);
    parseForms(html);

    if (phoneticUrl) {
      const audioPath = getWordAudioPath(word);
      downloadWordAudio(phoneticUrl, audioPath, () => {
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
    console.warn(`phonetic: ${phonetic}`);
  }

  // onclick = "javascript:BilingualDict.Click(this,'https://dictionary.blob.core.chinacloudapi.cn/media/audio/tom/8e/00/8E00A7C3C07F3A1E7B6706E266B8FC3B.mp3','akicon.png',false,'dictionaryvoiceid')"

  const onclick = $(".bigaud").first().attr("onclick");
  let phoneticUrl;
  if (onclick) {
    phoneticUrl = onclick.split("'")[1];
  }

  return [phonetic, phoneticUrl];
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
  console.warn(`forms: ${fomrs}`);
  return fomrs;
}
