/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DictionaryType } from "@/types/api";
import type { QueryResult, QueryWordInfo } from "@/types/query";
import { CancelledError, getErrorMessage, getErrorName, getTypeErrorInfo, RequestError } from "@/utils/errors";
import { logError, logTrace } from "@/utils/logger";

/**
 * Abstract base for dictionary providers.
 *
 * Template method pattern:
 * - `request()` is the public entry point — handles cancellation and error normalization
 * - `doQuery()` is implemented by each subclass with the actual API call
 *
 * Returns `QueryResult` (with `displaySections` pre-computed) because dictionary
 * display logic is provider-specific (Linguee: formatLingueeDisplaySections,
 * Youdao: updateYoudaoDictionaryDisplay).
 */
export abstract class BaseDictionaryProvider {
  abstract type: DictionaryType;

  public request = async (queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryResult> => {
    logTrace(this.type, `start request ${this.type}`);
    try {
      return await this.doQuery(queryWordInfo, signal);
    } catch (error) {
      if (
        error instanceof CancelledError ||
        getErrorName(error) === "AbortError" ||
        getErrorMessage(error) === "canceled"
      ) {
        logTrace(this.type, "canceled");
        throw new CancelledError();
      }
      logError(this.type, `dictionary error: ${getErrorMessage(error)}`);
      if (error instanceof RequestError) {
        throw error;
      }
      throw getTypeErrorInfo(this.type, error as { status?: number; statusText?: string; message?: string });
    }
  };

  protected abstract doQuery(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryResult>;
}
