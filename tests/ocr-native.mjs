// Generated fixtures only: never captures the desktop or reads/writes the clipboard.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin") throw new Error("Run native Vision fixture checks on macOS.");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const folder = mkdtempSync(join(tmpdir(), "easydict-ocr-fixture-"));
const helper = join(root, "assets/recognizeText");
try {
  const generator = join(folder, "fixture.swift");
  writeFileSync(
    generator,
    `
import AppKit
let folder = CommandLine.arguments[1]
for (name, text) in [("english", "A large grouper hovered beside the reef."), ("chinese", "苹果系统可以识别中文和英文"), ("blank", "")] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1100, pixelsHigh: 180, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: 1100, height: 180).fill()
    (text as NSString).draw(at: NSPoint(x: 30, y: 65), withAttributes: [.font: NSFont.systemFont(ofSize: 38), .foregroundColor: NSColor.black])
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: folder + "/" + name + ".png"))
}
`,
  );
  execFileSync("swift", [generator, folder], { timeout: 60_000 });
  const results = [];
  for (const mode of ["accurate", "fast"]) {
    const times = [];
    for (let sample = 0; sample < 3; sample++) {
      const started = performance.now();
      const payload = JSON.parse(
        execFileSync(helper, ["--fixture-image", join(folder, "english.png"), "--mode", mode], {
          encoding: "utf8",
          timeout: 30_000,
        }),
      );
      assert.equal(payload.status, "recognized");
      assert.match(payload.text, /grouper/i);
      assert.equal(payload.captureMs, 0);
      times.push({ totalMs: Math.round(performance.now() - started), visionMs: Math.round(payload.recognitionMs) });
    }
    results.push({ mode, samples: times });
  }
  const chinese = JSON.parse(
    execFileSync(helper, ["--fixture-image", join(folder, "chinese.png")], { encoding: "utf8", timeout: 30_000 }),
  );
  assert.equal(chinese.status, "recognized");
  assert.match(chinese.text, /苹果系统/);
  const blank = JSON.parse(
    execFileSync(helper, ["--fixture-image", join(folder, "blank.png")], { encoding: "utf8", timeout: 30_000 }),
  );
  assert.equal(blank.status, "no-text");
  const invalid = join(folder, "invalid.png");
  writeFileSync(invalid, "not an image");
  assert.notEqual(spawnSync(helper, ["--fixture-image", invalid], { timeout: 10_000 }).status, 0);
  assert.notEqual(spawnSync(helper, ["--mode", "invalid"], { timeout: 10_000 }).status, 0);
  console.log(
    JSON.stringify(
      { fixture: "English sentence, 1100×180 pixels", results, chinese: chinese.text, blank: blank.status },
      null,
      2,
    ),
  );
  console.log("Vision fixtures passed. No desktop capture, clipboard access, translation, or Anki writes.");
} finally {
  rmSync(folder, { recursive: true, force: true });
}
