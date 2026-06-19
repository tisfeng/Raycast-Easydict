/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { environment } from "@raycast/api";
import { runPowerShellScript } from "@raycast/utils";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import playerImport from "play-sound";
import { x } from "tinyexec";

import { languageItemList } from "@/core/language/consts";
import { timedFetch } from "@/utils/http";
import { logError, logTrace, logWarn } from "@/utils/logger";
import { trimTextLength } from "@/utils/text";

const audioDirPath = `${environment.supportPath}/audio`;

// Audio Player Instance (macOS only)

let audioPlayer: ReturnType<typeof playerImport>;

function getAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = playerImport({});
  }
  return audioPlayer;
}

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

async function isWavFile(filePath: string): Promise<boolean> {
  const fileType = await fileTypeFromFile(filePath);
  return fileType?.ext === "wav";
}

/**
 * Convert WAV to M4A using afconvert (macOS).
 * Returns m4a path on success, undefined on failure or if not WAV.
 */
async function convertToM4aIfNeeded(filePath: string): Promise<string | undefined> {
  if (process.platform !== "darwin") {
    return undefined;
  }

  if (!(await isWavFile(filePath))) {
    return undefined;
  }

  logTrace("audio", "converting wav→m4a");

  const m4aPath = filePath.replace(/\.mp3$|\.wav$/, ".m4a");
  const wavPath = filePath.endsWith(".mp3") ? filePath.replace(".mp3", ".wav") : filePath;

  // Rename if needed before conversion
  if (filePath !== wavPath) {
    fs.renameSync(filePath, wavPath);
  }

  try {
    await x("afconvert", ["-f", "m4af", "-d", "aac", wavPath, m4aPath], { throwOnError: true });
    fs.unlinkSync(wavPath);
    logTrace("audio", "conversion complete");
    return m4aPath;
  } catch {
    logError("audio", "conversion failed");
    return undefined;
  }
}

/**
 * Play text using macOS say command.
 * @param text - Text to speak
 * @param youdaoLanguageId - Language ID for voice selection
 */
function sayCommand(text: string, youdaoLanguageId: string) {
  if (process.platform !== "darwin") {
    logWarn("audio", "Apple TTS only supported on macOS");
    return;
  }

  if (!youdaoLanguageId || !text) {
    return;
  }

  const languageItem = languageItemList.find((item) => item.youdaoLangCode === youdaoLanguageId);
  if (!languageItem?.voiceList) {
    logWarn("audio", `language not supported: ${youdaoLanguageId}`);
    return;
  }

  const voice = languageItem.voiceList[0];
  const cleanText = text.replace(/"/g, " ");

  logTrace("audio", `say -v ${voice}`);
  x("say", ["-v", voice, cleanText]).then((result) => {
    if (result.stderr) logError("audio", `say command failed: ${result.stderr}`);
  });
}

/**
 * Play text with truncation (max 40 chars).
 */
export function sayTruncateCommand(text: string, youdaoLanguageId: string) {
  const truncated = trimTextLength(text, 40);
  sayCommand(truncated, youdaoLanguageId);
}

/**
 * Windows: use MCI (Media Control Interface) via winmm.dll.
 * Note: play-sound uses PowerShell to spawn default player,
 * if default player is Windows Media Player, it will open a visible window.
 * Using mciSendString plays audio in background without popup.
 */
function playOnWindows(audioPath: string) {
  const safePath = audioPath.replace(/\\/g, "\\\\").replace(/"/g, '""');

  runPowerShellScript(`
if (-not ([System.Management.Automation.PSTypeName]'Audio').Type) {
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class Audio {
    [DllImport("winmm.dll")]
    public static extern int mciSendString(string command, string buffer, int bufferSize, int hwndCallback);
}
'@
}
[Audio]::mciSendString("play \`"${safePath}\`" wait", $null, 0, 0)
  `).catch((err) => {
    logError("audio", `PowerShell play failed: ${err}`);
  });
}

function playOnMac(audioPath: string, word: string, language: string) {
  getAudioPlayer().play(audioPath, (err: { killed?: boolean }) => {
    if (err) {
      if (err.killed) {
        logTrace("audio", "killed previous playback");
        return;
      }
      logError("audio", `play error: ${err}`);
      sayTruncateCommand(word, language);
    }
  });
}

/**
 * Play word audio.
 * 1. Check if file exists
 * 2. Windows: use PowerShell mciSendString
 * 3. macOS: convert WAV→M4A if needed, use afplay
 * 4. Fallback to TTS on error
 */
export async function playWordAudio(word: string, fromLanguage: string, useSayCommand = true): Promise<void> {
  let audioPath = getWordAudioPath(word);

  if (!fs.existsSync(audioPath)) {
    logTrace("audio", `file not found: ${word}`);
    if (useSayCommand) {
      sayTruncateCommand(word, fromLanguage);
    }
    return;
  }

  logTrace("audio", `play: ${path.basename(audioPath)}`);

  // Windows: use mciSendString (no window popup)
  if (process.platform === "win32") {
    playOnWindows(audioPath);
    return;
  }

  // macOS: afplay with WAV→M4A conversion if needed
  if (process.platform === "darwin") {
    const convertedPath = await convertToM4aIfNeeded(audioPath);
    if (convertedPath) {
      audioPath = convertedPath;
    }
    playOnMac(audioPath, word, fromLanguage);
    return;
  }

  logWarn("audio", `unsupported platform: ${process.platform}`);
}

/**
 * Download audio file from URL.
 * Converts WAV to M4A on macOS after download.
 */
export async function downloadAudio(
  url: string,
  audioPath: string,
  callback?: () => void,
  forceDownload = false,
): Promise<void> {
  if (fs.existsSync(audioPath) && !forceDownload) {
    logTrace("audio", `cached: ${audioPath}`);
    callback?.();
    return;
  }

  logTrace("audio", `downloading: ${audioPath}`);

  try {
    const blob = await timedFetch(url, { responseType: "blob" });
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(audioPath, buffer);

    await convertToM4aIfNeeded(audioPath);
    callback?.();
  } catch (error) {
    if (error instanceof Error && (error.message === "canceled" || error.name === "AbortError")) {
      logTrace("audio", "download canceled");
      return;
    }

    logError("audio", "download failed");
  }
}

/**
 * Download word audio by URL.
 */
export function downloadWordAudioWithURL(word: string, url: string, callback?: () => void, forceDownload = false) {
  logTrace("audio", `download: ${word}`);
  const audioPath = getWordAudioPath(word);
  downloadAudio(url, audioPath, callback, forceDownload);
}
