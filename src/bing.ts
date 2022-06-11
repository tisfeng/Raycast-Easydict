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
  const queryWordUrl = `https://cn.bing.com/dict/search?q=${encodeURI(word)}`;

  axios.get(queryWordUrl).then((response) => {
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

    // onclick = "javascript:BilingualDict.Click(this,'https://dictionary.blob.core.chinacloudapi.cn/media/audio/tom/8e/00/8E00A7C3C07F3A1E7B6706E266B8FC3B.mp3','akicon.png',false,'dictionaryvoiceid')"

    const onclick = $(".bigaud").first().attr("onclick");
    console.warn(`onclick: ${onclick}`);

    if (onclick) {
      const url = onclick.split("'")[1];
      console.warn(`url: ${url}`);

      const audioPath = getWordAudioPath(word);
      downloadWordAudio(url, audioPath, () => {
        playAudio(audioPath);
      });
    }
  });
}
