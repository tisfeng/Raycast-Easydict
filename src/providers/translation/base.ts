/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { RequestType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo } from "@/types/query";
import { CancelledError, getErrorMessage, getErrorName, getTypeErrorInfo, RequestError } from "@/utils/errors";
import { logError, logTrace } from "@/utils/logger";

/**
 * Abstract base for translation providers.
 *
 * Template method pattern:
 * - `request()` is the public entry point — handles cancellation and error normalization
 * - `doTranslate()` is implemented by each subclass with the actual API call
 *
 */
export abstract class BaseTranslateProvider {
  abstract type: RequestType;

  public request = async (queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult> => {
    logTrace(this.type, `start request ${this.type}`);
    try {
      return await this.doTranslate(queryWordInfo, signal);
    } catch (error) {
      if (
        error instanceof CancelledError ||
        getErrorName(error) === "AbortError" ||
        getErrorMessage(error) === "canceled"
      ) {
        logTrace(this.type, "canceled");
        throw new CancelledError();
      }
      logError(this.type, `translate error: ${getErrorMessage(error)}`);
      // If doTranslate already threw a RequestError (e.g. with custom message), use it directly
      if (error instanceof RequestError) {
        throw error;
      }
      throw getTypeErrorInfo(this.type, error as { status?: number; statusText?: string; message?: string });
    }
  };

  protected abstract doTranslate(queryWordInfo: QueryWordInfo, signal?: AbortSignal): Promise<QueryTypeResult>;
}
