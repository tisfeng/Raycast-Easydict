/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { streamText } from "@xsai/stream-text";

import { getLanguageEnglishName } from "@/core/language/utils";
import { TranslationType } from "@/core/results/kinds";
import type { QueryInput, RequestOptions, StreamChunk, TranslationResult } from "@/core/results/types";
import { normalizeOpenAICompatibleEndpoint } from "@/providers/profiles/endpoint";
import { getTokenLimitParams } from "@/providers/profiles/tokenLimit";
import type { OpenAICompatibleProfile } from "@/providers/profiles/types";
import { getOpenAICompatibleRequestHeaders } from "@/providers/shared/openai-compatible-headers";
import { BaseStreamingTranslateProvider } from "@/providers/translation/base";
import { timedFetch } from "@/shared/http";
import { logTrace } from "@/shared/logger";

import { createTranslationPromptSpec, renderTranslationChatMessages } from "./prompt";

interface OpenAICompatibleTranslateResult {
  translatedText: string;
}

const DEFAULT_MAX_TOKENS = 2000;

export class ConfiguredOpenAICompatibleTranslateProvider extends BaseStreamingTranslateProvider<OpenAICompatibleTranslateResult> {
  type = TranslationType.OpenAI;

  constructor(private readonly profile: Readonly<OpenAICompatibleProfile>) {
    super();
  }

  protected override get logLabel() {
    return this.profile.name;
  }

  protected async *doTranslate(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
  ): AsyncGenerator<StreamChunk, TranslationResult<OpenAICompatibleTranslateResult>, unknown> {
    const url = normalizeOpenAICompatibleEndpoint(this.profile.endpoint);
    const apiKey = this.profile.apiKey.trim();
    const modelName = this.profile.model.trim();
    const headers = getOpenAICompatibleRequestHeaders(url);

    const fromLanguage = getLanguageEnglishName(queryWordInfo.fromLanguage);
    const toLanguage = getLanguageEnglishName(queryWordInfo.toLanguage);

    logTrace(this.logLabel, `translate (${modelName}): ${fromLanguage} -> ${toLanguage}: ${queryWordInfo.word}`);

    const tokenParams = getTokenLimitParams(this.profile.tokenLimitMode, DEFAULT_MAX_TOKENS);
    const messages = renderTranslationChatMessages(
      createTranslationPromptSpec(queryWordInfo, fromLanguage, toLanguage),
    );

    const chunks: string[] = [];

    const streamResult = streamText({
      baseURL: url,
      ...(apiKey ? { apiKey } : {}),
      ...(headers ? { headers } : {}),
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
