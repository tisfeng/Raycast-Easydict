/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useRef } from "react";
import { DataManager } from "@/dataManager/dataManager";

/**
 * Wraps DataManager.queryText with input debounce.
 * Replaces delayQueryText's setTimeout pattern with React-managed timing.
 *
 * Cleanup: clears the timer on unmount to prevent stale queries.
 */
export function useDebouncedQuery(dm: DataManager, delay = 600) {
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedQuery = useCallback(
    (text: string, toLanguage: string) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dm.queryText(text, toLanguage);
      }, delay);
    },
    [dm, delay],
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return debouncedQuery;
}
