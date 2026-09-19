import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DetectionDecision } from "@/core/detect/types";
import { DictionaryType, LanguageDetectType, TranslationType } from "@/core/results/kinds";
import type { QueryInput, RuntimeServiceConfig, TranslationResult } from "@/core/results/types";

import {
  cacheLanguageDetection,
  cacheQueryResult,
  clearQueryCache,
  getCachedLanguageDetection,
  getCachedQueryResult,
  getQueryCacheGeneration,
} from "./cache";

const testState = vi.hoisted(() => ({
  caches: new Map<string, Map<string, string>>(),
  preferences: {
    queryCacheMode: "words",
    aiQueryCacheMode: "off",
    language1: "zh-CHS",
    language2: "en",
    enableDetectLanguageSpeedFirst: true,
    enableBaiduLanguageDetect: true,
    enableTencentLanguageDetect: false,
    enableVolcanoLanguageDetect: false,
  },
}));

vi.mock("@raycast/api", () => ({
  Cache: class {
    private storage: Map<string, string>;

    constructor(options?: { namespace?: string }) {
      const namespace = options?.namespace ?? "default";
      let storage = testState.caches.get(namespace);
      if (!storage) {
        storage = new Map();
        testState.caches.set(namespace, storage);
      }
      this.storage = storage;
    }

    get(key: string) {
      return this.storage.get(key);
    }

    set(key: string, value: string) {
      this.storage.set(key, value);
    }

    remove(key: string) {
      return this.storage.delete(key);
    }

    clear() {
      this.storage.clear();
    }
  },
}));

vi.mock("@/consts", () => ({ myPreferences: testState.preferences }));
vi.mock("@/shared/logger", () => ({ logWarn: vi.fn() }));

const query = { word: "cache", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true } as const;

beforeEach(() => {
  vi.useRealTimers();
  testState.preferences.queryCacheMode = "words";
  testState.preferences.aiQueryCacheMode = "off";
  clearQueryCache();
});

