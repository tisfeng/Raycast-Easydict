/*
 * @author: tisfeng
 * @createTime: 2022-07-24 17:58
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-25 18:29
 * @fileName: linguee.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { environment } from "@raycast/api";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import * as htmlparser2 from "htmlparser2";
import { parse } from "node-html-parser";

const htmlPath = `${environment.supportPath}/linguee.html`;

export function rquestLingueeWord() {
  console.log("---> requesting linguee word");

  //  read html file async
  fs.readFile(htmlPath, "utf8", (err, data) => {
    if (err) {
      console.error(`read linguee html file error: ${err}`);
      return;
    }

    const dom = parse(data);
    const mainDom = dom.querySelector(".isMainTerm");
    const lemmas = mainDom?.querySelectorAll(".exact .lemma");
    lemmas?.map((lemma) => {
      const dictLink = lemma?.querySelector(".dictLink");
      const tag_wordtype = lemma?.querySelector(".tag_wordtype");
      const tag_lemma_context = lemma?.querySelector(".tag_lemma_context");
      console.warn(
        `--> ${dictLink?.textContent} ${tag_lemma_context?.textContent ?? ""} : ${tag_wordtype?.textContent}`
      );

      const translation_group = lemma?.querySelector(".translation_group");
      const lessCommonTranslations = translation_group?.querySelectorAll(".translation") as unknown as HTMLElement[];
      lessCommonTranslations.forEach((element) => {
        element.remove();
      });

      const translations = lemma?.querySelectorAll(".translation");
      iterateTranslationGroup(translations as unknown as HTMLElement[]);

      iterateTranslationGroup(lessCommonTranslations, WordFrequencey.LessCommon);
    });
  });
}
interface LingueeDictionary {
  word: string;
  type: string;
  explanations: LingueeWordExplanation[];
  lessCommonExplanations: LingueeWordExplanation[];
}

interface LingueeWordExplanation {
  explanation: string;
  partOfSpeech: string;
  frequencey?: WordFrequencey;
}

enum WordFrequencey {
  OftenUsed = "often used",
  Normal = "",
  LessCommon = "less common",
}

/**
 * Iterate translation group and get translation
 */
function iterateTranslationGroup(translations: HTMLElement[] | undefined, designatedFrequencey?: WordFrequencey) {
  return translations?.map((translation) => {
    const dictLink = translation?.querySelector(".dictLink");
    const tag_type = translation?.querySelector(".tag_type");
    const tag_c = translation?.querySelector(".tag_c");

    const frequencey =
      tag_c?.textContent === `(${WordFrequencey.OftenUsed.toString()})`
        ? WordFrequencey.OftenUsed
        : WordFrequencey.Normal;
    const wordFrequencey = designatedFrequencey ?? frequencey;

    const explanation: LingueeWordExplanation = {
      explanation: dictLink?.textContent ?? "",
      partOfSpeech: tag_type?.textContent ?? "",
      frequencey: wordFrequencey,
    };
    console.log(`---> ${JSON.stringify(explanation, null, 2)}`);
    return explanation;
  });
}

export const parseDOMResult = (dom: ReturnType<typeof parse>) => {
  const list = dom.querySelectorAll(".autocompletion_item");

  return Array.from(list).map((item) => {
    const $mainItem = item.querySelector(".main_row .main_item");
    const word = $mainItem?.textContent;
    const href = $mainItem?.attributes.href;
    const lid = $mainItem?.attributes.lid;
    const wordType = item.querySelector(".main_row .main_wordtype")?.textContent;
    const translationDOMList = item.querySelectorAll(".translation_item");
    const translations = Array.from(translationDOMList).map((item) => {
      const lid = item.attributes.lid;
      const wordType = item.querySelector(".wordtype")?.textContent;
      item.querySelector(".sep")?.replaceWith("");
      item.querySelector(".wordtype")?.replaceWith("");

      const word = item.textContent?.trim();

      if (!word || !wordType || !href || !lid) return;

      return {
        word,
        wordType,
        lid,
      };
    });

    if (!word || !wordType || !lid || !href) return;

    return {
      word: word,
      wordType: wordType,
      lid,
      href,
      translations: translations,
    };
  });
};

