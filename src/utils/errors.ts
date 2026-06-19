/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { FetchError } from "ofetch";

import type { RequestType } from "@/types/api";
import { logWarn } from "@/utils/logger";

/**
 * Show error toast according to errorInfo.
 */
export function showErrorToast(errorInfo: RequestError | undefined) {
  if (!errorInfo?.type) {
    logWarn("utils", `errorInfo type is undefined: ${JSON.stringify(errorInfo, null, 4)}`);
    return;
  }

  showFailureToast(errorInfo.message, {
    title: `${errorInfo.type} Error${errorInfo.code ? `: ${errorInfo.code}` : ""}`,
  });
}

/**
 * Get request error info.
 */
export function getTypeErrorInfo(
  type: RequestType,
  error: { status?: number; statusText?: string; message?: string },
): RequestError {
  const errorCode = error.status;
  const errorMessage = error.statusText || error.message || "something error 😭";
  const errorInfo = new RequestError(type, errorMessage, `${errorCode || ""}`);
  return errorInfo;
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
 * Sentinel error for cancelled requests.
 * Callers should check `error instanceof CancelledError` instead of string matching.
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
export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}
