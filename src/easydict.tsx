/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Action, ActionPanel, getSelectedText, type LaunchProps, List } from "@raycast/api";
import { useEffect, useState } from "react";

import { myPreferences } from "@/consts";
import { checkIfPreferredLanguagesConflict } from "@/features/search/LanguageConflictError";
import SearchWord from "@/features/search/SearchWord";
import { logError, logTrace } from "@/shared/logger";

logTrace("Easydict", "module loaded");

export default function (props: LaunchProps<{ arguments: Arguments.Easydict }>) {
  const isConflict = checkIfPreferredLanguagesConflict();
  if (isConflict) {
    return isConflict;
  }

  const { queryText: initialQueryText } = props.arguments;

  return <InitialSearch initialQueryText={initialQueryText} fallbackText={props.fallbackText} />;
}

function InitialSearch({ initialQueryText, fallbackText }: { initialQueryText?: string; fallbackText?: string }) {
  const explicitText = (initialQueryText || fallbackText)?.trim();
  const [selectedText, setSelectedText] = useState<string>();
  const needsSelection = !explicitText && myPreferences.enableAutomaticQuerySelectedText;

  useEffect(() => {
    if (!needsSelection) return;
    let active = true;
    getSelectedText()
      .then((text) => {
        if (active) setSelectedText((current) => current ?? text.trim());
      })
      .catch((error) => {
        if (!active) return;
        logError("Easydict", "Could not read selected text", error);
        setSelectedText((current) => current ?? "");
      });
    return () => {
      active = false;
    };
  }, [needsSelection]);

  // Resolve system selection before mounting the interactive page. A late
  // selection must not replace a manual lookup or an open capture form.
  if (needsSelection && selectedText === undefined) {
    return (
      <List
        isLoading
        actions={
          <ActionPanel>
            <Action title="Enter Word Manually" onAction={() => setSelectedText("")} />
          </ActionPanel>
        }
      >
        <List.EmptyView title="Reading Selected Text…" />
      </List>
    );
  }
  return <SearchWord initialQueryText={explicitText || selectedText || ""} />;
}
