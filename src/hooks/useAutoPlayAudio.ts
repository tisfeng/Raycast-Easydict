/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { useEffect, useRef } from "react";

import { myPreferences } from "@/consts";
import { playQueryWordAudio } from "@/core/audio";
import { englishLanguageItem } from "@/core/language/consts";
import { checkIsDictionaryType } from "@/types/api";
import type { QueryResult } from "@/types/query";
import { logTrace } from "@/utils/logger";

/**
 * Watches query results and automatically plays word audio when:
 * 1. A dictionary result arrives
 * 2. The word is English and is a real word (not a phrase)
 * 3. Automatic playback is enabled in preferences
 * 4. The query is still current (not cancelled)
 * 5. Audio hasn't been played for this query session
 *
 * Extracted from DataManager.downloadAndPlayWordAudio.
 */
export function useAutoPlayAudio(
  queryResults: QueryResult[],
  hasPlayedAudioRef: React.RefObject<boolean>,
  isCurrentQueryRef: React.RefObject<boolean>,
  abortControllerRef: React.RefObject<AbortController | undefined>,
) {
  const previousLengthRef = useRef(0);

  useEffect(() => {
    if (queryResults.length <= previousLengthRef.current) {
      previousLengthRef.current = queryResults.length;
      return;
    }
    previousLengthRef.current = queryResults.length;

    for (const queryResult of queryResults) {
      const sourceResult = queryResult.sourceResult;
      if (!sourceResult) continue;

      const isDictionaryType = checkIsDictionaryType(queryResult.type);
      if (!isDictionaryType) continue;

      const wordInfo = sourceResult.queryWordInfo;
      const isEnglishLanguage = wordInfo.fromLanguage === englishLanguageItem.youdaoLangCode;
      const enableAutomaticDownloadAudio =
        myPreferences.enableAutomaticPlayWordAudio && wordInfo.isWord && isEnglishLanguage;

      if (enableAutomaticDownloadAudio && isCurrentQueryRef.current && !hasPlayedAudioRef.current) {
        logTrace("UseAutoPlayAudio", `playing audio for: ${wordInfo.word}`);
        playQueryWordAudio(wordInfo, { signal: abortControllerRef.current?.signal });
        hasPlayedAudioRef.current = true;
        break;
      }
    }
  }, [queryResults, hasPlayedAudioRef, isCurrentQueryRef, abortControllerRef]);
}
