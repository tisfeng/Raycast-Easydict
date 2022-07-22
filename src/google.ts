import { RequestErrorInfo, TranslationType } from "./types";
/*
 * @author: tisfeng
 * @createTime: 2022-07-22 23:27
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-23 00:21
 * @fileName: google.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosError, AxiosResponse } from "axios";
import querystring from "node:querystring";
import { RequestTypeResult } from "./types";
import { getLanguageItemFromYoudaoId } from "./utils";

export async function googleCrawlerTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  console.log("---> googleTranslate");

  const fromLanguageItem = getLanguageItemFromYoudaoId(fromLanguage);
  const toLanguageItem = getLanguageItemFromYoudaoId(targetLanguage);
  const fromLanguageId = fromLanguageItem.googleLanguageId || fromLanguageItem.youdaoLanguageId;
  const toLanguageId = toLanguageItem.googleLanguageId || toLanguageItem.youdaoLanguageId;

  const tld = "cn"; // cn, com

  const data = {
    sl: fromLanguageId, // source language
    tl: toLanguageId, // target language
    hl: toLanguageId, // hope language? web ui language
    q: queryText,
  };

  const url = `https://translate.google.${tld}/m?${querystring.stringify(data)}`;
  console.log(`---> google url: ${url}`); // https://translate.google.cn/m?sl=auto&tl=zh-CN&hl=zh-CN&q=good

  const errorInfo: RequestErrorInfo = {
    type: TranslationType.Google,
    message: "Google translate error",
  };

  return axios
    .get(url)
    .then((res: AxiosResponse) => {
      try {
        const resultRegex = /<div[^>]*?class="result-container"[^>]*>[\s\S]*?<\/div>/gi;
        let result = resultRegex.exec(res.data)?.[0]?.replace(/(<\/?[^>]+>)/gi, "") ?? "";
        result = decodeURI(result);
        console.warn(`---> google result: ${result}`);
        return Promise.resolve({
          type: TranslationType.Google,
          result,
        });
      } catch (error) {
        console.error(`googleTranslate error: ${error}`);
        return Promise.reject(errorInfo);
      }
    })
    .catch((err: AxiosError) => {
      console.error(`googleTranslate error: ${err}`);
      return Promise.reject(errorInfo);
    });
}

/**
<body>
    <div class="root-container">
        <div class="header">
            <div class="logo-image"></div>
            <div class="logo-text">翻译</div>
        </div>
        <div class="languages-container">
            <div class="sl-and-tl"><a href="./m?sl=auto&amp;tl=zh-CN&amp;q=good&amp;mui=sl&amp;hl=zh-CN">检测语言</a> → <a
                    href="./m?sl=auto&amp;tl=zh-CN&amp;q=good&amp;mui=tl&amp;hl=zh-CN">中文（简体）</a></div>
        </div>
        <div class="input-container">
            <form action="/m"><input type="hidden" name="sl" value="auto"><input type="hidden" name="tl"
                    value="zh-CN"><input type="hidden" name="hl" value="zh-CN"><input type="text" aria-label="原文"
                    name="q" class="input-field" maxlength="2048" value="good">
                <div class="translate-button-container"><input type="submit" value="翻译" class="translate-button"></div>
            </form>
        </div>
        <div class="result-container">好的</div>
        <div class="links-container">
            <ul>
                <li><a href="https://www.google.com/m?hl=zh-CN">Google 主页</a></li>
                <li><a href="https://www.google.com/tools/feedback/survey/xhtml?productId=95112&hl=zh-CN">发送反馈</a></li>
                <li><a href="https://www.google.com/intl/zh-CN/policies">隐私权及使用条款</a></li>
                <li><a href="./full">切换为完整网站</a></li>
            </ul>
        </div>
    </div>
</body>
*/
