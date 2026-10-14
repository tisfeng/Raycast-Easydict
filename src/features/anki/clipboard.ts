import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, win32 } from "node:path";

import { environment } from "@raycast/api";

import { imageToken } from "./context";
import type { CaptureDraft } from "./model";

type ClipboardPayload = { kind: "text"; text: string } | { kind: "image"; bytes: Buffer } | { kind: "empty" };
export function decodeClipboard(raw: string): ClipboardPayload {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("kind" in value)) throw new Error("Invalid clipboard response.");
  if (value.kind === "empty") return { kind: "empty" };
  if (value.kind === "text" && "text" in value && typeof value.text === "string")
    return { kind: "text", text: value.text };
  if (
    value.kind === "image" &&
    "data" in value &&
    typeof value.data === "string" &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value.data)
  ) {
    const bytes = Buffer.from(value.data, "base64");
    if (bytes.length > 10 * 1024 * 1024) throw new Error("Clipboard image exceeds 10 MB.");
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { kind: "image", bytes };
  }
  throw new Error("Clipboard did not contain a supported image or text.");
}
export function clipboardCommand(platform: string, assetsPath: string): { file: string; args: string[] } {
  if (platform === "darwin") return { file: join(assetsPath, "capture-clipboard"), args: [] };
  if (platform === "win32") {
    const root =
      [process.env.SystemRoot, process.env.WINDIR].find((value) => value && /^[A-Za-z]:[\\/]/.test(value)) ||
      "C:\\Windows";
    return {
      file: win32.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(assetsPath, "capture-clipboard.ps1"),
      ],
    };
  }
  throw new Error("Context clipboard paste is supported on macOS and Windows.");
}
async function readClipboard(): Promise<ClipboardPayload> {
  const command = clipboardCommand(process.platform, environment.assetsPath);
  return new Promise((resolve, reject) => {
    execFile(
      command.file,
      command.args,
      { encoding: "utf8", timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              "Could not read clipboard. Copy text or an image and retry. If the helper is missing, rebuild it with npm run build:clipboard.",
            ),
          );
          return;
        }
        try {
          resolve(decodeClipboard(stdout));
        } catch (cause) {
          reject(cause);
        }
      },
    );
  });
}
export async function pasteContext(draft: CaptureDraft): Promise<Partial<CaptureDraft>> {
  const payload = await readClipboard();
  if (payload.kind === "empty") throw new Error("Clipboard is empty or unsupported. Copy text or an image first.");
  if (payload.kind === "text") return { context: [draft.context, payload.text].filter(Boolean).join("\n\n") };
  const dir = join(environment.supportPath, "capture-images");
  const path = join(dir, `${createHash("sha256").update(payload.bytes).digest("hex")}.png`);
  if (!draft.images.includes(path) && draft.images.length >= 10) throw new Error("Keep at most 10 images in Context.");
  await mkdir(dir, { recursive: true });
  await writeFile(path, payload.bytes, { mode: 0o600 });
  const token = imageToken(path);
  return {
    context: draft.context.includes(token) ? draft.context : [draft.context, token].filter(Boolean).join("\n\n"),
    images: [...new Set([...draft.images, path])],
  };
}
