/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useState } from "react";

interface SelectionState {
  itemIdsRevision: string;
  selectedItemId?: string;
  wasLoading: boolean;
}

/**
 * Keep Raycast's list selection controlled while results stream in. Providers
 * can insert a higher-priority result at any time, so loading always selects
 * the current first item. Once loading finishes, users can move the selection,
 * while stale selections are replaced by the first item in the current list.
 */
export function useFirstItemAnchor(itemIds: string[], isLoading: boolean) {
  const itemIdsRevision = itemIds.join("\0");
  const firstItemId = itemIds[0];
  const [selectionState, setSelectionState] = useState<SelectionState>(() => ({
    itemIdsRevision,
    selectedItemId: firstItemId,
    wasLoading: isLoading,
  }));

  const selectionIsValid =
    selectionState.selectedItemId !== undefined && itemIds.includes(selectionState.selectedItemId);
  const selectedItemId =
    firstItemId === undefined
      ? undefined
      : isLoading || selectionState.wasLoading || !selectionIsValid
        ? firstItemId
        : selectionState.selectedItemId;

  useEffect(() => {
    setSelectionState((previous) => {
      if (
        previous.itemIdsRevision === itemIdsRevision &&
        previous.selectedItemId === selectedItemId &&
        previous.wasLoading === isLoading
      ) {
        return previous;
      }
      return {
        itemIdsRevision,
        selectedItemId,
        wasLoading: isLoading,
      };
    });
  }, [isLoading, itemIdsRevision, selectedItemId]);

  const onSelectionChange = useCallback(
    (id: string | null) => {
      const nextSelectedItemId = isLoading || id === null || !itemIds.includes(id) ? firstItemId : id;
      setSelectionState((previous) => {
        if (
          previous.itemIdsRevision === itemIdsRevision &&
          previous.selectedItemId === nextSelectedItemId &&
          previous.wasLoading === isLoading
        ) {
          return previous;
        }
        return {
          itemIdsRevision,
          selectedItemId: nextSelectedItemId,
          wasLoading: isLoading,
        };
      });
    },
    [firstItemId, isLoading, itemIds, itemIdsRevision],
  );

  return { selectedItemId, onSelectionChange };
}
