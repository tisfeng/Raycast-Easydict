/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { LaunchProps } from "@raycast/api";

import { isLanguageCode } from "@/core/language/utils";
import { checkIfPreferredLanguagesConflict } from "@/features/search/LanguageConflictError";
import SearchWord from "@/features/search/SearchWord";
import { logTrace } from "@/shared/logger";
import { isRecord } from "@/shared/validation";

logTrace("Easydict", "module loaded");

export default function (
  props: LaunchProps<{
    arguments: Arguments.Easydict;
    launchContext?: { selection?: unknown };
  }>,
) {
  const isConflict = checkIfPreferredLanguagesConflict();
  if (isConflict) {
    return isConflict;
  }

  const selection = props.launchContext?.selection;
  if (isRecord(selection) && typeof selection.text === "string") {
    const { text, manualTargetLanguage } = selection;
    return (
      <SearchWord
        initialQueryText={text.trim()}
        initialTargetLanguage={isLanguageCode(manualTargetLanguage) ? manualTargetLanguage : undefined}
      />
    );
  }

  const queryText = (props.arguments.queryText || props.fallbackText)?.trim();
  return <SearchWord initialQueryText={queryText || undefined} />;
}
