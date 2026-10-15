import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type * as MacOcr from "@/core/ocr/mac";

import command from "./ocr";

const mock = vi.hoisted(() => ({
  mac: vi.fn(),
  windows: vi.fn(),
  close: vi.fn(),
  launch: vi.fn(),
  hud: vi.fn(),
  mode: "accurate",
}));
vi.mock("@raycast/api", () => ({
  environment: { assetsPath: "/assets", isDevelopment: false },
  getPreferenceValues: () => ({ language1: "zh-CHS", language2: "en", ocrRecognitionMode: mock.mode }),
  closeMainWindow: mock.close,
  launchCommand: mock.launch,
  showHUD: mock.hud,
  LaunchType: { UserInitiated: "userInitiated" },
}));
vi.mock("@/core/ocr/mac", async (original) => ({
  ...(await original<typeof MacOcr>()),
  recognizeMac: mock.mac,
}));
vi.mock("@/core/ocr/windows", () => ({ recognizeWindows: mock.windows }));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
beforeEach(() => {
  vi.clearAllMocks();
  mock.mode = "accurate";
  Object.defineProperty(process, "platform", { value: "darwin" });
});
afterEach(() => Object.defineProperty(process, "platform", platform));

it("hands confident local OCR language to lookup without another network detection request", async () => {
  mock.mac.mockResolvedValue({
    status: "recognized",
    text: "A large grouper hovered beside the reef.",
    language: "en",
    confidence: 0.99,
    captureMs: 500,
    recognitionMs: 100,
  });
  await command();
  expect(mock.mac).toHaveBeenCalledWith("accurate");
  expect(mock.launch).toHaveBeenCalledWith({
    name: "easydict",
    type: "userInitiated",
    arguments: { queryText: "A large grouper hovered beside the reef." },
    context: { ocrSourceLanguage: "en" },
  });
  expect(mock.close).toHaveBeenCalledTimes(1);
});
it.each(["cancelled", "no-text"])("does not launch a lookup for %s", async (status) => {
  mock.mac.mockResolvedValue({ status, captureMs: 0, recognitionMs: 0 });
  await command();
  expect(mock.launch).not.toHaveBeenCalled();
  if (status === "cancelled") expect(mock.hud).not.toHaveBeenCalled();
});
it("preserves remote detection for an ambiguous short word", async () => {
  mock.mac.mockResolvedValue({
    status: "recognized",
    text: "charge",
    language: "fr",
    confidence: 0.7,
    captureMs: 1,
    recognitionMs: 1,
  });
  await command();
  expect(mock.launch.mock.calls[0][0]).not.toHaveProperty("context");
});
it("keeps the Windows OCR path unchanged", async () => {
  Object.defineProperty(process, "platform", { value: "win32" });
  mock.windows.mockResolvedValue({ status: "recognized", text: "Windows recognized text" });
  await command();
  expect(mock.mac).not.toHaveBeenCalled();
  expect(mock.windows).toHaveBeenCalledWith("area");
  expect(mock.launch.mock.calls[0][0].arguments.queryText).toBe("Windows recognized text");
});
