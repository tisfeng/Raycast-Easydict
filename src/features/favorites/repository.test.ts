import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { savedResultMarkdown } from "@/core/results/resultMarkdown";

import { copyAllText } from "./copyFavorites";
import { type FavoriteWord, resolveFavoriteTranslations } from "./model";
import {
  clearFavoriteWords,
  decodeFavoriteStorage,
  exportFavoriteWords,
  readFavoriteWords,
  restoreFavoriteWords,
  toggleFavoriteWord,
} from "./repository";

const runtime = vi.hoisted(() => ({
  storage: new Map<string, string | number | boolean>(),
  directory: "",
  failRead: false,
  failWrite: false,
}));
vi.mock("@raycast/api", () => ({
  environment: {
    get supportPath() {
      return runtime.directory;
    },
  },
  LocalStorage: {
    getItem: async (key: string) => {
      if (runtime.failRead) throw new Error("read failed");
      return runtime.storage.get(key);
    },
    setItem: async (key: string, value: string) => {
      if (runtime.failWrite) throw new Error("write failed");
      runtime.storage.set(key, value);
    },
  },
}));
vi.mock("@/core/results/appearance", () => ({ isDarkAppearance: () => false }));
const KEY = "favorite-words";
const info = { word: "hello", fromLanguage: "en", toLanguage: "zh-CHS" };
const favorite: FavoriteWord = { ...info, createdAt: 1, displaySections: [] };

beforeEach(async () => {
  runtime.storage.clear();
  runtime.failRead = false;
  runtime.failWrite = false;
  runtime.directory = await mkdtemp(join(tmpdir(), "easydict-favorites-test-"));
});
afterEach(async () => {
  await rm(runtime.directory, { recursive: true, force: true });
});

async function backupFile(contents: string): Promise<string> {
  const path = join(runtime.directory, "selected.json");
  await writeFile(path, contents, "utf8");
  return path;
}

describe("favorite storage boundary", () => {
  it("reads legacy AI headings and Linguee placeholders without rewriting storage", async () => {
    const raw = JSON.stringify([
      {
        ...info,
        createdAt: 1,
        displaySections: [
          {
            type: "Translation",
            items: [
              {
                queryType: "Linguee Dictionary",
                displayType: "Translation",
                queryWordInfo: info,
                key: "legacy",
                title: "hello",
                copyText: "hello hello",
              },
            ],
          },
          {
            type: "Definition",
            items: [
              {
                queryType: "AI Dictionary",
                displayType: "Definition",
                queryWordInfo: info,
                key: "sense",
                title: "你好",
                copyText: "你好",
                detailsMarkdown: "### 你好\n\nA greeting",
              },
            ],
          },
        ],
      },
    ]);
    runtime.storage.set(KEY, raw);
    const state = await readFavoriteWords();
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") throw new Error("Expected readable legacy favorites");
    expect(resolveFavoriteTranslations(state.favorites[0])).toBeUndefined();
    expect(savedResultMarkdown(state.favorites[0], state.favorites[0].displaySections)).toContain(
      "**你好**\n\nA greeting",
    );
    expect(copyAllText(state.favorites)).toBe("hello\t");
    expect(runtime.storage.get(KEY)).toBe(raw);
  });

  it.each([
    "{invalid",
    "{}",
    "null",
    "[null]",
    JSON.stringify([{ ...favorite, translations: [42] }]),
    JSON.stringify([favorite, { ...favorite, displaySections: "invalid" }]),
  ])("preserves malformed favorites and blocks all normal mutations: %s", async (raw) => {
    runtime.storage.set(KEY, raw);
    expect(await readFavoriteWords()).toMatchObject({ kind: "invalid", raw });
    await expect(toggleFavoriteWord(favorite)).rejects.toThrow();
    await expect(clearFavoriteWords()).rejects.toThrow();
    expect(runtime.storage.get(KEY)).toBe(raw);
  });

  it("exports an unknown version verbatim but refuses restore or normal writes", async () => {
    const raw = '{ "version": 99, "future": [] }';
    runtime.storage.set(KEY, raw);
    expect(await readFavoriteWords()).toMatchObject({ kind: "unsupported", raw });
    const path = await exportFavoriteWords();
    expect(await readFile(path, "utf8")).toBe(raw);
    await expect(restoreFavoriteWords(await backupFile("[]"))).rejects.toThrow("compatible");
    await expect(clearFavoriteWords()).rejects.toThrow();
    expect(runtime.storage.get(KEY)).toBe(raw);
  });

  it("serializes overlapping mutations and reads current storage rather than a stale page snapshot", async () => {
    runtime.storage.set(KEY, JSON.stringify([{ ...favorite, word: "existing" }]));
    await Promise.all([
      toggleFavoriteWord({ ...favorite, word: "alpha" }),
      toggleFavoriteWord({ ...favorite, word: "beta" }),
    ]);
    const state = await readFavoriteWords();
    expect(state.kind === "ready" && state.favorites.map((favorite) => favorite.word)).toEqual([
      "beta",
      "alpha",
      "existing",
    ]);
  });

  it("does not rewrite data when a read or write fails", async () => {
    const raw = JSON.stringify([favorite]);
    runtime.storage.set(KEY, raw);
    runtime.failRead = true;
    expect(await readFavoriteWords()).toMatchObject({ kind: "error" });
    await expect(clearFavoriteWords()).rejects.toThrow("read failed");
    runtime.failRead = false;
    runtime.failWrite = true;
    await expect(clearFavoriteWords()).rejects.toThrow("write failed");
    expect(runtime.storage.get(KEY)).toBe(raw);
  });
});

