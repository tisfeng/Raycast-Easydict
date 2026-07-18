import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DetectedLangModel } from "@/core/detect/types";
import { BaseDetectProvider } from "@/providers/detect/base";
import type { DetectServiceConfig } from "@/providers/detect/registry";
import { LanguageDetectType } from "@/types/api";
import { CancelledError } from "@/utils/errors";

import { detectLanguage } from "./index";

const testDoubles = vi.hoisted(() => ({
  detectServices: [] as DetectServiceConfig[],
  logError: vi.fn(),
  logWarn: vi.fn(),
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
  createTimer: () => ({ done: vi.fn(), fail: vi.fn() }),
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

beforeEach(() => {
  testDoubles.logError.mockReset();
  testDoubles.logWarn.mockReset();
  testDoubles.detectServices.splice(
    0,
    testDoubles.detectServices.length,
    { type: LanguageDetectType.Bing, provider: CancelledRemoteDetectProvider },
    { type: LanguageDetectType.Franc, provider: CancelledLocalDetectProvider },
  );
});

describe("detectLanguage cancellation", () => {
  it("does not report expected cancellation as an error or all-provider failure", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await detectLanguage("testimony", controller.signal);

    expect(result.youdaoLangCode).toBe("en");
    expect(testDoubles.logError).not.toHaveBeenCalled();
    expect(testDoubles.logWarn).not.toHaveBeenCalled();
  });
});
