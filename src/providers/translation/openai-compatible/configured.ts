/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { OpenAICompatibleProfile } from "@/ai-providers/types";
import { TranslationType } from "@/types/api";

import { BaseOpenAICompatibleTranslateProvider } from "./base";

const DEFAULT_MAX_TOKENS = 2000;
export class ConfiguredOpenAICompatibleTranslateProvider extends BaseOpenAICompatibleTranslateProvider {
  type = TranslationType.OpenAI;

  constructor(private readonly profile: Readonly<OpenAICompatibleProfile>) {
    super();
  }

  protected override get logLabel() {
    return this.profile.name;
  }

  protected getEndpoint() {
    return this.profile.endpoint
      .trim()
      .replace(/\/chat\/completions\/?$/, "")
      .replace(/\/+$/, "");
  }

  protected getModel() {
    return this.profile.model.trim();
  }

  protected getAPIKey() {
    return this.profile.apiKey.trim();
  }

  protected getTokenLimitParams() {
    if (this.profile.tokenLimitMode === "max-completion-tokens") {
      return { max_completion_tokens: DEFAULT_MAX_TOKENS };
    }
    return { max_tokens: DEFAULT_MAX_TOKENS };
  }
}
