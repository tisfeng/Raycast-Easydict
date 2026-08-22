/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useState } from "react";

type SelectionMode = "automatic" | "manual";

interface SelectionState {
  queryGeneration: number;
  mode: SelectionMode;
  selectedItemId?: string;
}

/**
 * Follows the first result until the user chooses an item. A user selection is
 * kept while that item remains in the current query, even when new results are
 * inserted before it. A new query or a selection that disappears returns to
 * following the current first item.
 */
export function useFirstItemAnchor(itemIds: string[], queryGeneration: number) {
  const firstItemId = itemIds[0];
  const [selectionState, setSelectionState] = useState<SelectionState>(() => ({
    queryGeneration,
    mode: "automatic",
    selectedItemId: firstItemId,
  }));

  const isManualSelectionValid =
    selectionState.queryGeneration === queryGeneration &&
    selectionState.mode === "manual" &&
    selectionState.selectedItemId !== undefined &&
    itemIds.includes(selectionState.selectedItemId);
  const mode: SelectionMode = isManualSelectionValid ? "manual" : "automatic";
  const selectedItemId = isManualSelectionValid ? selectionState.selectedItemId : firstItemId;

  useEffect(() => {
    setSelectionState((previous) => {
      if (
        previous.queryGeneration === queryGeneration &&
        previous.mode === mode &&
        previous.selectedItemId === selectedItemId
      ) {
        return previous;
      }

      return {
        queryGeneration,
        mode,
        selectedItemId,
      };
    });
  }, [mode, queryGeneration, selectedItemId]);

  const onSelectionChange = useCallback(
    (id: string | null) => {
      if (id !== null && id === selectedItemId) {
        return;
      }

      const isValidSelection = id !== null && itemIds.includes(id);
      setSelectionState({
        queryGeneration,
        mode: isValidSelection ? "manual" : "automatic",
        selectedItemId: isValidSelection ? id : firstItemId,
      });
    },
    [firstItemId, itemIds, queryGeneration, selectedItemId],
  );

  return { selectedItemId, onSelectionChange };
}
