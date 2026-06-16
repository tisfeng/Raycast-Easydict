/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { createHash } from "node:crypto";
import { FetchError } from "ofetch";
import { LingueeListItemType } from "@/dictionary/linguee/types";
import { QueryWordInfo, YoudaoDictionaryListItemType } from "@/dictionary/youdao/types";
import { logTrace, logWarn } from "@/devLog";
import { DictionaryType, ListDisplayItem, QueryType, RequestErrorInfo, RequestType, TranslationType } from "@/types";

/**
 * Max length for word to query dictionary.
 */
const maxWordLength = 20;

/**
 * Trim the text to the max length, default 1830.
 *
 * * Note: google web translate max length is 1830.
 *
 * 例如，百度翻译 query 长度限制：为保证翻译质量，请将单次请求长度控制在 6000 bytes 以内（汉字约为输入参数 2000 个）
 */
export function trimTextLength(text: string, length = 1830) {
  text = text.trim();
  if (text.length > length) {
    return text.substring(0, length) + "...";
  }
  return text.substring(0, length);
}

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
    return `${error.status} ${error.statusText}`;
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

/**
 * Check is word, only word.length < 20 is valid.
 */
export function checkIsWordLength(word: string) {
  return word.trim().length < maxWordLength;
}

/**
 * Check queryWordInfo is word, not accurate, just a rough judgment.
 *
 * * Use queryWordInfo `isWord` when need accurate judgment.
 */
export function checkIsWord(queryWordInfo: QueryWordInfo) {
  if (queryWordInfo.isWord !== undefined) {
    return queryWordInfo.isWord;
  }
  return checkIsWordLength(queryWordInfo.word);
}

/**
 * Check type is Dictionary type.
 */
export function checkIsDictionaryType(type: QueryType): boolean {
  if (Object.values(DictionaryType).includes(type as DictionaryType)) {
    return true;
  }
  return false;
}

/**
 * Check type is Translation type.
 */
export function checkIsTranslationType(type: QueryType): type is TranslationType {
  return Object.values(TranslationType).includes(type as TranslationType);
}

/**
 * Factory: create a type guard that checks both queryType and displayType.
 *
 * @param queryTypeCheck - validates the queryType field
 * @param displayTypeValues - allowed values for displayType
 */
function createListItemTypeGuard<T extends string>(
  queryTypeCheck: (queryType: QueryType) => boolean,
  displayTypeValues: readonly T[],
) {
  const displayTypeSet = new Set(displayTypeValues);
  return (listItem: ListDisplayItem): listItem is ListDisplayItem & { displayType: T } =>
    queryTypeCheck(listItem.queryType) && displayTypeSet.has(listItem.displayType as T);
}

/**
 * Check if list item is a Youdao dictionary item.
 */
export const checkIsYoudaoDictionaryListItem = createListItemTypeGuard(
  (qt) => qt === DictionaryType.Youdao,
  Object.values(YoudaoDictionaryListItemType),
);

/**
 * Check if list item is a Linguee dictionary item.
 */
export const checkIsLingueeListItem = createListItemTypeGuard(
  (qt) => qt === DictionaryType.Linguee,
  Object.values(LingueeListItemType),
);

/**
 * Check if list item is a translation item.
 */
export const checkIsTranslationListItem = createListItemTypeGuard(
  checkIsTranslationType,
  Object.values(TranslationType),
);

export function md5(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

export function printObject(name: string, obj: unknown, space = 4) {
  logTrace("utils", `${name}: ${JSON.stringify(obj, null, space)}`);
}
