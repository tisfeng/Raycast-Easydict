/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Cache } from "@raycast/api";

const cache = new Cache({ namespace: "search-word" });
const key = "last-query";

/** The text in the Search Word bar, so Search Selected Text can reopen it when nothing new is selected. */
export function getLastQuery(): string {
  return cache.get(key) ?? "";
}

export function setLastQuery(text: string) {
  if (text) cache.set(key, text);
  else cache.remove(key);
}
