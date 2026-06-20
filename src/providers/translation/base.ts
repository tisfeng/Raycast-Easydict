/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { RequestType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo, RequestOptions, StreamChunk } from "@/types/query";
import { CancelledError, getErrorMessage, getErrorName, parseRequestError, RequestError } from "@/utils/errors";
import { logError, logTrace } from "@/utils/logger";

export type ProviderResult<T = unknown> =
  | Promise<QueryTypeResult<T>>
  | AsyncGenerator<StreamChunk, QueryTypeResult<T>, unknown>;

/**
 * Abstract base for translation providers.
 *
 * Template method pattern:
 * - `request()` is the public entry point — an async generator that transparently
 *   handles both legacy `Promise` returns and new `AsyncGenerator` returns from `doTranslate()`.
 *   Non-streaming providers are wrapped automatically: their Promise result is awaited
 *   and yielded once, so consumers always use `for await`.
 * - `doTranslate()` is implemented by each subclass with the actual API call.
 */
export abstract class BaseTranslateProvider<T = unknown> {
  abstract type: RequestType;

  public async *request(
    queryWordInfo: QueryWordInfo,
    options?: RequestOptions,
  ): AsyncGenerator<StreamChunk, QueryTypeResult<T>, unknown> {
    logTrace(this.type, `start request ${this.type}`);
    try {
      const response = this.doTranslate(queryWordInfo, options);
      // Detect AsyncGenerator: delegate all yields and return the final value
      if (response != null && Symbol.asyncIterator in Object(response)) {
        return yield* response as AsyncGenerator<StreamChunk, QueryTypeResult<T>, unknown>;
      }
      // Legacy Promise path: await and yield the single final result
      return await (response as Promise<QueryTypeResult<T>>);
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
      if (error instanceof RequestError) throw error;
      throw parseRequestError(this.type, error);
    }
  }

  protected abstract doTranslate(queryWordInfo: QueryWordInfo, options?: RequestOptions): ProviderResult<T>;
}
