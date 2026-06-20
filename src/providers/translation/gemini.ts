/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { ProviderConfig } from "@/providers/shared";
import { TranslationType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo, RequestOptions } from "@/types/query";
import { RequestError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { BaseTranslateProvider } from "./base";

export interface GeminiTranslateResult {
  translatedText: string;
}

/**
 * Gemini translate API using REST request
 */
export class GeminiTranslateProvider extends BaseTranslateProvider {
  type = TranslationType.Gemini;

  protected async doTranslate(queryWordInfo: QueryWordInfo, { signal }: RequestOptions = {}): Promise<QueryTypeResult> {
    logTrace("gemini", "start request Gemini");
    const { word, fromLanguage, toLanguage } = queryWordInfo;
    const apiKey = ProviderConfig.geminiAPIKey;
    const endpoint = ProviderConfig.geminiEndpoint;
    const model = ProviderConfig.geminiModel;

    // Check if API key exists
    if (!apiKey) {
      const errorInfo = new RequestError(TranslationType.Gemini, "No Gemini API key");
      return Promise.reject(errorInfo);
    }

    // Construct prompt for translation
    const prompt = `Translate the following text from ${fromLanguage} to ${toLanguage}. Only return the translated text without any additional explanation or context:
${word}`;

    const url = `${endpoint}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const data = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const result = await timedFetch(url, {
      method: "POST",
      body: data,
      headers: { "Content-Type": "application/json" },
      signal,
    });

    logTrace("gemini", `translate result: ${JSON.stringify(result)}`);

    if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Empty response from Gemini API");
    }

    const translatedText = result.candidates[0].content.parts[0].text.trim();
    logTrace("gemini", `translate result: ${translatedText}`);

    const geminiResult: GeminiTranslateResult = {
      translatedText: translatedText,
    };

    return {
      type: TranslationType.Gemini,
      result: geminiResult,
      translations: [translatedText],
      queryWordInfo,
      oneLineTranslation: translatedText,
    };
  }
}
