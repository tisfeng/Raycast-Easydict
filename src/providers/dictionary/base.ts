/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { DictionaryType } from "@/types/api";
import type { QueryResult, QueryWordInfo, RequestOptions } from "@/types/query";
import { handleRequestError } from "@/utils/errors";
import { logTrace } from "@/utils/logger";

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
export abstract class BaseDictionaryProvider<T = unknown> {
  abstract type: DictionaryType;

  public request = async (queryWordInfo: QueryWordInfo, options?: RequestOptions): Promise<QueryResult<T>> => {
    logTrace(this.type, `start request ${this.type}`);
    try {
      const result = await this.doQuery(queryWordInfo, options);
      logTrace(this.type, "finish request");
      return result;
    } catch (error) {
      throw handleRequestError(this.type, error);
    }
  };

  protected abstract doQuery(queryWordInfo: QueryWordInfo, options?: RequestOptions): Promise<QueryResult<T>>;
}
