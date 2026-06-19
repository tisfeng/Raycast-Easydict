/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Color, Icon, List } from "@raycast/api";

import { preferredLanguage1, preferredLanguage2 } from "@/preferences";
import { logTrace } from "@/utils/logger";

/**
 * Check if preferred languages conflict (same language selected twice).
 * Returns an error List component if conflict, null otherwise.
 */
export function checkIfPreferredLanguagesConflict() {
  if (preferredLanguage1.youdaoLangCode === preferredLanguage2.youdaoLangCode) {
    logTrace("components", "preferredLanguage1 and preferredLanguage2 are the same language");
    return (
      <List searchBarPlaceholder="Error">
        <List.Item
          title="Preferred Languages Conflict"
          icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
          subtitle="Your First Language and Second Language must be different!"
        />
      </List>
    );
  }
  return null;
}
