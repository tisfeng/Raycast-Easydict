/*
 * @author: tisfeng
 * @createTime: 2022-08-03 10:18
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-06 10:38
 * @fileName: deepL.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios, { AxiosError } from "axios";
import querystring from "node:querystring";
import { getLanguageItemFromYoudaoId } from "../language/languages";
import { KeyStore, myDecrypt } from "../preferences";
import { DeepLTranslateResult, RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";

const deepLAuthStoredKey = "deepLAuthStoredKey";

/**
 * DeepL translate API
 * https://www.deepl.com/zh/docs-api/translating-text
 */
export async function requestDeepLTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<RequestTypeResult> {
  console.log(`---> start rquest DeepL`);
  const sourceLang = getLanguageItemFromYoudaoId(fromLanguage).deepLSourceLanguageId;
  const targetLang =
    getLanguageItemFromYoudaoId(targetLanguage).deepLSourceLanguageId ||
    getLanguageItemFromYoudaoId(targetLanguage).deepLTargetLanguageId;

  // if language is not supported, return null
  if (!sourceLang || !targetLang) {
    console.log(`DeepL translate not support language: ${fromLanguage} --> ${targetLanguage}`);
    return Promise.resolve({
      type: TranslationType.DeepL,
      result: null,
      translations: [],
    });
  }

  let deepLAuthKey = KeyStore.deepLAuthKey;

  // Determine in advance whether the key is valid or not, and if it is invalid, get a new key
  const isValidKey = await checkIfKeyVaild(deepLAuthKey);
  if (!isValidKey) {
    console.log(`---> no valid key, try to get a new key`);
    await getAndStoreValidDeepLKey(wildEncryptedDeepLKeys);
  }

  // if has stored key, use it first.
  const storedKey = await LocalStorage.getItem<string>(deepLAuthStoredKey);
  if (storedKey) {
    console.log(`---> use stored deepL key: ${storedKey}`);
    deepLAuthKey = storedKey;
  }

  // * deepL api free and deepL pro api use different url host.
  const url = deepLAuthKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  const params = {
    auth_key: deepLAuthKey,
    text: queryText,
    source_lang: sourceLang,
    target_lang: targetLang,
  };
  console.log(`---> deepL params: ${JSON.stringify(params, null, 4)}`);

  try {
    const response = await axios.post(url, querystring.stringify(params));
    const deepLResult = response.data as DeepLTranslateResult;
    const translatedText = deepLResult.translations[0].text;
    console.log(
      `DeepL translate: ${JSON.stringify(translatedText, null, 4)}, cost: ${response.headers["requestCostTime"]} ms`
    );
    return Promise.resolve({
      type: TranslationType.DeepL,
      result: deepLResult,
      translations: [translatedText],
    });
  } catch (err) {
    console.error(`DeepL translate error: ${err}`);
    const error = err as AxiosError;
    console.error("error response: ", error.response);

    const errorCode = error.response?.status;
    let errorMessage = error.response?.statusText || "Something error 😭";
    if (errorCode === 456) {
      errorMessage = "Quota exceeded"; // https://www.deepl.com/zh/docs-api/accessing-the-api/error-handling/
    }

    const errorInfo: RequestErrorInfo = {
      type: TranslationType.DeepL,
      code: errorCode?.toString() || "",
      message: errorMessage,
    };
    console.error("deepL error info: ", errorInfo);
    return Promise.reject(errorInfo);
  }
}

const wildEncryptedDeepLKeys = [
  "U2FsdGVkX19Mt7cnRCJQINAzLGqqZAhqPcbxeKrBUV62/Dd0u1Qa0QxY8ljYWjmCAz8NwG+uOmD8Ez0HijCJnw==",
  "U2FsdGVkX1+7yAdmxTGWdRJ6oeDcZ+1YzndxtkdpuOk6jWBjNezThjj8NgT+flfxOPccJXXlIilvRssFzPnagg==",
  "U2FsdGVkX1+NJ1HnZbrmW0KMdbTTHPAE2LmATthkMS2EFt1lJ0W74GBi+rlwJeBKZrn6R9ne4fdI7WV0vpCcrQ==",
  "U2FsdGVkX1856l+ibQOyYvNwU53suxx6UHzBT1xBuIzhh5JvHmD/qG5gImiDpJbw62LWQxBXNn7kRvM+O2jRYg==",
  "U2FsdGVkX190UMu/gorJ/qgwhayFJilCPE5kSfOutkELsUnylfAZEtJGVPin3njGRwC2odphwTigbCzEcJ4kAw==",
  "U2FsdGVkX1+iLWPtCcBXjS4TLLbBql8KOU4wvfcGhm/nAcYIu2BIaco8iORmW9CCKEKSLkUd3aSCaSDPgnuClA==",
  "U2FsdGVkX1/seyI1CRkqz8+73B33fCplJrqDNkiXC83XBr3Jc8Rz14Bhx6ldVbpkcy8sk18/CQyCAWbgiJPEjQ==",
  "U2FsdGVkX1/vD+AUbRlTFmGMqQGsbzjngY2NUwiLgYrMRA9KD0sTI7Xq8DJz3aMpB8PAuZZMcMFmqjedu5yobw==",
  "U2FsdGVkX1+1Iexu0P8IEaxZchH/LYi9BCAQNbt8d0ImP0/NyTc+W3JhlBtTcB31SfstKOURNQQW6Ol3ZCxfew==",
  "U2FsdGVkX1+yGtuvj9lX2qJZXMiaAs1KMB3jwK0SPnVGfATSyXC8LGBnVTyX6TNyLvSvnINJQp1dLZzDb85bLQ==",
  "U2FsdGVkX1/61u2OfkPsFuw54CA3I1imQ5FwUymFsvkyaOXQkMm+sr+NGGlfLvHNcp6SvQgmrQuof8F/pRY51w==",
];

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DeepLUsage {
  character_count: number;
  character_limit: number;
}

/**
 * Check if key is valid.
 *
 * https://www.deepl.com/zh/docs-api/other-functions/monitoring-usage/
 */
function checkIfKeyVaild(key: string): Promise<boolean> {
  console.log(`test a deepL key: ${key}`);
  const url = "https://api-free.deepl.com/v2/usage";
  const params = {
    auth_key: key,
  };

  return new Promise((resolve) => {
    axios
      .post(url, querystring.stringify(params))
      .then((res) => {
        const usage = res.data as DeepLUsage;
        console.log(`---> usage: ${JSON.stringify(usage)}`);
        if (usage.character_count < usage.character_limit) {
          console.log(`---> valid key: ${key}`);
          resolve(true);
        } else {
          console.log(`---> execeded quota: ${key}`);
          resolve(false);
        }
      })
      .catch((err) => {
        console.error(`---> isVaildKey error: ${err}`);
        console.log(`---> error key: ${key}`);
        resolve(false);
      });
  });
}

/**
 * Get a valid deepL key and store it.
 */
export async function getAndStoreValidDeepLKey(encryptedKeys: string[]): Promise<void> {
  if (encryptedKeys.length > 0) {
    for (const encryptedKey of encryptedKeys) {
      const key = myDecrypt(encryptedKey);
      if (await checkIfKeyVaild(key)) {
        // remove key
        encryptedKeys.splice(encryptedKeys.indexOf(encryptedKey), 1);
        console.log(`---> find and store new key: ${key}`);
        LocalStorage.setItem(deepLAuthStoredKey, key);
      }
    }
  }
  console.log(`---> no valid key, use defatul key`);
}
