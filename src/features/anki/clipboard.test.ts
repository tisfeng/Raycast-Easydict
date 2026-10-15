import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clipboardCommand, decodeClipboard, pasteContext } from "./clipboard";
import { imageToken } from "./context";
import { emptyDraft } from "./model";

const host = vi.hoisted(() => ({ output: "", support: "", error: false, exec: vi.fn() }));
vi.mock("@raycast/api", () => ({
  environment: {
    get supportPath() {
      return host.support;
    },
    assetsPath: "/assets",
  },
}));
vi.mock("node:child_process", () => ({ execFile: host.exec }));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=",
  "base64",
);
beforeEach(async () => {
  host.support = await mkdtemp(join(tmpdir(), "capture-clipboard-test-"));
  host.error = false;
  host.exec.mockReset();
  host.exec.mockImplementation((_file, _args, _options, callback) =>
    callback(host.error ? new Error("failed") : null, host.output),
  );
});
afterEach(async () => {
  await rm(host.support, { recursive: true, force: true });
});
describe("explicit clipboard capture", () => {
  it("snapshots copied image bytes into durable draft storage and inserts a marker", async () => {
    host.output = JSON.stringify({ kind: "image", data: png.toString("base64") });
    const patch = await pasteContext(emptyDraft("grouper"));
    expect(patch.images).toHaveLength(1);
    expect(await readFile(patch.images![0])).toEqual(png);
    expect(patch.context).toBe(imageToken(patch.images![0]));
    const again = await pasteContext({ ...emptyDraft(), ...patch });
    expect(again).toEqual(patch);
  });
  it("appends text into Context without creating image references", async () => {
    host.output = JSON.stringify({ kind: "text", text: "Source: lesson" });
    expect(await pasteContext({ ...emptyDraft(), context: "Original sentence" })).toEqual({
      context: "Original sentence\n\nSource: lesson",
    });
  });
  it("rejects unsupported, empty, and failed reads without changing the supplied draft", async () => {
    const draft = { ...emptyDraft(), context: "Keep" };
    host.output = JSON.stringify({ kind: "empty" });
    await expect(pasteContext(draft)).rejects.toThrow("empty");
    host.error = true;
    await expect(pasteContext(draft)).rejects.toThrow("Could not read clipboard");
    expect(draft.context).toBe("Keep");
    expect(() => decodeClipboard('{"kind":"image","data":"bogus"}')).toThrow();
  });
  it("uses a packaged helper on macOS and STA PowerShell on Windows", () => {
    expect(clipboardCommand("darwin", "/assets")).toEqual({ file: "/assets/capture-clipboard", args: [] });
    expect(clipboardCommand("win32", "/assets").args).toContain("-STA");
    expect(() => clipboardCommand("linux", "/assets")).toThrow("macOS and Windows");
  });
});
