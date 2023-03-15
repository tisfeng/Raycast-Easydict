import { AppKeyStore } from "./../../preferences";
/*
 * @author: tisfeng
 * @createTime: 2023-03-14 22:11
 * @lastEditor: tisfeng
 * @lastEditTime: 2023-03-15 18:31
 * @fileName: openai.ts
 *
 * Copyright (c) 2023 by ${git_name}, All Rights Reserved.
 */

import axios, { AxiosError } from "axios";
import { QueryWordInfo } from "../../dictionary/youdao/types";
import { QueryTypeResult, TranslationType } from "../../types";
import { getTypeErrorInfo } from "../../utils";

// Use axios to request openai api.
export function requestOpenAITextTranslate(queryWordInfo: QueryWordInfo): Promise<QueryTypeResult> {
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
  };

  const openAIAPIKey = AppKeyStore.openAIAPIKey;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${openAIAPIKey}`,
  };

  const type = TranslationType.OpenAI;

  return new Promise((resolve, reject) => {
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
      });
  });
}
