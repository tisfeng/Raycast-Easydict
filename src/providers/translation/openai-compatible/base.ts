/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { streamText } from "@xsai/stream-text";

import { getLanguageEnglishName } from "@/core/language/utils";
import { BaseStreamingTranslateProvider } from "@/providers/translation/base";
import type { QueryInput, RequestOptions, StreamChunk, TranslationResult } from "@/types/query";
import { timedFetch } from "@/utils/http";
import { logTrace } from "@/utils/logger";

import { createTranslationPromptSpec, renderTranslationChatMessages } from "../ai-prompt";

type MaxTokensParams = { max_tokens: number };
type MaxCompletionTokensParams = { max_completion_tokens: number };
export type TokenLimitParams = MaxTokensParams | MaxCompletionTokensParams;

export interface OpenAICompatibleTranslateResult {
  translatedText: string;
}

export abstract class BaseOpenAICompatibleTranslateProvider extends BaseStreamingTranslateProvider<OpenAICompatibleTranslateResult> {
  protected abstract getEndpoint(): string;
  protected abstract getModel(): string;
  protected abstract getAPIKey(): string | undefined;

  protected getTokenLimitParams(): TokenLimitParams {
    return { max_tokens: 2000 }; // Default base implementation
  }

  protected async *doTranslate(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
  ): AsyncGenerator<StreamChunk, TranslationResult<OpenAICompatibleTranslateResult>, unknown> {
    const url = this.getEndpoint();
    const apiKey = this.getAPIKey();
    const modelName = this.getModel();

    const fromLanguage = getLanguageEnglishName(queryWordInfo.fromLanguage);
    const toLanguage = getLanguageEnglishName(queryWordInfo.toLanguage);

    logTrace(this.logLabel, `translate (${modelName}): ${fromLanguage} -> ${toLanguage}: ${queryWordInfo.word}`);

    const tokenParams = this.getTokenLimitParams();
    const messages = renderTranslationChatMessages(
      createTranslationPromptSpec(queryWordInfo, fromLanguage, toLanguage),
    );

    const chunks: string[] = [];

    const streamResult = streamText({
      baseURL: url,
      apiKey,
      model: modelName,
      messages,
      abortSignal: signal,
      fetch: timedFetch.native,
      ...tokenParams,
    });

    // Suppress unhandled rejection warnings for unused promises (e.g. usage, messages)
    Object.values(streamResult).forEach((value) => {
      if (value instanceof Promise) value.catch(() => {});
    });

    const { textStream } = streamResult;

    for await (const chunk of textStream) {
      if (chunk) {
        chunks.push(chunk);
        yield { content: chunk, role: "assistant" };
      }
    }

    const resultText = chunks.join("");

    return {
      type: this.type,
      queryWordInfo,
      translations: [resultText],
      result: { translatedText: resultText },
    };
  }
}
