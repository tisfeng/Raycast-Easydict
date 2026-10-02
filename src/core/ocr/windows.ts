/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { execFile, type ExecFileException } from "node:child_process";
import path from "node:path";

import { environment } from "@raycast/api";

import { CancelledError } from "@/shared/errors";
import { logError } from "@/shared/logger";

const RECOGNITION_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

const CANCELLED_EXIT_CODE = 2;
const LANGUAGE_UNAVAILABLE_EXIT_CODE = 3;

type RuntimeFailure = ExecFileException & { stderr?: string };

interface PowerShellResult {
  stdout: string;
  stderr: string;
}

/** Windows PowerShell 5.1 ships with Windows 10 and 11. */
function powershellPath(): string {
  const windowsRoot = [process.env.SystemRoot, process.env.WINDIR].find(
    (value): value is string => typeof value === "string" && /^[A-Za-z]:[\\/]/.test(value),
  );
  return path.win32.resolve(windowsRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

/**
 * Runs the bundled capture + OCR helper through an absolute PowerShell path,
 * never through PATH, so the executable cannot be shadowed.
 */
function runHelper(args: string[]): Promise<PowerShellResult> {
  return new Promise((resolve, reject) => {
    execFile(
      powershellPath(),
      args,
      {
        encoding: "utf8",
        timeout: RECOGNITION_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function toRecognitionError(error: unknown): Error {
  const failure = (error ?? {}) as RuntimeFailure;

  if (failure.code === CANCELLED_EXIT_CODE) return new CancelledError();
  if (failure.code === LANGUAGE_UNAVAILABLE_EXIT_CODE) {
    return new Error("No Windows OCR language available. Install a language pack in Windows Settings.");
  }
  if (failure.killed || failure.signal) {
    return new Error("Windows text recognition timed out.");
  }
  if (failure.code === "ENOENT") {
    return new Error("Windows PowerShell could not be started.");
  }

  logError("OCR", `Windows recognition failed: ${failure.stderr || failure.message}`);
  return new Error("Failed to recognize text on Windows.");
}

/**
 * Captures a screen region and recognizes its text with the built-in
 * Windows.Media.Ocr engine through the bundled PowerShell helper.
 *
 * Throws CancelledError when the user closes the selection overlay, and a
 * user-facing Error for other failures.
 */
export async function recognizeTextWindows(): Promise<string> {
  const scriptPath = path.join(environment.assetsPath, "ocr.ps1");

  let stdout: string;
  try {
    ({ stdout } = await runHelper([
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ]));
  } catch (error) {
    throw toRecognitionError(error);
  }

  return stdout.replace(/\r\n/g, "\n").trim();
}
