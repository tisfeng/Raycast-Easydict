/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { APICallError, RemoteAPIError } from "@xsai/shared";
import { FetchError } from "ofetch";

import type { RequestType } from "@/types/api";

/**
 * Show error toast according to errorInfo.
 */
export function showErrorToast(errorInfo: unknown) {
  // Silently ignore cancellation errors
  const { name, message } = normalizeError(errorInfo);
  if (name === "CancelledError" || name === "AbortError" || message === "canceled") return;

  if (errorInfo instanceof RequestError) {
    showFailureToast(errorInfo.message, {
      title: `${errorInfo.type} Error${errorInfo.code ? `: ${errorInfo.code}` : ""}`,
    });
  } else {
    showFailureToast(message, {
      title: "Error",
    });
  }
}

/**
 * Get request error info.
 */
export function parseRequestError(type: RequestType, error: unknown): RequestError {
  if (error instanceof RequestError) return error;

  const { message, code } = normalizeError(error);
  return new RequestError(type, message, code);
}

/**
 * Parses the JSON payload string returned by the Gemini/OpenAI API
 */
function parseXsaiErrorMessage(error: APICallError | RemoteAPIError): string {
  if (!error.responseBody || typeof error.responseBody !== "string") return error.message;
  try {
    const parsed = JSON.parse(error.responseBody);
    const body = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof body?.error?.message === "string") return body.error.message;
  } catch {
    // If responseBody is not valid JSON, we just fall back
  }
  // Fallback to original ugly message
  return error.message;
}

/**
 * Standardized error structure extracted from any unknown error payload.
 */
export interface NormalizedError {
  /** The error name, e.g. "FetchError", "AbortError", "TypeError" */
  name: string;
  /** The human-readable error message */
  message: string;
  /** The error code or HTTP status code, if applicable */
  code: string;
}

/**
 * Extract error name, message, and code from an unknown error object safely.
 *
 * This normalizes various error shapes:
 * - `ofetch` FetchError (unwraps underlying `cause` like `AbortError`)
 * - Custom `APICallError` or `RemoteAPIError` (JSON payloads from LLM providers)
 * - Standard JS `Error` objects
 * - Arbitrary objects with `name`/`message`/`code`/`status` properties
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof FetchError) {
    let message = error.message || "Fetch error";
    if (error.status) {
      message = `${error.status} ${error.statusText}`;
    } else if (error.data) {
      message = typeof error.data === "string" ? error.data : JSON.stringify(error.data);
    } else {
      const cause = error.cause instanceof Error ? error.cause : null;
      const inner = cause?.cause instanceof Error ? cause.cause : null;
      message = inner?.message || cause?.message || message;
    }

    return {
      name: error.cause instanceof Error ? error.cause.name : error.name,
      message,
      code: error.status ? String(error.status) : "",
    };
  }

  if (error instanceof APICallError || error instanceof RemoteAPIError) {
    return {
      name: error.name,
      message: parseXsaiErrorMessage(error),
      code: "code" in error ? String(error.code) : "",
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? String(error.code) : "",
    };
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      name: err.name ? String(err.name) : "unknown",
      message: err.message ? String(err.message) : String(error),
      code: err.code ? String(err.code) : err.status ? String(err.status) : "",
    };
  }

  return {
    name: "unknown",
    message: String(error),
    code: "",
  };
}

/**
 * Custom error class to standardize errors thrown by API providers.
 */
export class RequestError extends Error {
  type: string;
  code?: string;

  constructor(type: string, message: string, code?: string) {
    super(message);
    this.name = "RequestError";
    this.type = type;
    this.code = code;
  }
}

/**
 * Sentinel error for cancelled requests.
 * Callers should check `error instanceof CancelledError` instead of string matching.
 */
export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}
