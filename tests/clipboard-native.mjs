// Runs image conversion against a fixture; never opens the desktop clipboard.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "easydict-native-fixture-"));
function chunk(type, data) {
  const contents = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, contents, checksum]);
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const header = Buffer.alloc(13);
header.writeUInt32BE(1, 0);
header.writeUInt32BE(1, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  signature,
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
  chunk("IEND", Buffer.alloc(0)),
]);
const valid = join(dir, "fixture.png"),
  invalid = join(dir, "invalid.png");
const helper = process.platform === "darwin" ? join(root, "assets/capture-clipboard") : "powershell.exe";
const args = (path) =>
  process.platform === "darwin"
    ? ["--fixture-image", path]
    : [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "assets/capture-clipboard.ps1"),
        "-FixtureImage",
        path,
      ];
try {
  if (!["darwin", "win32"].includes(process.platform)) throw new Error("Run this fixture check on macOS or Windows.");
  writeFileSync(valid, png);
  writeFileSync(invalid, "not an image");
  const payload = JSON.parse(execFileSync(helper, args(valid), { encoding: "utf8", timeout: 10000 }));
  assert.equal(payload.kind, "image");
  assert(Buffer.from(payload.data, "base64").subarray(0, 8).equals(signature));
  assert.notEqual(spawnSync(helper, args(invalid), { timeout: 10000 }).status, 0);
  console.log("Native image helper: valid PNG converted; unreadable input rejected. Desktop clipboard untouched.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
