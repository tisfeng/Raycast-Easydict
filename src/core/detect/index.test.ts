import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DetectedLangModel } from "@/core/detect/types";
import { BaseDetectProvider, type DetectOptions } from "@/providers/detect/base";
import type { DetectServiceConfig } from "@/providers/detect/registry";
import { LanguageDetectType } from "@/types/api";
import { CancelledError } from "@/utils/errors";

import { detectLanguage } from "./index";

const testDoubles = vi.hoisted(() => ({
  detectServices: [] as DetectServiceConfig[],
  loserAborted: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  timerFail: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  getPreferenceValues: () => ({}),
}));

vi.mock("@/core/config", () => ({
  config: {
    enableDetectLanguageSpeedFirst: false,
    preferredLanguages: [{ youdaoLangCode: "en" }, { youdaoLangCode: "zh-CHS" }],
  },
}));

vi.mock("@/providers/detect/registry", () => ({
  detectServices: testDoubles.detectServices,
}));

vi.mock("@/utils/logger", () => ({
  createTimer: () => ({ done: vi.fn(), fail: testDoubles.timerFail }),
  logError: testDoubles.logError,
  logSummary: vi.fn(),
  logTrace: vi.fn(),
  logWarn: testDoubles.logWarn,
}));

class CancelledRemoteDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Bing;

  isEnabled() {
    return true;
  }

  protected async doDetect(): Promise<DetectedLangModel> {
    throw new CancelledError();
  }
}

class CancelledLocalDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Franc;
  isLocal = true;

  isEnabled() {
    return true;
  }

  protected async doDetect(): Promise<DetectedLangModel> {
    throw new CancelledError();
  }
}

class WinningDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Google;

  isEnabled() {
    return true;
  }

  protected async doDetect(): Promise<DetectedLangModel> {
    return {
      type: this.type,
      sourceLangCode: "en",
      youdaoLangCode: "en",
      confirmed: false,
    };
  }
}

class LosingDetectProvider extends BaseDetectProvider {
  type = LanguageDetectType.Bing;

  isEnabled() {
    return true;
  }

  protected doDetect(_text: string, options?: DetectOptions): Promise<DetectedLangModel> {
    return new Promise((_, reject) => {
      const handleAbort = () => {
        testDoubles.loserAborted();
        reject(new DOMException("This operation was aborted", "AbortError"));
      };

      if (options?.signal?.aborted) {
        handleAbort();
      } else {
        options?.signal?.addEventListener("abort", handleAbort, { once: true });
      }
    });
  }
}

beforeEach(() => {
  testDoubles.loserAborted.mockReset();
  testDoubles.logError.mockReset();
  testDoubles.logWarn.mockReset();
  testDoubles.timerFail.mockReset();
  testDoubles.detectServices.splice(
    0,
    testDoubles.detectServices.length,
    { type: LanguageDetectType.Bing, provider: CancelledRemoteDetectProvider },
    { type: LanguageDetectType.Franc, provider: CancelledLocalDetectProvider },
  );
});

describe("detectLanguage cancellation", () => {
  it("cancels unfinished remote detectors after a confirmed result wins", async () => {
    testDoubles.detectServices.splice(
      0,
      testDoubles.detectServices.length,
      { type: LanguageDetectType.Google, provider: WinningDetectProvider },
      { type: LanguageDetectType.Bing, provider: LosingDetectProvider },
    );

    const result = await detectLanguage("testimony");

    expect(result.type).toBe(LanguageDetectType.Google);
    expect(testDoubles.loserAborted).toHaveBeenCalledOnce();
    expect(testDoubles.logError).not.toHaveBeenCalled();
    expect(testDoubles.timerFail).not.toHaveBeenCalled();
  });

  it("does not report expected cancellation as an error or all-provider failure", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await detectLanguage("testimony", controller.signal);

    expect(result.youdaoLangCode).toBe("en");
    expect(testDoubles.logError).not.toHaveBeenCalled();
    expect(testDoubles.logWarn).not.toHaveBeenCalled();
  });
});
