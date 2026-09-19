/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { AI, environment } from "@raycast/api";

import { getLanguageEnglishName } from "@/core/language/utils";
import { DictionaryType } from "@/core/results/kinds";
import type { DictionaryResult, QueryInput, RequestOptions } from "@/core/results/types";
import { getRaycastAIModel } from "@/providers/profiles/runtime";
import type { RaycastAIProfile } from "@/providers/profiles/types";
import { RequestError } from "@/shared/errors";
import { logTrace } from "@/shared/logger";

import { BaseDictionaryProvider } from "../base";
import { formatAIWordResult, resolveAIDictionaryWordInfo } from "./format";
import { parseAIWordResult } from "./parser";
import { createAIDictionaryPromptSpec, renderAIDictionaryTextPrompt } from "./prompt";
import type { AIWordResult } from "./types";

export class RaycastAIDictionaryProvider extends BaseDictionaryProvider<AIWordResult> {
  type = DictionaryType.AI;

  constructor(private readonly profile: Readonly<RaycastAIProfile>) {
    super();
  }

  protected override get logLabel() {
    return this.profile.name;
  }

  protected async doQuery(
    queryWordInfo: QueryInput,
    { signal }: RequestOptions = {},
  ): Promise<DictionaryResult<AIWordResult>> {
    if (!environment.canAccess(AI)) {
      throw new RequestError(this.type, "Raycast AI is unavailable. Raycast Pro and AI access are required.");
    }
    const model = getRaycastAIModel(this.profile.model);
    if (!model) {
      throw new RequestError(this.type, `The configured Raycast AI model is unavailable: ${this.profile.model}`);
    }

    const fromLanguage = getLanguageEnglishName(queryWordInfo.fromLanguage);
    const toLanguage = getLanguageEnglishName(queryWordInfo.toLanguage);
    logTrace(this.logLabel, `dictionary (${model}): ${fromLanguage} -> ${toLanguage}: ${queryWordInfo.word}`);

    const prompt = renderAIDictionaryTextPrompt(createAIDictionaryPromptSpec(queryWordInfo, fromLanguage, toLanguage));
    const result = parseAIWordResult(await AI.ask(prompt, { model, creativity: "none", signal }));

    return {
      type: this.type,
      queryWordInfo: resolveAIDictionaryWordInfo(queryWordInfo, result),
      result,
      displaySections: formatAIWordResult(queryWordInfo, result),
    };
  }
}
