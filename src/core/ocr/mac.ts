import { execFile } from "node:child_process";
import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { environment } from "@raycast/api";

import type { LanguageCode } from "@/core/language/types";
import { isLanguageCode } from "@/core/language/utils";

export type OcrMode = "fast" | "accurate";
export type MacOcrResult =
  | { status: "cancelled" | "no-text"; captureMs: number; recognitionMs: number }
  | {
      status: "recognized";
      text: string;
      language?: string;
      confidence?: number;
      recognitionMode?: OcrMode;
      captureMs: number;
      recognitionMs: number;
    };

const execute = promisify(execFile);
export function decodeMacOcr(raw: string): MacOcrResult {
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("status" in value) ||
    !["recognized", "cancelled", "no-text"].includes(String(value.status)) ||
    !("captureMs" in value) ||
    typeof value.captureMs !== "number" ||
    !Number.isFinite(value.captureMs) ||
    value.captureMs < 0 ||
    !("recognitionMs" in value) ||
    typeof value.recognitionMs !== "number" ||
    !Number.isFinite(value.recognitionMs) ||
    value.recognitionMs < 0
  ) {
    throw new Error("The macOS OCR helper returned an invalid response.");
  }
  const timing = { captureMs: value.captureMs, recognitionMs: value.recognitionMs };
  if (value.status === "cancelled" || value.status === "no-text") return { status: value.status, ...timing };
  if (!("text" in value) || typeof value.text !== "string" || !value.text.trim())
    throw new Error("OCR returned no readable text.");
  const language = "language" in value && typeof value.language === "string" ? value.language : undefined;
  const confidence =
    "confidence" in value &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1
      ? value.confidence
      : undefined;
  const recognitionMode =
    "recognitionMode" in value && (value.recognitionMode === "fast" || value.recognitionMode === "accurate")
      ? value.recognitionMode
      : undefined;
  return { status: "recognized", text: value.text.trim(), language, confidence, recognitionMode, ...timing };
}

/** Only bypass network detection when the native result is sufficiently informative. */
export function ocrSourceLanguage(result: MacOcrResult, mode: OcrMode): LanguageCode | undefined {
  if (result.status !== "recognized") return undefined;
  const letters = result.text.match(/\p{L}/gu) ?? [];
  if (
    (result.recognitionMode ?? mode) === "fast" &&
    letters.length > 0 &&
    letters.every((letter) => /^[A-Za-z]$/.test(letter))
  )
    return "en";
  if ((result.confidence ?? 0) < 0.85 || letters.length < 12) return undefined;
  const language =
    result.language === "zh-Hans" ? "zh-CHS" : result.language === "zh-Hant" ? "zh-CHT" : result.language;
  return isLanguageCode(language) ? language : undefined;
}

export async function recognizeMac(mode: OcrMode): Promise<MacOcrResult> {
  const helper = join(environment.assetsPath, "recognizeText");
  await chmod(helper, 0o755);
  const { stdout } = await execute(helper, ["--mode", mode], {
    encoding: "utf8",
    timeout: 90_000,
    maxBuffer: 1024 * 1024,
  });
  return decodeMacOcr(stdout);
}
