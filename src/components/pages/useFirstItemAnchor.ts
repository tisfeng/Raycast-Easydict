/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useState } from "react";

interface SelectionState {
  itemIdsRevision: string;
  selectedItemId?: string;
  wasLoading: boolean;
}

/**
 * Soft-anchor Raycast's native selection while asynchronous providers insert
 * higher-priority results. When the current first item ID changes, re-anchor
 * to that item; repeated renders with the same selectedItemId do not override
 * native selection, so user navigation usually remains intact. Once loading
 * completes, preserve a valid selection and fall back to the current first
 * item when the selection is invalid.
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
