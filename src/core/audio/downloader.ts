/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { x } from "tinyexec";

import { timedFetch } from "@/utils/http";
import { logError, logTrace } from "@/utils/logger";

const audioDirPath = `${environment.supportPath}/audio`;

/**
 * Get cached audio file path for a word.
 * Priority: .m4a > .mp3
 */
export function getWordAudioPath(word: string): string {
  if (!fs.existsSync(audioDirPath)) {
    fs.mkdirSync(audioDirPath);
  }

  const m4aPath = path.join(audioDirPath, `${word}.m4a`);
  if (fs.existsSync(m4aPath)) {
    return m4aPath;
  }

  return path.join(audioDirPath, `${word}.mp3`);
}

/**
 * Convert WAV to M4A using afconvert (macOS).
 * Returns m4a path on success, undefined on failure.
 */
async function convertWavToM4a(wavPath: string, m4aPath: string): Promise<string | undefined> {
  if (process.platform !== "darwin") {
    return undefined;
  }

  logTrace("AudioDownloader", "converting wav→m4a");

  try {
    await x("afconvert", ["-f", "m4af", "-d", "aac", wavPath, m4aPath], { throwOnError: true });
    fs.unlinkSync(wavPath);
    logTrace("AudioDownloader", "conversion complete");
    return m4aPath;
  } catch {
    logError("AudioDownloader", "conversion failed");
    return undefined;
  }
}

/**
 * Download audio file from URL.
 * Detects actual file type from the buffer before writing to disk.
 * On macOS, WAV files are automatically converted to M4A.
 */
export async function downloadAudio(
  url: string,
  audioPath: string,
  options?: { forceDownload?: boolean; signal?: AbortSignal },
): Promise<void> {
  const { forceDownload = false, signal } = options || {};
  if (fs.existsSync(audioPath) && !forceDownload) {
    logTrace("AudioDownloader", `cached: ${audioPath}`);
    return;
  }

  logTrace("AudioDownloader", `downloading: ${audioPath}`);

  try {
    const blob = await timedFetch(url, { responseType: "blob", signal });
    const buffer = Buffer.from(await blob.arrayBuffer());

    const type = await fileTypeFromBuffer(buffer);
    const ext = type?.ext;

    if (ext === "wav" && process.platform === "darwin") {
      const wavPath = audioPath.replace(/\.mp3$|\.m4a$/, ".wav");
      const m4aPath = audioPath.replace(/\.mp3$|\.wav$/, ".m4a");
      fs.writeFileSync(wavPath, buffer);
      await convertWavToM4a(wavPath, m4aPath);
    } else {
      // Write as the actual detected type (or fallback to original path)
      const targetPath =
        ext && ext !== path.extname(audioPath).slice(1) ? audioPath.replace(/\.[^.]+$/, `.${ext}`) : audioPath;
      fs.writeFileSync(targetPath, buffer);
    }
  } catch (error) {
    if (error instanceof Error && (error.message === "canceled" || error.name === "AbortError")) {
      logTrace("AudioDownloader", "download canceled");
      return;
    }

    logError("AudioDownloader", "download failed");
  }
}

/**
 * Download word audio by URL.
 */
export async function downloadWordAudioWithURL(
  word: string,
  url: string,
  options?: { forceDownload?: boolean; signal?: AbortSignal },
): Promise<void> {
  logTrace("AudioDownloader", `download: ${word}`);
  const audioPath = getWordAudioPath(word);
  await downloadAudio(url, audioPath, options);
}
