/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";

const MAX_LOG_TEXT_LENGTH = 150;
const isDev = environment.isDevelopment;

function truncate(text: string, maxLen = MAX_LOG_TEXT_LENGTH): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + "[truncated]";
}

function formatMsg(prefix: string, label: string, text: string): string {
  return `${prefix} [${label}] ${truncate(text)}`;
}

export function logTrace(label: string, text: string) {
  if (!isDev) return;
  console.log(formatMsg("🔍", label, text));
}

export function logDebug(label: string, text: string) {
  if (!isDev) return;
  console.log(formatMsg("🐛", label, text));
}

export function logInfo(label: string, text: string) {
  if (!isDev) return;
  console.log(formatMsg("ℹ️", label, text));
}

export function logWarn(label: string, text: string) {
  if (!isDev) return;
  console.warn(formatMsg("⚠️", label, text));
}

export function logError(label: string, text: string) {
  if (!isDev) return;
  console.error(`❌ [${label}] ${text}`);
}