export function rquestLingueeWord0() {
  console.log("---> requesting linguee word");

  //  read html file async
  fs.readFile(htmlPath, "utf8", (err, data) => {
    if (err) {
      console.error(`read linguee html file error: ${err}`);
      return;
    }
    console.log("---> read linguee html file success");

    const parser = new htmlparser2.Parser(
      {
        onattribute(name, value, quote?) {
          // console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          // if (name === "class" && value === "tag_wordtype") {
          //   console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          // }
        },
        onopentag(name, attributes) {
          //   console.log(`name: ${name}, attributes: ${JSON.stringify(attributes)}`);
          // if (name === "span" && attributes.class === "tag_lemma") {
          //   console.log(`name: ${name}, attributes: ${JSON.stringify(attributes)}`);
          // }
        },
        ontext(text) {
          /*
           * Fires whenever a section of text was processed.
           *
           * Note that this can fire at any point within text and you might
           * have to stitch together multiple pieces.
           */
          //   console.log("-->", text);
        },
        onprocessinginstruction(name, data) {
          console.log(`name: ${name}, data: ${data}`);
        },
      },
      { xmlMode: true }
    );
    parser.write(data);
    parser.end();
  });
}

export function rquestLingueeWord1() {
  console.log("---> requesting linguee word");
  const url = "https://www.linguee.com/english-chinese/search?source=auto&query=good";

  axios
    .get(url)
    .then((res) => {
      console.warn(`cost: ${res.headers["x-request-cost"]} ms`);

      const parser = new htmlparser2.Parser({
        onattribute(name, value, quote?) {
          if (name === "class" && value === "tag_lemma") {
            console.log(`name: ${name}, value: ${value}, quote: ${quote}`);
          }
        },
        ontext(text) {
          /*
           * Fires whenever a section of text was processed.
           *
           * Note that this can fire at any point within text and you might
           * have to stitch together multiple pieces.
           */
          //   console.log("-->", text);
        },
      });
      parser.write(res.data);
      parser.end();

      //   const dom = htmlparser2.parseDocument(res.data);
    })
    .catch((err) => {
      console.log(err);
    });
}

export function rquestLingueeWord2() {
  console.log("---> requesting linguee word");
  const url = "https://www.linguee.com/english-chinese/search?source=auto&query=good";
  //   const url = "https://cn.linguee.com/chinese-english/search?source=english&query=good";
  //   const url = "https://www.linguee.com/search?source=english&qe=good";
  axios
    .get(url)
    .then((res) => {
      console.warn(`cost: ${res.headers["x-request-cost"]} ms`);

      // use cheerio to parse html
      const $ = cheerio.load(res.data);
      //   const pronounceText = $(".hd_p1_1>.hd_prUS").text(); // '美 [ɡʊd]'
      //   for (const element of $(".qdef>ul>li")) {
      // const titles = $(".dis", "#pos_0").map((i, element) => {

      // get class 'exact' > 'line lemma_desc'
      const lemma_desc = $(".exact>.lemma>");
      console.log(`tag_lemma text: ${lemma_desc.find(".tag_lemma").text()}`);

      const tag_lemma = lemma_desc.find(".tag_lemma");
      console.log(`tag_lemma length: ${tag_lemma.length}, first: ${tag_lemma.first().text()}`);

      for (const element of tag_lemma) {
        const word = $(element).find(".dictLink").text();
        const part = $(element).find(".tag_wordtype").text();
        console.log(`tag_lemma: ${word}: ${part}`);
      }

      const translation_lines = lemma_desc.find(".translation_lines");
      console.log(`translation_lines length: ${translation_lines.length}, first: ${translation_lines.first().text()}`);

      console.warn(`translation_lines: ${$("div .translation_lines").text()}}`);

      for (const element of translation_lines.find(".tag_trans")) {
        console.log(`translation: ${$(element).text()}`);
        // const word = $(element).find(".dictLink").text();
        // const part = $(element).find(".tag_wordtype").text();
        // console.log(`${word}: ${part}`);
      }
    })
    .catch((err) => {
      console.log(err);
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
