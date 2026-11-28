import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, assert, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeferred } from "@/test-support/deferred";

import type { downloadAudio as downloadAudioFile } from "./downloader";

const testDoubles = vi.hoisted(() => ({
  timedFetch: vi.fn(),
  x: vi.fn(),
}));

vi.mock("tinyexec", () => ({ x: testDoubles.x }));
vi.mock("@/shared/http", () => ({ timedFetch: testDoubles.timedFetch }));
vi.mock("@raycast/api", () => ({ environment: { isDevelopment: false } }));

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
let tempDir: string;
let downloadAudio: typeof downloadAudioFile;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "easydict-audio-test-"));
  vi.doMock("@/consts", () => ({ EASYDICT_TMP_DIR: tempDir }));
  ({ downloadAudio } = await import("./downloader"));
});

afterAll(() => {
  vi.doUnmock("@/consts");
  if (tempDir) fs.rmSync(tempDir, { force: true, recursive: true });
});

beforeEach(() => {
  testDoubles.timedFetch.mockReset();
  testDoubles.x.mockReset();
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, "platform", originalPlatform);
  }
  fs.rmSync(path.join(tempDir, "audio"), { force: true, recursive: true });
});

describe("downloadAudio", () => {
  it("isolates concurrent WAV conversions and reuses the resulting M4A", async () => {
    const url = "https://example.com/audio.wav";
    const conversions: { inputPath: string; outputPath: string; finish: () => void }[] = [];
    Object.defineProperty(process, "platform", { value: "darwin" });
    const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    testDoubles.timedFetch.mockResolvedValue(new Blob([wavBytes]));
    testDoubles.x.mockImplementation((_command: string, args: string[]) => {
      const [inputPath, outputPath] = args.slice(-2);
      assert(inputPath && outputPath, "Expected afconvert input and output paths");
      const conversion = createDeferred<{ exitCode: number }>();
      conversions.push({
        inputPath,
        outputPath,
        finish: () => {
          fs.writeFileSync(outputPath, "converted audio");
          conversion.resolve({ exitCode: 0 });
        },
      });
      return Object.assign(conversion.promise, { aborted: false });
    });

    const firstDownload = downloadAudio(url);
    const secondDownload = downloadAudio(url);
    await vi.waitFor(() => expect(conversions).toHaveLength(2));

    const [firstConversion, secondConversion] = conversions;
    expect(firstConversion.inputPath).not.toBe(secondConversion.inputPath);
    expect(firstConversion.outputPath).not.toBe(secondConversion.outputPath);

    firstConversion.finish();
    const firstPath = await firstDownload;
    secondConversion.finish();
    const secondPath = await secondDownload;

    assert(firstPath, "Expected the cached audio path");
    expect(path.extname(firstPath)).toBe(".m4a");
    expect(secondPath).toBe(firstPath);
    expect(fs.readFileSync(firstPath, "utf8")).toBe("converted audio");
    expect(fs.readdirSync(path.join(tempDir, "audio"))).toEqual([path.basename(firstPath)]);

    await expect(downloadAudio(url)).resolves.toBe(firstPath);
    expect(testDoubles.timedFetch).toHaveBeenCalledTimes(2);
    expect(testDoubles.x).toHaveBeenCalledTimes(2);
  });

  it("downloads and caches audio independently for distinct URLs", async () => {
    const firstUrl = "https://example.com/audio-1.mp3";
    const secondUrl = "https://example.com/audio-2.mp3";
    testDoubles.timedFetch
      .mockResolvedValueOnce(new Blob(["ID3 first recording"]))
      .mockResolvedValueOnce(new Blob(["ID3 second recording"]));

    const firstPath = await downloadAudio(firstUrl);
    const secondPath = await downloadAudio(secondUrl);

    assert(firstPath && secondPath, "Expected both cached audio paths");
    expect(secondPath).not.toBe(firstPath);
    expect(testDoubles.timedFetch.mock.calls.map(([url]) => url)).toEqual([firstUrl, secondUrl]);
    expect(fs.readFileSync(firstPath, "utf8")).toBe("ID3 first recording");
    expect(fs.readFileSync(secondPath, "utf8")).toBe("ID3 second recording");
  });
});
