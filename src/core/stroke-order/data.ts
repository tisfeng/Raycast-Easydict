/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Cache } from "@raycast/api";

import { normalizeError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";
import { logError } from "@/utils/logger";

import { MAX_RENDERED_STROKE_PATH_LENGTH, MAX_STROKE_COUNT } from "./svg";

const HANZI_WRITER_DATA_VERSION = "2.0.1";
const HANZI_WRITER_DATA_BASE_URL = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@${HANZI_WRITER_DATA_VERSION}`;
const dataCache = new Cache({ namespace: "stroke-order-v1", capacity: 5_000_000 });
const MAX_STROKE_PATH_LENGTH = 100_000;
const MAX_TOTAL_STROKE_PATH_LENGTH = 1_000_000;

interface HanziWriterCharacterData {
  strokes: string[];
}

export type StrokeOrderEntry =
  | { character: string; status: "available"; strokes: string[] }
  | { character: string; status: "unavailable" }
  | { character: string; status: "error"; message: string };

function isHanziWriterCharacterData(value: unknown): value is HanziWriterCharacterData {
  if (typeof value !== "object" || value === null || !("strokes" in value)) return false;

  const { strokes } = value;
  if (!Array.isArray(strokes) || strokes.length === 0 || strokes.length > MAX_STROKE_COUNT) return false;

  let totalLength = 0;
  const hasValidPaths = strokes.every((stroke) => {
    if (typeof stroke !== "string" || stroke.length === 0 || stroke.length > MAX_STROKE_PATH_LENGTH) return false;
    totalLength += stroke.length;
    return totalLength <= MAX_TOTAL_STROKE_PATH_LENGTH;
  });
  return hasValidPaths && totalLength * strokes.length <= MAX_RENDERED_STROKE_PATH_LENGTH;
}

function cacheKey(character: string): string {
  return `v${HANZI_WRITER_DATA_VERSION}:${character.codePointAt(0)?.toString(16) ?? character}`;
}

function getCachedData(character: string): HanziWriterCharacterData | undefined {
  const key = cacheKey(character);
  const cached = dataCache.get(key);
  if (!cached) return undefined;

  try {
    const value: unknown = JSON.parse(cached);
    if (isHanziWriterCharacterData(value)) return value;
  } catch {
    // Invalid cache entries are removed and downloaded again below.
  }

  dataCache.remove(key);
  return undefined;
}

async function loadCharacterData(
  character: string,
  signal?: AbortSignal,
): Promise<HanziWriterCharacterData | undefined> {
  const cached = getCachedData(character);
  if (cached) return cached;

  const url = `${HANZI_WRITER_DATA_BASE_URL}/${encodeURIComponent(character)}.json`;
  const response = await timedFetch.raw<unknown>(url, { ignoreResponseError: true, signal });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Stroke data request failed with HTTP ${response.status}.`);

  const value = response._data;
  if (!isHanziWriterCharacterData(value)) throw new Error("Stroke data response has an invalid format.");

  const data = { strokes: value.strokes };
  dataCache.set(cacheKey(character), JSON.stringify(data));
  return data;
}

export async function loadStrokeOrderEntries(
  characters: readonly string[],
  signal?: AbortSignal,
): Promise<StrokeOrderEntry[]> {
  return Promise.all(
    characters.map(async (character): Promise<StrokeOrderEntry> => {
      try {
        const data = await loadCharacterData(character, signal);
        return data ? { character, status: "available", strokes: data.strokes } : { character, status: "unavailable" };
      } catch (error) {
        const { message } = normalizeError(error);
        logError("StrokeOrder", `failed to load ${character}: ${message}`);
        return { character, status: "error", message };
      }
    }),
  );
}

export const strokeOrderDataSourceUrl = "https://github.com/chanind/hanzi-writer-data";
export const strokeOrderDataSourceTitle = `Hanzi Writer Data ${HANZI_WRITER_DATA_VERSION}`;
