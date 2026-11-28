/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { ProviderIconConfig } from "@/core/results/types";

export type WordResultMode = "translation" | "dictionary";

interface AIProviderProfileBase {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  icon: ProviderIconConfig;
  wordResultMode: WordResultMode;
}

export interface RaycastAIProfile extends AIProviderProfileBase {
  adapter: "raycast-ai";
  model: string;
}

export type TokenLimitMode = "max-tokens" | "max-completion-tokens";
export type JSONOutputMode = "prompt" | "json-object";

export interface OpenAICompatibleProfile extends AIProviderProfileBase {
  adapter: "openai-compatible";
  endpoint: string;
  website?: string;
  model: string;
  apiKey: string;
  tokenLimitMode: TokenLimitMode;
  jsonOutputMode: JSONOutputMode;
}

export type AIProviderProfile = RaycastAIProfile | OpenAICompatibleProfile;

export type LegacyAIProviderName = "openai" | "gemini";

export type LegacyAIProviderAssignment = { kind: "profile"; profileId: string } | { kind: "retired" };

export interface StoredAIProviderStateV1 {
  version: 1;
  profiles: AIProviderProfile[];
  providerOrder?: string[];
  legacyProviderAssignments?: Partial<Record<LegacyAIProviderName, LegacyAIProviderAssignment>>;
}

/** Manage Providers overrides for built-in dictionary and translation checkboxes. */
export type BuiltinEnabledOverrides = Partial<Record<string, boolean>>;

export interface StoredAIProviderState {
  version: 2;
  profiles: AIProviderProfile[];
  providerOrder?: string[];
  /**
   * When set for a built-in provider key, Manage Providers enable/disable overrides the
   * matching Extension Settings checkbox for queries. Absent keys follow Extension Settings.
   */
  builtinEnabled?: BuiltinEnabledOverrides;
  /** Completed legacy imports, including providers the user has since deleted. */
  migratedLegacyProviders: LegacyAIProviderName[];
  /** Source identities retained only while another legacy provider is still pending import. */
  legacyProviderAssignments?: Partial<Record<LegacyAIProviderName, LegacyAIProviderAssignment>>;
}
