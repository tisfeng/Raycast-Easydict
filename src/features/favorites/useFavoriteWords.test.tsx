// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FavoriteWord } from "./model";
import { useFavoriteWords } from "./useFavoriteWords";

const storage = vi.hoisted(() => new Map<string, string>());
const failures = vi.hoisted(() => ({ write: false }));

vi.mock("@raycast/api", () => ({
  LocalStorage: {
    getItem: async (key: string) => storage.get(key),
    setItem: async (key: string, value: string) => {
      if (failures.write) throw new Error("storage write failed");
      storage.set(key, value);
    },
  },
  LaunchType: { Background: "background" },
  environment: { launchType: "userInitiated", commandMode: "view" },
}));

const FAVORITE_WORDS_KEY = "favorite-words";

function makeFavorite(overrides: Partial<FavoriteWord> = {}): FavoriteWord {
  return {
    word: "serendipity",
    fromLanguage: "en",
    toLanguage: "zh-CHS",
    displaySections: [],
    createdAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  storage.clear();
  failures.write = false;
});
afterEach(cleanup);

describe("useFavoriteWords", () => {
  it("loads an empty favorites list from storage", async () => {
    const { result } = renderHook(() => useFavoriteWords());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.favorites).toEqual([]);
  });

  it("prepends favorites using the latest list and restores them after remount", async () => {
    const { result, unmount } = await renderLoadedFavorites();
    const toggle = result.current.toggle;
    const alpha = makeFavorite({ word: "alpha" });
    const beta = makeFavorite({ word: "beta" });

    await act(() => toggle(alpha));
    await act(() => toggle(beta));

    expect(result.current.favorites).toEqual([beta, alpha]);
    expect(JSON.parse(storage.get(FAVORITE_WORDS_KEY)!)).toEqual([beta, alpha]);
    unmount();
    const restored = await renderLoadedFavorites();
    expect(restored.result.current.favorites).toEqual([beta, alpha]);
  });

  it("toggle removes when the key already exists (dedup by word + direction)", async () => {
    const { result } = await renderLoadedFavorites();
    await act(() => result.current.toggle(makeFavorite({ word: "alpha" })));
    await act(() => result.current.toggle(makeFavorite({ word: "alpha" })));
    expect(result.current.favorites).toEqual([]);
  });

  it("treats the same word in a different direction as a separate favorite", async () => {
    const { result } = await renderLoadedFavorites();
    await act(() => result.current.toggle(makeFavorite({ word: "alpha", fromLanguage: "en", toLanguage: "zh-CHS" })));
    await act(() => result.current.toggle(makeFavorite({ word: "alpha", fromLanguage: "zh-CHS", toLanguage: "en" })));
    expect(result.current.favorites).toHaveLength(2);
  });

  it("has returns true only for a matching key", async () => {
    const { result } = await renderLoadedFavorites();
    await act(() => result.current.toggle(makeFavorite({ word: "alpha" })));
    expect(result.current.has({ word: "alpha", fromLanguage: "en", toLanguage: "zh-CHS" })).toBe(true);
    expect(result.current.has({ word: "alpha", fromLanguage: "zh-CHS", toLanguage: "en" })).toBe(false);
    expect(result.current.has({ word: "beta", fromLanguage: "en", toLanguage: "zh-CHS" })).toBe(false);
  });

  it("remove drops only the matching key", async () => {
    const { result } = await renderLoadedFavorites();
    await act(() => result.current.toggle(makeFavorite({ word: "alpha" })));
    await act(() => result.current.toggle(makeFavorite({ word: "beta" })));
    await act(async () => result.current.remove({ word: "alpha", fromLanguage: "en", toLanguage: "zh-CHS" }));
    expect(result.current.favorites.map((f) => f.word)).toEqual(["beta"]);
  });

  it("refuses to overwrite malformed stored favorites when adding a new word", async () => {
    const original = JSON.stringify([
      makeFavorite({ displaySections: [] }),
      { word: "broken", displaySections: "invalid" },
    ]);
    storage.set(FAVORITE_WORDS_KEY, original);
    const { result } = await renderLoadedFavorites();

    await act(async () => {
      await expect(result.current.toggle(makeFavorite())).rejects.toThrow();
    });
    expect(storage.get(FAVORITE_WORDS_KEY)).toBe(original);
  });

  it("retains the last persisted list when a write fails", async () => {
    const saved = makeFavorite();
    storage.set(FAVORITE_WORDS_KEY, JSON.stringify([saved]));
    const { result } = await renderLoadedFavorites();
    failures.write = true;

    await act(async () => {
      await expect(result.current.clear()).rejects.toThrow("storage write failed");
    });
    expect(result.current.favorites).toEqual([saved]);
    expect(result.current.state?.kind).toBe("ready");
    expect(storage.get(FAVORITE_WORDS_KEY)).toBe(JSON.stringify([saved]));
  });

  it("clear empties the store", async () => {
    const { result } = await renderLoadedFavorites();
    await act(() => result.current.toggle(makeFavorite({ word: "alpha" })));
    await act(async () => result.current.clear());
    expect(result.current.favorites).toEqual([]);
    expect(storage.get(FAVORITE_WORDS_KEY)).toBe("[]");
  });
});

async function renderLoadedFavorites() {
  const rendered = renderHook(() => useFavoriteWords());
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}
