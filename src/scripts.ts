/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { showFailureToast } from "@raycast/utils";
import { open } from "@raycast/api";

import { logError } from "@/devLog";

/**
 * Open Eudic App with queryText.
 *
 * eudic://dict/good
 */
export const openInEudic = (queryText: string) => {
  const url = `eudic://dict/${queryText}`;
  open(url).catch((error) => {
    logError("scripts", `open in eudic error: ${error}`);
    showFailureToast(String(error), {
      title: "Eudic is not installed.",
    });
  });
};
