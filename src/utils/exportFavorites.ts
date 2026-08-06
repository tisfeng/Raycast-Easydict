/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { FavoriteWord } from "@/types/favorite";

/**
 * Single preview line for a favorite, used by both Text and CSV renderers.
 */
function previewTranslation(favorite: FavoriteWord): string {
  return favorite.translations?.join(", ") ?? "";
}

/**
 * Tab-separated `word \t translation` lines — compact and paste-friendly.
 */
export function exportAsText(favorites: readonly FavoriteWord[]): string {
  return favorites.map((f) => `${f.word}\t${previewTranslation(f)}`).join("\n");
}

/**
 * RFC-4180-ish CSV with a header row, ready to import into Anki / Excel / Sheets.
 * Fields are double-quoted with embedded quotes doubled.
 */
export function exportAsCSV(favorites: readonly FavoriteWord[]): string {
  const esc = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const header = ["Word", "Translation", "From", "To"].map(esc).join(",");
  const rows = favorites.map((f) => [f.word, previewTranslation(f), f.fromLanguage, f.toLanguage].map(esc).join(","));
  return [header, ...rows].join("\n");
}

/**
 * Structured export for external tools. Intentionally excludes the heavy
 * `displaySections` snapshot to keep output portable; the favorites store
 * itself retains the full snapshot for offline re-display.
 */
export function exportAsJSON(favorites: readonly FavoriteWord[]): string {
  return JSON.stringify(
    favorites.map((f) => ({
      word: f.word,
      translations: f.translations ?? [],
      fromLanguage: f.fromLanguage,
      toLanguage: f.toLanguage,
      isWord: f.isWord ?? false,
      createdAt: f.createdAt,
    })),
    null,
    2,
  );
}
