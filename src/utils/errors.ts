/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { FetchError } from "ofetch";

import type { RequestType } from "@/types/api";
import type { RequestErrorInfo } from "@/types/query";
import { logWarn } from "@/utils/logger";

/**
 * Show error toast according to errorInfo.
 */
export function showErrorToast(errorInfo: RequestErrorInfo | undefined) {
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
): RequestErrorInfo {
  const errorCode = error.status;
  const errorMessage = error.statusText || error.message || "something error 😭";
  const errorInfo: RequestErrorInfo = {
    type: type,
    code: `${errorCode || ""}`,
    message: errorMessage,
  };
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
    return error.code;
  }
  return fallback;
}
