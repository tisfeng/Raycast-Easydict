import { describe, expect, it, vi } from "vitest";

import { decodeMacOcr, ocrSourceLanguage } from "./mac";

vi.mock("@raycast/api", () => ({ environment: { assetsPath: "/assets" } }));
const payload = {
  version: 1,
  status: "recognized",
  text: "A large grouper hovered beside the reef.",
  captureMs: 500,
  recognitionMs: 100,
  language: "en",
  confidence: 0.99,
};
describe("macOS OCR protocol and language handoff", () => {
  it("decodes local OCR timing and a confident source language", () => {
    const result = decodeMacOcr(JSON.stringify(payload));
    expect(result).toMatchObject({ status: "recognized", text: payload.text, captureMs: 500, recognitionMs: 100 });
    expect(ocrSourceLanguage(result, "accurate")).toBe("en");
  });
  it.each(["cancelled", "no-text"])(
    "treats %s as an outcome instead of reading a previous clipboard image",
    (status) => {
      expect(decodeMacOcr(JSON.stringify({ ...payload, status, text: undefined }))).toEqual({
        status,
        captureMs: 500,
        recognitionMs: 100,
      });
    },
  );
  it.each([{ version: 2 }, { status: "unknown" }, { captureMs: -1 }, { recognitionMs: "100" }, { text: " " }])(
    "rejects invalid helper responses: %o",
    (patch) => {
      expect(() => decodeMacOcr(JSON.stringify({ ...payload, ...patch }))).toThrow();
    },
  );
  it("maps native Chinese language codes to the existing query identifiers", () => {
    const result = decodeMacOcr(
      JSON.stringify({ ...payload, text: "苹果系统可以识别中文和英文", language: "zh-Hans" }),
    );
    expect(ocrSourceLanguage(result, "accurate")).toBe("zh-CHS");
  });
  it("does not trust short or low-confidence guesses from local language detection", () => {
    expect(ocrSourceLanguage(decodeMacOcr(JSON.stringify({ ...payload, text: "charge" })), "accurate")).toBeUndefined();
    expect(
      ocrSourceLanguage(decodeMacOcr(JSON.stringify({ ...payload, confidence: 0.4 })), "accurate"),
    ).toBeUndefined();
    expect(
      ocrSourceLanguage(decodeMacOcr(JSON.stringify({ ...payload, language: "unsupported" })), "accurate"),
    ).toBeUndefined();
  });
  it.each(["grouper", "‘grouper’"])(
    "uses the explicit English mode for %s, including typographic punctuation",
    (text) => {
      expect(ocrSourceLanguage(decodeMacOcr(JSON.stringify({ ...payload, text, confidence: 0.2 })), "fast")).toBe("en");
    },
  );
});
