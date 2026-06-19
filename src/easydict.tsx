/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { LaunchProps } from "@raycast/api";

import SearchWord from "@/components/pages/SearchWord";
import { checkIfPreferredLanguagesConflict } from "@/components/ui/LanguageConflictError";
import { logTrace } from "@/utils/logger";

logTrace("easydict", "module loaded");

interface EasydictArguments {
  queryText?: string;
}

export default function (props: LaunchProps<{ arguments: EasydictArguments }>) {
  const isConflict = checkIfPreferredLanguagesConflict();
  if (isConflict) {
    return isConflict;
  }

  const { queryText: initialQueryText } = props.arguments;

  return <SearchWord initialQueryText={initialQueryText} fallbackText={props.fallbackText} />;
}
