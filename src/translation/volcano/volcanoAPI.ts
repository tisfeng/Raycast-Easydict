/*
 * @author: tisfeng
 * @createTime: 2022-09-26 15:52
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-09-26 20:31
 * @fileName: volcano.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios from "axios";
import { requestCostTime } from "../../axiosConfig";
import { QueryWordInfo } from "../../dictionary/youdao/types";
import { printObject } from "../../utils";
import { genVolcanoSign } from "./volcanoSign";

/**
 * Volcengine Translate API
 */
export function requestVolcanoTranslate(queryWordInfo: QueryWordInfo) {
  console.log(`---> start request volcanoTranslateAPI`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  console.log(`---> fromLanguage: ${fromLanguage}, toLanguage: ${toLanguage}, word: ${word}`);

  requestVolcanoDetect(queryWordInfo);

  const query = {
    Action: "TranslateText",
    Version: "2020-06-01",
  };
  const params = {
    SourceLanguage: "",
    TargetLanguage: "zh",
    TextList: [word],
  };

  const signObjet = genVolcanoSign(query, params);
  const url = signObjet.getUrl();
  const config = signObjet.getConfig();
  console.log(`url: ${url}`);
  printObject(`params`, params);
  printObject(`config`, config);
  axios
    .post(url, params, config)
    .then((res) => {
      printObject(`headers`, res.config.headers);

      console.log(`volcanoTranslateAPI res: ${JSON.stringify(res.data, null, 2)}`);
      console.warn(`cost time: ${res.headers[requestCostTime]} ms`);
    })
    .catch((err) => {
      console.log(`volcanoTranslateAPI err: ${JSON.stringify(err, null, 2)}`);
    });
}

/**
 * Volcengine Detect API
 */
export function requestVolcanoDetect(queryWordInfo: QueryWordInfo) {
  console.log(`---> start request requestVolcanoDetect`);
  const { fromLanguage, toLanguage, word } = queryWordInfo;
  console.log(`---> fromLanguage: ${fromLanguage}, toLanguage: ${toLanguage}, word: ${word}`);

  const query = {
    Action: "LangDetect",
    Version: "2020-06-01",
  };
  const params = {
    TextList: [word],
  };

  const signObjet = genVolcanoSign(query, params);
  const url = signObjet.getUrl();
  const config = signObjet.getConfig();
  console.log(`url: ${url}`);
  printObject(`params`, params);
  printObject(`config`, config);

  axios
    .post(url, params, config)
    .then((res) => {
      printObject(`headers`, res.config.headers);

      console.log(`requestVolcanoDetect res: ${JSON.stringify(res.data, null, 2)}`);
      console.warn(`cost time: ${res.headers[requestCostTime]} ms`);
    })
    .catch((err) => {
      console.log(`requestVolcanoDetect err: ${JSON.stringify(err, null, 2)}`);
    });
}
