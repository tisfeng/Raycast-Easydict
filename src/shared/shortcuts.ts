/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { Keyboard } from "@raycast/api";

/** Search's "Read Query Text" and favorites' "Read Word" play the same word audio. */
export const readQueryTextShortcut = {
  macOS: { modifiers: ["cmd"], key: "r" },
  Windows: { modifiers: ["ctrl"], key: "r" },
} satisfies Keyboard.Shortcut;
