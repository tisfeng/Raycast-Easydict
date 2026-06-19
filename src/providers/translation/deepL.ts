/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */
import querystring from "node:querystring";

import { getLangCode } from "@/core/language/utils";
import { AppKeyStore } from "@/preferences";
import { TranslationType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { getTypeErrorInfo, RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

export interface DeepLTranslateResult {
  translations: DeepLTranslationItem[];
}

export interface DeepLTranslationItem {
  detected_source_language: string;
  text: string;
}

/**
 * DeepL translate API. Cost time: > 1s
 *
 * https://www.deepl.com/zh/docs-api/translating-text
 */
export class DeepLTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.DeepL;

  protected async doTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> {
    const { fromLanguage, toLanguage, word } = queryWordInfo;
    const sourceLang = getLangCode(fromLanguage, "deepLSourceId");
    const targetLang = getLangCode(toLanguage, "deepLSourceId");

    // if language is not supported, return null
    if (!sourceLang || !targetLang) {
      logTrace("deepl", `translate not support language: ${fromLanguage} --> ${toLanguage}`);
      return {
        type: TranslationType.DeepL,
        result: undefined,
        translations: [],
        queryWordInfo,
      };
    }

    const deepLAuthKey = AppKeyStore.deepLAuthKey;

    if (!deepLAuthKey) {
      throw new RequestError(TranslationType.DeepL, "No deepL key", "");
    }

    // * deepL api free and deepL pro api use different url host.
    let url = deepLAuthKey.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    const deepLEndpoint = AppKeyStore.deepLEndpoint;
    if (deepLEndpoint.length > 0) {
      url = deepLEndpoint;
    }

    const params = {
      text: word,
      source_lang: sourceLang,
      target_lang: targetLang,
    };

    let deepLResult: DeepLTranslateResult;
    try {
      deepLResult = await timedFetch<DeepLTranslateResult>(url, {
        method: "POST",
        body: querystring.stringify(params),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `DeepL-Auth-Key ${deepLAuthKey}`,
        },
        signal,
      });
    } catch (error) {
      logError("deepl", `error: ${error}`);

      const errorInfo = getTypeErrorInfo(
        TranslationType.DeepL,
        error as { status?: number; statusText?: string; message?: string },
      );
      const errorCode = (error as { status?: number }).status;

      // https://www.deepl.com/zh/docs-api/api-access/error-handling/
      if (errorCode === 456) {
        errorInfo.message = "Quota exceeded"; // Quota exceeded. The character limit has been reached.
      } else if (errorCode === 403) {
        errorInfo.message = "Authorization failed"; // Authorization failed. Please supply a valid auth_key parameter.
      }

      logError("deepl", `error info: ${JSON.stringify(errorInfo)}`);
      throw errorInfo;
    }

    const translatedText = deepLResult.translations[0].text;
    logTrace("deepl", `translate: ${translatedText}`);

    return {
      type: TranslationType.DeepL,
      result: deepLResult,
      translations: translatedText.split("\n"),
      queryWordInfo,
    };
  }
}