describe("favorite recovery", () => {
  it("validates the chosen backup, preserves current raw bytes, and then restores", async () => {
    const original = "{ malformed original\n";
    const restored = JSON.stringify([favorite]);
    runtime.storage.set(KEY, original);
    const previous = await restoreFavoriteWords(await backupFile(restored));
    expect(previous).toBeDefined();
    expect(await readFile(previous!, "utf8")).toBe(original);
    expect(runtime.storage.get(KEY)).toBe(restored);
    expect(await readFavoriteWords()).toMatchObject({ kind: "ready", favorites: [favorite] });
  });

  it("rejects invalid selected files before creating a backup or changing storage", async () => {
    runtime.storage.set(KEY, "broken current");
    await expect(restoreFavoriteWords(await backupFile('{"version":99}'))).rejects.toThrow("not a valid");
    expect(await readdir(runtime.directory)).toEqual(["selected.json"]);
    expect(runtime.storage.get(KEY)).toBe("broken current");
  });

  it("does not overwrite original data when backup creation fails", async () => {
    runtime.storage.set(KEY, "broken current");
    await writeFile(join(runtime.directory, "favorite-backups"), "not a directory");
    await expect(restoreFavoriteWords(await backupFile("[]"))).rejects.toThrow();
    expect(runtime.storage.get(KEY)).toBe("broken current");
  });

  it("retains the original and its backup when the final storage write fails", async () => {
    runtime.storage.set(KEY, "broken current");
    runtime.failWrite = true;
    await expect(restoreFavoriteWords(await backupFile("[]"))).rejects.toThrow("write failed");
    const directory = join(runtime.directory, "favorite-backups");
    const paths = await readdir(directory);
    expect(paths).toHaveLength(1);
    expect(await readFile(join(directory, paths[0]), "utf8")).toBe("broken current");
    expect(runtime.storage.get(KEY)).toBe("broken current");
  });

  it("represents clearing as a valid empty array and does not reinterpret it as missing", async () => {
    runtime.storage.set(KEY, JSON.stringify([favorite]));
    await clearFavoriteWords();
    expect(decodeFavoriteStorage(runtime.storage.get(KEY))).toMatchObject({ kind: "ready", favorites: [] });
    expect(runtime.storage.get(KEY)).toBe("[]");
  });
});
