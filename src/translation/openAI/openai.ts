/*
 * @author: tisfeng
 * @createTime: 2023-03-14 22:11
 * @lastEditor: tisfeng
 * @lastEditTime: 2023-03-16 22:20
 * @fileName: openai.ts
 *
 * Copyright (c) 2023 by ${git_name}, All Rights Reserved.
 */

import axios, { AxiosError } from "axios";
import { QueryWordInfo } from "../../dictionary/youdao/types";
import { QueryTypeResult, TranslationType } from "../../types";
import { getTypeErrorInfo } from "../../utils";
import { AppKeyStore } from "./../../preferences";
import { fetchSSE } from "./utils";

// Use axios to request openai api.
export function requestOpenAITextTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  //   console.warn(`---> start request OpenAI`);

  const url = "https://api.openai.com/v1/chat/completions";
  //   const prompt = `translate from English to Chinese:\n\n"No level of alcohol consumption is safe for our health." =>`;
  const prompt = `translate from ${queryWordInfo.fromLanguage} to ${queryWordInfo.toLanguage}:\n\n"${queryWordInfo.word}" =>`;
  const message = [
    {
      role: "system",
      content: "You are a faithful translation assistant that can only translate text and cannot interpret it.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const params = {
    model: "gpt-3.5-turbo",
    messages: message,
    temperature: 0,
    max_tokens: 2000,
    top_p: 1.0,
    frequency_penalty: 1,
    presence_penalty: 1,
  };

  const openAIAPIKey = AppKeyStore.openAIAPIKey;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${openAIAPIKey}`,
  };

  const type = TranslationType.OpenAI;

  return new Promise((resolve, reject) => {
    // Post request is too slow, we need to use server-send-event to improve performance.
    axios
      .post(url, params, {
        headers,
      })
      .then((response) => {
        const { data } = response;
        // console.warn(`---> openai response: ${JSON.stringify(data)}`);

        const { choices } = data;
        if (choices.length === 0) {
          const error = new Error("No result.");
          reject(error);
          return;
        }

        let result = choices[0].message.content.trim() as string;
        // remove prefix " and suffix "
        result = result.replace(/^"(.*)"$/, "$1") as string;

        console.warn(`---> openai result: ${result}`);
        resolve({
          type,
          queryWordInfo,
          translations: [result],
          result: {
            translatedText: result,
          },
        });
      })
      .catch((error: AxiosError) => {
        if (error.message === "canceled") {
          console.log(`---> openai canceled`);
          return reject(undefined);
        }

        console.error(`---> OpenAI translate error: ${error}`);
        console.error("OpenAI error response: ", error.response);
        let errorInfo = getTypeErrorInfo(type, error);
        if (openAIAPIKey.trim().length === 0) {
          errorInfo = {
            type: type,
            code: `401`,
            message: `No OpenAI API key.`,
          };
        }
        reject(errorInfo);
      });
  });
}

export function requestOpenAIStreamTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
  console.warn(`---> start request OpenAI`);

  const url = "https://api.openai.com/v1/chat/completions";
  //   const prompt = `translate from English to Chinese:\n\n"No level of alcohol consumption is safe for our health." =>`;
  const prompt = `translate from ${queryWordInfo.fromLanguage} to ${queryWordInfo.toLanguage}:\n\n"${queryWordInfo.word}" =>`;
  const message = [
    {
      role: "system",
      content: "You are a faithful translation assistant that can only translate text and cannot interpret it.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const params = {
    model: "gpt-3.5-turbo",
    messages: message,
    temperature: 0,
    max_tokens: 2000,
    top_p: 1.0,
    frequency_penalty: 1,
    presence_penalty: 1,
    stream: true,
  };

  const openAIAPIKey = AppKeyStore.openAIAPIKey;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${openAIAPIKey}`,
  };

  const type = TranslationType.OpenAI;

  let isFirst = true;

  let resultText = "";
  let targetTxt = "";
  let openAIResult: QueryTypeResult;

  return new Promise((resolve, reject) => {
    fetchSSE(`${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      onMessage: (msg) => {
        // console.warn(`---> openai msg: ${JSON.stringify(msg)}`);

        let resp;
        try {
          resp = JSON.parse(msg);
          // console.warn(`---> openai response: ${JSON.stringify(resp)}`);
        } catch {
          return;
        }
        const { choices } = resp;
        if (!choices || choices.length === 0) {
          return { error: "No result" };
        }
        const { delta, finish_reason: finishReason } = choices[0];
        if (finishReason) {
          return;
        }
        const { content = "", role } = delta;
        targetTxt = content;

        if (isFirst && targetTxt && ["“", '"', "「"].indexOf(targetTxt[0]) >= 0) {
          targetTxt = targetTxt.slice(1);
        }

        // console.warn(`---> openai targetTxt: ${targetTxt}`);
        resultText += targetTxt;

        if (!role) {
          isFirst = false;
        }

        openAIResult = {
          type,
          queryWordInfo,
          translations: [resultText],
          result: {
            translatedText: resultText,
          },
          // onMessage: (msg) => {
          //   console.warn(`---> openai onMessage: ${JSON.stringify(msg)}`);
          // },
        };
        // query.onMessage({ content: targetTxt, role });
        if (queryWordInfo.onMessage) {
          queryWordInfo.onMessage({ content: targetTxt, role });
        }

        resolve(openAIResult);
      },
      onError: (error) => {
        console.error(`---> OpenAI translate error: ${error}`);

        if (error.message === "canceled") {
          console.log(`---> caiyun canceled`);
          return reject(undefined);
        }

        console.error(`---> OpenAI translate error: ${error}`);
        console.error("OpenAI error response: ", error.response);
        let errorInfo = getTypeErrorInfo(type, error);
        if (openAIAPIKey.trim().length === 0) {
          errorInfo = {
            type: type,
            code: `401`,
            message: `No OpenAI API key.`,
          };
        }
        reject(errorInfo);
      },
    });
  });
}