describe("query cache", () => {
  it("reuses completed word translations and invalidates them when request configuration changes", () => {
    const service = createService("builtin:translation:Bing", "credential-a");
    const result = createTranslationResult();

    cacheQueryResult(service, query, result);

    expect(getCachedQueryResult(service, query)).toEqual(result);
    expect(getCachedQueryResult({ ...service, cacheIdentity: "credential-b" }, query)).toBeUndefined();
    expect([...testState.caches.get("query-results")!.keys()][0]).not.toContain("credential-a");
  });

  it("does not persist text outside the selected policy or AI results by default", () => {
    const regular = createService("builtin:translation:Bing", "regular");
    const ai = createService("ai:profile", "model-a");
    const sentence = { ...query, word: "This is longer than twenty characters.", isWord: false };

    cacheQueryResult(regular, sentence, createTranslationResult(sentence));
    cacheQueryResult(ai, query, createTranslationResult());

    expect(getCachedQueryResult(regular, sentence)).toBeUndefined();
    expect(getCachedQueryResult(ai, query)).toBeUndefined();
  });

  it.each(["I love you", "今天心情不好"])(
    "does not persist an unclassified short sentence in Words Only mode: %s",
    (word) => {
      const service = createService("builtin:translation:Bing", "regular");
      const sentence = { word, fromLanguage: "en", toLanguage: "zh-CHS" };
      const detection: DetectionDecision = { type: LanguageDetectType.Bing, language: "en", confirmed: true };

      cacheQueryResult(service, sentence, createTranslationResult(sentence));
      cacheLanguageDetection(word, detection);

      expect(getCachedQueryResult(service, sentence)).toBeUndefined();
      expect(getCachedLanguageDetection(word)).toBeUndefined();
      expect(testState.caches.get("query-results")?.size).toBe(0);
      expect(testState.caches.get("query-language-detection")?.size).toBe(0);
    },
  );

  it("does not let work started before a clear operation repopulate the cache", () => {
    const service = createService("builtin:translation:Bing", "regular");
    const requestCacheGeneration = getQueryCacheGeneration();

    clearQueryCache();
    cacheQueryResult(service, query, createTranslationResult(), requestCacheGeneration);
    cacheLanguageDetection(
      query.word,
      {
        type: LanguageDetectType.Bing,
        language: "en",
        confirmed: true,
      },
      requestCacheGeneration,
    );

    expect(getCachedQueryResult(service, query)).toBeUndefined();
    expect(getCachedLanguageDetection(query.word)).toBeUndefined();
  });

  it("expires translation entries after 24 hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const service = createService("builtin:translation:Bing", "regular");
    cacheQueryResult(service, query, createTranslationResult());

    vi.setSystemTime(new Date("2026-01-02T00:00:00.001Z"));

    expect(getCachedQueryResult(service, query)).toBeUndefined();
  });

  it("discards a corrupted entry instead of returning it", () => {
    const service = createService("builtin:translation:Bing", "regular");
    cacheQueryResult(service, query, createTranslationResult());
    const storage = testState.caches.get("query-results")!;
    const key = [...storage.keys()].find((candidate) => storage.get(candidate)?.includes('"translations"'))!;
    storage.set(key, "{not-json");

    expect(getCachedQueryResult(service, query)).toBeUndefined();
    expect(storage.has(key)).toBe(false);
  });

  it("discards a cached dictionary with unsafe nested rendering fields before replay", () => {
    const value = {
      type: DictionaryType.AI,
      queryWordInfo: query,
      displaySections: [
        {
          type: "Definition",
          items: [
            {
              queryType: DictionaryType.AI,
              displayType: "Definition",
              queryWordInfo: query,
              key: "entry",
              title: "hello",
              copyText: "hello",
              detailsMarkdown: 17,
            },
          ],
        },
      ],
    };
    const service = createService("builtin:translation:Bing", "regular");
    cacheQueryResult(service, query, createTranslationResult());
    const storage = testState.caches.get("query-results")!;
    const key = [...storage.keys()].find((candidate) => storage.get(candidate)?.includes('"translations"'))!;
    storage.set(key, JSON.stringify({ version: 1, expiresAt: Date.now() + 10000, value }));

    expect(getCachedQueryResult(service, query)).toBeUndefined();
    expect(storage.has(key)).toBe(false);
  });

  it.each([{ type: "unknown" }, { youdaoLangCode: "unknown" }, { youdaoLangCode: "auto" }, { confirmed: false }])(
    "discards cached detections that cannot produce a confirmed decision (%j)",
    (override) => {
      const detection: DetectionDecision = { type: LanguageDetectType.Bing, language: "en", confirmed: true };
      cacheLanguageDetection(query.word, detection);
      const storage = testState.caches.get("query-language-detection")!;
      const key = [...storage.keys()][0];
      const value = {
        type: LanguageDetectType.Bing,
        youdaoLangCode: "en",
        sourceLangCode: "en",
        confirmed: true,
        ...override,
      };
      storage.set(key, JSON.stringify({ version: 1, expiresAt: Date.now() + 10000, value }));
      expect(getCachedLanguageDetection(query.word)).toBeUndefined();
      expect(storage.has(key)).toBe(false);
    },
  );

  it("decodes old confirmed cache entries without exposing provider observations", () => {
    cacheLanguageDetection(query.word, { type: LanguageDetectType.Bing, language: "en", confirmed: true });
    const storage = testState.caches.get("query-language-detection")!;
    const key = [...storage.keys()][0];
    storage.set(
      key,
      JSON.stringify({
        version: 1,
        expiresAt: Date.now() + 10000,
        value: {
          type: LanguageDetectType.Franc,
          youdaoLangCode: "fil",
          sourceLangCode: "tgl",
          confirmed: true,
          prior: true,
          detectedLanguageArray: [["tgl", 1]],
          result: { wire: "opaque" },
        },
      }),
    );
    expect(getCachedLanguageDetection(query.word)).toEqual({
      type: LanguageDetectType.Franc,
      language: "tl",
      confirmed: true,
    });
  });

  it("caches only confirmed detection results and isolates detection settings", () => {
    const detection: DetectionDecision = { type: LanguageDetectType.Bing, language: "en", confirmed: true };
    cacheLanguageDetection(query.word, detection);
    expect(getCachedLanguageDetection(query.word)).toEqual(detection);
    const serialized = [...testState.caches.get("query-language-detection")!.values()][0];
    expect(JSON.parse(serialized)).toMatchObject({
      version: 1,
      value: {
        type: LanguageDetectType.Bing,
        youdaoLangCode: "en",
        sourceLangCode: "",
        confirmed: true,
      },
    });
    expect(JSON.parse(serialized).value).not.toHaveProperty("language");

    testState.preferences.enableDetectLanguageSpeedFirst = false;
    expect(getCachedLanguageDetection(query.word)).toBeUndefined();
    testState.preferences.enableDetectLanguageSpeedFirst = true;

    cacheLanguageDetection("uncertain", { ...detection, confirmed: false });
    expect(getCachedLanguageDetection("uncertain")).toBeUndefined();
    cacheLanguageDetection("unmapped", { type: LanguageDetectType.Bing, language: "auto", confirmed: false });
    expect(getCachedLanguageDetection("unmapped")).toBeUndefined();
  });
});

function createService(providerKey: string, cacheIdentity: string): RuntimeServiceConfig {
  return { id: providerKey, label: providerKey, providerKey, order: 0, cacheIdentity };
}

function createTranslationResult(queryWordInfo: QueryInput = query): TranslationResult {
  return {
    type: TranslationType.Bing,
    queryWordInfo,
    translations: ["缓存"],
  };
}
