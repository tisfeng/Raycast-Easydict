/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useCallback, useEffect, useRef } from "react";

/**
 * Wraps a queryText function with input debounce.
 *
 * Cleanup: clears the timer on unmount to prevent stale queries.
 */
export function useDebouncedQuery(queryText: (text: string, toLanguage: string) => void, delay = 600) {
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedQuery = useCallback(
    (text: string, toLanguage: string) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        queryText(text, toLanguage);
      }, delay);
    },
    [queryText, delay],
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return debouncedQuery;
}
