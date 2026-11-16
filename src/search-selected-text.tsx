/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getSelectedText, launchCommand, LaunchType, showHUD } from "@raycast/api";

import { getLastQuery } from "@/features/search/lastQuery";
import { logError, logTrace } from "@/shared/logger";

/**
 * Reads the selection before Raycast's window takes focus, then opens Search Word with it.
 *
 * Launching Search Word anew replaces a still-open search, which re-invoking Search Word itself only brings back.
 * Without a selection, the last search is reopened, usually from the query cache.
 */
export default async function command() {
  const selectedText = await getSelectedText()
    .then((text) => text.trim())
    .catch((error) => {
      logError("SearchSelectedText", `getSelectedText error: ${error}`);
      return "";
    });
  logTrace("SearchSelectedText", `selected text length: ${selectedText.length}`);

  try {
    await launchCommand({
      name: "easydict",
      type: LaunchType.UserInitiated,
      arguments: { queryText: selectedText || getLastQuery() },
      context: { selectedTextChecked: true },
    });
  } catch (error) {
    logError("SearchSelectedText", `launch easydict error: ${error}`);
    await showHUD("⚠️ Failed to query Easy Dictionary");
  }
}
