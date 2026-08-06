/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useLocalStorage } from "@raycast/utils";
import { useRef } from "react";

import { favoriteKeyOf, type FavoriteWord } from "@/types/favorite";

type FavoriteIdentity = Pick<FavoriteWord, "word" | "fromLanguage" | "toLanguage">;

/**
 * LocalStorage key holding the persisted favorites array.
 */
const FAVORITE_WORDS_KEY = "favorite-words";

/**
 * Reactive favorites store backed by Raycast `LocalStorage`.
 *
 * `useLocalStorage.setValue` accepts a plain value (not an updater), and the
 * search view + favorites command each mount their own instance (kept in sync
 * within a window via the underlying subscription). To avoid last-write-wins
 * races when two instances mutate before re-rendering, mutations read the
 * latest array from `latestRef` rather than the render-captured `favorites`.
 */
export function useFavoriteWords() {
  const { value, setValue, isLoading } = useLocalStorage<FavoriteWord[]>(FAVORITE_WORDS_KEY, []);
  const favorites = value ?? [];
  // Always-current snapshot; updated every render, read by mutations.
  const latestRef = useRef(favorites);
  latestRef.current = favorites;

  const has = (identity: FavoriteIdentity): boolean =>
    latestRef.current.some((f) => favoriteKeyOf(f) === favoriteKeyOf(identity));

  const remove = (identity: FavoriteIdentity): void => {
    setValue(latestRef.current.filter((f) => favoriteKeyOf(f) !== favoriteKeyOf(identity)));
  };

  const toggle = (entry: FavoriteWord): void => {
    const current = latestRef.current;
    setValue(
      current.some((f) => favoriteKeyOf(f) === favoriteKeyOf(entry))
        ? current.filter((f) => favoriteKeyOf(f) !== favoriteKeyOf(entry))
        : [entry, ...current],
    );
  };

  const clear = (): void => {
    setValue([]);
  };

  return { favorites, isLoading, has, remove, toggle, clear };
}
