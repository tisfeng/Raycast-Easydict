/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useEffect, useState } from "react";

/**
 * Anchor Raycast's native selection to the first result while the list is
 * changing. Once the current result order settles, release controlled
 * selection so the user can navigate the list normally.
 */
export function useFirstItemAnchor(itemIds: string[], isLoading: boolean) {
  const revision = itemIds.join("\0");
  const [releasedRevision, setReleasedRevision] = useState<string>();
  const firstItemId = itemIds[0];
  const shouldAnchorFirstItem = Boolean(firstItemId) && (isLoading || releasedRevision !== revision);

  useEffect(() => {
    if (!isLoading) {
      setReleasedRevision(revision);
    }
  }, [isLoading, revision]);

  return shouldAnchorFirstItem ? firstItemId : undefined;
}
