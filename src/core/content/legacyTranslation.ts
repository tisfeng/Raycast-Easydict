import type { TranslationType } from "@/core/results/kinds";
import type { TranslationResult } from "@/core/results/types";

import type { TranslationContent } from "./types";

export type LegacyTranslationResult = TranslationResult & { content: TranslationContent };

/** Temporary outgoing bridge while the query and UI consumers still read the previous result format. */
export function toLegacyTranslationResult(type: TranslationType, content: TranslationContent): LegacyTranslationResult {
  return { type, content, queryWordInfo: content.query, translations: [...content.paragraphs] };
}
