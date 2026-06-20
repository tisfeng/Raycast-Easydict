/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DetectedLangModel } from "@/core/detect/types";
import type { LanguageDetectType } from "@/types/api";
import { CancelledError, normalizeError, parseRequestError, RequestError } from "@/utils/errors";
import { logError, logTrace } from "@/utils/logger";

/**
 * Abstract base for language detection providers.
 *
 * Template method pattern:
 * - `detect()` is the public entry point — handles cancellation and error normalization
 * - `doDetect()` is implemented by each subclass with the actual detection logic
 */
export abstract class BaseDetectProvider<T = unknown> {
  abstract type: LanguageDetectType;

  /** Indicates if this is a local offline detector (like Franc) vs a network API */
  public isLocal = false;

  abstract isEnabled(): boolean;

  public detect = async (text: string, options?: { confirmedConfidence?: number }): Promise<DetectedLangModel<T>> => {
    logTrace(this.type, `start detect ${this.type}`);
    try {
      return await this.doDetect(text, options);
    } catch (error) {
      const { name, message } = normalizeError(error);
      if (error instanceof CancelledError || name === "AbortError" || message === "canceled") {
        logTrace(this.type, "canceled");
        throw new CancelledError();
      }
      logError(this.type, `detect error: ${message}`);
      if (error instanceof RequestError) {
        throw error;
      }
      throw parseRequestError(this.type, error);
    }
  };

  protected abstract doDetect(text: string, options?: { confirmedConfidence?: number }): Promise<DetectedLangModel<T>>;
}
