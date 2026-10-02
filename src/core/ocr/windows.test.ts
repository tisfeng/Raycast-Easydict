/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CancelledError } from "@/shared/errors";
import { logError } from "@/shared/logger";

import { recognizeTextWindows } from "./windows";

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock("@raycast/api", () => ({ environment: { assetsPath: "/assets" } }));
vi.mock("@raycast/utils", () => ({ showFailureToast: vi.fn() }));
vi.mock("@/shared/logger", () => ({ logError: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: execFileMock }));

interface FakeExecError extends Error {
  code?: number | string;
  killed?: boolean;
  signal?: string | null;
}

type ExecCallback = (error: FakeExecError | null, stdout: string, stderr: string) => void;

const scriptPath = path.join("/assets", "ocr.ps1");

function mockExecution(handler: (args: string[], options: unknown, callback: ExecCallback) => void) {
  execFileMock.mockImplementation((...callArguments: unknown[]) => {
    const [file, args, options, callback] = callArguments;
    expect(typeof file).toBe("string");
    handler(args as string[], options, callback as ExecCallback);
    return undefined;
  });
}

beforeEach(() => {
  execFileMock.mockReset();
});

describe("recognizeTextWindows", () => {
  it("runs the bundled PowerShell helper and returns the recognized text", async () => {
    mockExecution((args, options, callback) => {
      expect(args).toEqual([
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ]);
      expect(options).toMatchObject({ encoding: "utf8", windowsHide: true, timeout: 300_000 });
      callback(null, "Hello world", "");
    });

    await expect(recognizeTextWindows()).resolves.toBe("Hello world");
  });

  it("normalizes CRLF line endings and trims surrounding whitespace", async () => {
    mockExecution((_args, _options, callback) => callback(null, "第一行\r\n第二行\r\n", ""));

    await expect(recognizeTextWindows()).resolves.toBe("第一行\n第二行");
  });

  it("reports cancellation when the user closes the selection overlay", async () => {
    mockExecution((_args, _options, callback) => callback(Object.assign(new Error("cancelled"), { code: 2 }), "", ""));

    await expect(recognizeTextWindows()).rejects.toBeInstanceOf(CancelledError);
  });

  it("explains how to fix a missing OCR language pack", async () => {
    mockExecution((_args, _options, callback) => callback(Object.assign(new Error("exit 3"), { code: 3 }), "", ""));

    await expect(recognizeTextWindows()).rejects.toThrow(/language pack/i);
  });

  it("reports a failed PowerShell start", async () => {
    mockExecution((_args, _options, callback) =>
      callback(Object.assign(new Error("spawn failed"), { code: "ENOENT" }), "", ""),
    );

    await expect(recognizeTextWindows()).rejects.toThrow(/PowerShell could not be started/);
  });

  it("reports a timeout when the helper is killed", async () => {
    mockExecution((_args, _options, callback) =>
      callback(Object.assign(new Error("timeout"), { killed: true }), "", ""),
    );

    await expect(recognizeTextWindows()).rejects.toThrow(/timed out/);
  });

  it("reports unexpected failures and logs the helper output", async () => {
    mockExecution((_args, _options, callback) =>
      callback(Object.assign(new Error("exit 5"), { code: 5, stderr: "boom" }), "", "boom"),
    );

    await expect(recognizeTextWindows()).rejects.toThrow("Failed to recognize text on Windows.");
    expect(logError).toHaveBeenCalledWith("OCR", expect.stringContaining("boom"));
  });
});
