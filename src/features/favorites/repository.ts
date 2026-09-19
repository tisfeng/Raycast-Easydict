/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { environment, LocalStorage } from "@raycast/api";

import { decodeDisplaySections } from "@/core/results/decode";
import { normalizeError } from "@/shared/errors";

import { favoriteKeyOf, type FavoriteWord } from "./model";

const FAVORITE_WORDS_KEY = "favorite-words";

type StoredValue = string | number | boolean;
export type FavoriteStorageState =
  | { kind: "ready"; favorites: FavoriteWord[]; raw: StoredValue | undefined }
  | { kind: "invalid" | "unsupported"; message: string; raw: StoredValue }
  | { kind: "error"; message: string };

/** The unversioned array is the current durable format; future envelopes stay read-only. */
export function decodeFavoriteStorage(raw: StoredValue | undefined): FavoriteStorageState {
  if (raw === undefined) return { kind: "ready", favorites: [], raw };
  try {
    if (typeof raw !== "string") throw new Error("Saved favorites must be a JSON array.");
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && !Array.isArray(value) && "version" in value) {
      return {
        kind: "unsupported",
        raw,
        message: "This favorites format requires a compatible version of Easydict. Your data is unchanged.",
      };
    }
    if (!Array.isArray(value)) throw new Error("Saved favorites must be a JSON array.");
    return { kind: "ready", raw, favorites: value.map(decodeFavorite) };
  } catch (error) {
    return {
      kind: "invalid",
      raw,
      message: `${normalizeError(error).message} Your saved data is unchanged. Export it or restore a valid backup in Favorite Words.`,
    };
  }
}

function decodeFavorite(value: unknown): FavoriteWord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid favorite entry.");
  if (
    !("word" in value) ||
    typeof value.word !== "string" ||
    !("fromLanguage" in value) ||
    typeof value.fromLanguage !== "string" ||
    !("toLanguage" in value) ||
    typeof value.toLanguage !== "string" ||
    !("createdAt" in value) ||
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    !("displaySections" in value)
  ) {
    throw new Error("Invalid favorite identity or creation time.");
  }
  const isWord = "isWord" in value ? value.isWord : undefined;
  if (isWord !== undefined && typeof isWord !== "boolean") throw new Error("Invalid favorite word classification.");
  const translations = "translations" in value ? value.translations : undefined;
  if (
    translations !== undefined &&
    (!Array.isArray(translations) || !translations.every((text): text is string => typeof text === "string"))
  ) {
    throw new Error("Invalid favorite translation preview.");
  }
  return {
    word: value.word,
    fromLanguage: value.fromLanguage,
    toLanguage: value.toLanguage,
    isWord,
    createdAt: value.createdAt,
    translations,
    displaySections: decodeDisplaySections(value.displaySections),
  };
}

export async function readFavoriteWords(): Promise<FavoriteStorageState> {
  try {
    return decodeFavoriteStorage(await LocalStorage.getItem(FAVORITE_WORDS_KEY));
  } catch (error) {
    return { kind: "error", message: `Unable to read favorites: ${normalizeError(error).message}` };
  }
}

// Serialize mutations in this command instance; each mutation also reads current shared storage.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const pending = writeQueue.then(operation, operation);
  writeQueue = pending.catch(() => undefined);
  return pending;
}

async function mutateFavorites(update: (favorites: FavoriteWord[]) => FavoriteWord[]): Promise<void> {
  return enqueue(async () => {
    const state = await readFavoriteWords();
    if (state.kind !== "ready") throw new Error(state.message);
    await LocalStorage.setItem(FAVORITE_WORDS_KEY, JSON.stringify(update(state.favorites)));
  });
}

export function toggleFavoriteWord(entry: FavoriteWord): Promise<void> {
  const key = favoriteKeyOf(entry);
  return mutateFavorites((favorites) =>
    favorites.some((item) => favoriteKeyOf(item) === key)
      ? favorites.filter((item) => favoriteKeyOf(item) !== key)
      : [entry, ...favorites],
  );
}

export function removeFavoriteWord(
  identity: Pick<FavoriteWord, "word" | "fromLanguage" | "toLanguage">,
): Promise<void> {
  const key = favoriteKeyOf(identity);
  return mutateFavorites((favorites) => favorites.filter((item) => favoriteKeyOf(item) !== key));
}

export function clearFavoriteWords(): Promise<void> {
  return mutateFavorites(() => []);
}

async function writeBackup(raw: StoredValue): Promise<string> {
  const directory = join(environment.supportPath, "favorite-backups");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `favorites-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`);
  await writeFile(path, typeof raw === "string" ? raw : JSON.stringify(raw), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return path;
}

export async function exportFavoriteWords(): Promise<string> {
  const state = await readFavoriteWords();
  if (state.kind === "error") throw new Error(state.message);
  if (state.raw === undefined) throw new Error("There is no saved favorites data to export.");
  return writeBackup(state.raw);
}

/** Restore only an explicitly selected valid backup, after preserving the current raw value. */
export async function restoreFavoriteWords(path: string): Promise<string | undefined> {
  const raw = await readFile(path, "utf8");
  const restored = decodeFavoriteStorage(raw);
  if (restored.kind !== "ready") throw new Error("The selected file is not a valid favorites backup for this version.");
  return enqueue(async () => {
    const current = await readFavoriteWords();
    if (current.kind === "error" || current.kind === "unsupported") throw new Error(current.message);
    const backupPath = current.raw === undefined ? undefined : await writeBackup(current.raw);
    // File I/O can outlive a change made by another command. Do not replace that newer value.
    if ((await LocalStorage.getItem(FAVORITE_WORDS_KEY)) !== current.raw) {
      throw new Error("Favorites changed while preparing the backup. Reload and try restoring again.");
    }
    await LocalStorage.setItem(FAVORITE_WORDS_KEY, raw);
    return backupPath;
  });
}
