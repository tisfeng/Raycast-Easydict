import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { myPreferences } from "@/consts";
import { playQueryWordAudio } from "@/core/audio";
import type { LanguageItem } from "@/core/language/types";
import { projectQueryResults } from "@/core/query/displaySections";
import { QueryRunner, type QueryServiceSnapshot } from "@/core/query/QueryRunner";
import { showErrorToast } from "@/shared/errors";
import { logWarn } from "@/shared/logger";

export type { QueryServiceSnapshot } from "@/core/query/QueryRunner";

function createViewReader(runner: QueryRunner) {
  let snapshot = runner.getSnapshot();
  let projection = projectQueryResults(snapshot.queryResults, myPreferences);
  let view = { ...snapshot, ...projection, listEpoch: 0 };
  return () => {
    const next = runner.getSnapshot();
    if (next !== snapshot) {
      if (next.queryResults !== snapshot.queryResults)
        projection = projectQueryResults(next.queryResults, myPreferences);
      snapshot = next;
      view = { ...next, ...projection, listEpoch: projection.hasVisibleItems ? next.queryGeneration : view.listEpoch };
    }
    return view;
  };
}

export function useQueryEngine(
  initialFromLanguage: LanguageItem,
  initialTargetLanguage: LanguageItem,
  serviceSnapshot: QueryServiceSnapshot,
) {
  const [runner] = useState(
    () =>
      new QueryRunner(initialFromLanguage, initialTargetLanguage, serviceSnapshot, {
        onError: showErrorToast,
        onAudio(word, signal) {
          void playQueryWordAudio(word, { signal }).catch((error) => {
            if (!signal.aborted) logWarn("QueryEngine", `failed to play audio for ${word.word}: ${error}`);
          });
        },
      }),
  );
  const [readView] = useState(() => createViewReader(runner));
  const view = useSyncExternalStore(runner.subscribe, readView);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) runner.dispose();
      });
    };
  }, [runner]);
  useEffect(() => runner.setServices(serviceSnapshot), [runner, serviceSnapshot]);

  return {
    ...view,
    queryText: runner.queryText,
    queryTextWithTextInfo: runner.queryTextWithTextInfo,
    regenerateService: runner.regenerateService,
    clearQueryResult: runner.clearQueryResult,
    setAutoSelectedTargetLanguageItem: runner.setAutoSelectedTargetLanguageItem,
  };
}
