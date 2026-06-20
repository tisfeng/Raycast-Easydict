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
  const errName = getErrorName(errorInfo);
  if (errName === "CancelledError" || errName === "AbortError") {
    return;
  }

  if (errorInfo instanceof RequestError) {
    showFailureToast(errorInfo.message, {
      title: `${errorInfo.type} Error${errorInfo.code ? `: ${errorInfo.code}` : ""}`,
    });
  } else {
    const errorMessage = getErrorMessage(errorInfo);
    showFailureToast(errorMessage, {
      title: "Error",
    });
  }
}

/**
 * Get request error info.
 */
export function parseRequestError(type: RequestType, error: unknown): RequestError {
  if (error instanceof RequestError) return error;

  let errorCode = "";
  const errorMessage = getErrorMessage(error);

  if (error instanceof FetchError) {
    errorCode = error.status ? String(error.status) : "";
  } else if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    errorCode = err.status ? String(err.status) : err.code ? String(err.code) : "";
  }

  return new RequestError(type, errorMessage, errorCode);
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
 * Extract error message from unknown error object safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof FetchError) {
    if (error.status) {
      return `${error.status} ${error.statusText}`;
    }
    if (error.data) {
      return typeof error.data === "string" ? error.data : JSON.stringify(error.data);
    }
    const cause = error.cause instanceof Error ? error.cause : null;
    const inner = cause?.cause instanceof Error ? cause.cause : null;
    return inner?.message || cause?.message || error.message || "Fetch error";
  }
  if (error instanceof APICallError || error instanceof RemoteAPIError) {
    return parseXsaiErrorMessage(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Extract error name from unknown error object safely
 */
export function getErrorName(error: unknown, fallback = "unknown"): string {
  if (error instanceof Error) {
    return error.name;
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return String(error.name);
  }
  return fallback;
}

/**
 * Extract error code from unknown error object safely
 */
export function getErrorCode(error: unknown, fallback = ""): string {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return String(error.code);
  }
  return fallback;
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
