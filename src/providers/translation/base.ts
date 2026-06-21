/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { RequestType } from "@/types/api";
import type { QueryTypeResult, QueryWordInfo, RequestOptions, StreamChunk } from "@/types/query";
import { handleRequestError } from "@/utils/errors";
import { createTimer } from "@/utils/logger";

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
    const timer = createTimer(this.type);
    try {
      const response = this.doTranslate(queryWordInfo, options);
      // Detect AsyncGenerator: delegate all yields and return the final value
      if (response != null && Symbol.asyncIterator in Object(response)) {
        const result = yield* response as AsyncGenerator<StreamChunk, QueryTypeResult<T>, unknown>;
        timer.done(result.translations?.join(", ") ?? "(no result)");
        return result;
      }
      // Legacy Promise path: await and yield the single final result
      const result = await (response as Promise<QueryTypeResult<T>>);
      timer.done(result.translations?.join(", ") ?? "(no result)");
      return result;
    } catch (error) {
      timer.fail();
      throw handleRequestError(this.type, error);
    }
  }

  protected abstract doTranslate(queryWordInfo: QueryWordInfo, options?: RequestOptions): ProviderResult<T>;
}
