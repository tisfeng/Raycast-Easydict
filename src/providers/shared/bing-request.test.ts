import { beforeEach, describe, expect, it, vi } from "vitest";

import { BingDetectProvider } from "@/providers/detect/bing";
import { BingTranslateProvider } from "@/providers/translation/bing";
import { LanguageDetectType, TranslationType } from "@/types/api";
import { CancelledError } from "@/utils/errors";
import { timedFetch } from "@/utils/http";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@raycast/api", () => ({
  getPreferenceValues: () => ({ bingHost: "www.bing.com" }),
  environment: { isDevelopment: false },
  Cache: class {
    get(key: string) {
      return storage.get(key);
    }
    set(key: string, value: string) {
      storage.set(key, value);
    }
  },
}));

vi.mock("@raycast/utils", () => ({ showFailureToast: vi.fn() }));
vi.mock("@/utils/http", () => ({ timedFetch: { raw: vi.fn() } }));

const fetchRaw = vi.mocked(timedFetch.raw);
const query = { word: "hello & goodbye\nworld", fromLanguage: "en", toLanguage: "zh-CHS" };
const translation = {
  detectedLanguage: { language: "en", score: 1 },
  translations: [{ text: "你好\n\n世界", to: "zh-Hans", sentLen: { srcSentLen: [5], transSentLen: [2] } }],
};
const consumers = [
  {
    name: "detection",
    run: (signal?: AbortSignal) => new BingDetectProvider().detect(query.word, { signal }),
    fromLang: "auto-detect",
    to: "en",
  },
  {
    name: "translation",
    run: (signal?: AbortSignal) => new BingTranslateProvider().request(query, { signal }).next(),
    fromLang: "en",
    to: "zh-Hans",
  },
];

function response(url: string, data: unknown, status = 200, location?: string) {
  const result = Object.assign(new Response(null, { status, headers: location ? { location } : undefined }), {
    _data: data,
  });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

function configuration(url: string) {
  return response(
    url,
    `IG:"test-ig" data-iid="translator.5023"; var params_AbusePreventionHelper = ["${Date.now()}","test-token",3600000];`,
  );
}

function postCalls() {
  return fetchRaw.mock.calls.filter(([, options]) => options?.method === "POST");
}

beforeEach(() => {
  storage.clear();
  fetchRaw.mockReset();
});

describe("Bing request protocol", () => {
  it("shares cold-start configuration while assigning distinct IIDs to detection and translation", async () => {
    fetchRaw.mockImplementation(async (url, options) =>
      options?.method === "POST" ? response(String(url), [translation]) : configuration(String(url)),
    );

    const [detected, translated] = await Promise.all([
      new BingDetectProvider().detect(query.word),
      new BingTranslateProvider().request(query).next(),
    ]);

    expect(fetchRaw.mock.calls.filter(([, options]) => options?.method !== "POST")).toHaveLength(1);
    expect(postCalls().map(([url]) => new URL(String(url)).searchParams.get("IID"))).toEqual([
      "translator.5023.2",
      "translator.5023.3",
    ]);
    expect(detected).toEqual({
      type: LanguageDetectType.Bing,
      sourceLangCode: "en",
      youdaoLangCode: "en",
      confirmed: false,
      result: translation,
    });
    expect(translated).toEqual({
      done: true,
      value: {
        type: TranslationType.Bing,
        queryWordInfo: query,
        result: translation,
        translations: ["你好", "", "世界"],
      },
    });
  });

  it.each(consumers)(
    "preserves the $name POST body and signal across a manual redirect",
    async ({ run, fromLang, to }) => {
      const controller = new AbortController();
      const redirectedUrl = "https://cn.bing.com/ttranslatev3?redirected=1";
      fetchRaw.mockImplementation(async (url, options) => {
        if (options?.method !== "POST") return configuration(String(url));
        return String(url) === redirectedUrl
          ? response(String(url), [translation])
          : response(String(url), undefined, 302, redirectedUrl);
      });

      await run(controller.signal);

      const posts = postCalls();
      expect(posts).toHaveLength(2);
      expect(posts[1][0]).toBe(redirectedUrl);
      expect(new URL(String(posts[0][0])).searchParams.get("IG")).toBe("test-ig");
      for (const [, options] of posts) {
        expect(options).toMatchObject({
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        expect(Object.fromEntries(new URLSearchParams(String(options?.body)))).toEqual({
          text: query.word,
          fromLang,
          to,
          key: expect.stringMatching(/^\d+$/),
          token: "test-token",
        });
      }
      expect(posts[1][1]?.body).toBe(posts[0][1]?.body);
    },
  );

  it.each(consumers)("normalizes a cancelled $name request without retrying", async ({ run }) => {
    const controller = new AbortController();
    fetchRaw.mockImplementation(async (url, options) => {
      if (options?.method !== "POST") return configuration(String(url));
      controller.abort();
      throw new Error("Request aborted by the network client");
    });

    await expect(run(controller.signal)).rejects.toBeInstanceOf(CancelledError);
    expect(postCalls()).toHaveLength(1);
  });

  it.each([
    { consumer: consumers[0], data: [], message: "Bing detect: invalid response" },
    { consumer: consumers[1], data: [{ translations: [] }], message: "Bing translate response is invalid" },
  ])("keeps $consumer.name response validation in the provider", async ({ consumer, data, message }) => {
    fetchRaw.mockImplementation(async (url, options) =>
      options?.method === "POST" ? response(String(url), data) : configuration(String(url)),
    );

    await expect(consumer.run()).rejects.toMatchObject({ name: "RequestError", message });
    expect(postCalls()).toHaveLength(1);
  });

  it("refreshes configuration and recovers from an empty translation after a host change", async () => {
    let redirectedRequests = 0;
    fetchRaw.mockImplementation(async (url, options) => {
      if (options?.method !== "POST") return configuration(String(url));
      const redirectUrl = String(url).replace("www.bing.com", "cn.bing.com");
      if (String(url) !== redirectUrl) return response(String(url), undefined, 302, redirectUrl);
      redirectedRequests++;
      return response(String(url), redirectedRequests === 1 ? undefined : [translation]);
    });

    const result = await new BingTranslateProvider().request(query).next();

    expect(result.value).toMatchObject({ translations: ["你好", "", "世界"] });
    expect(redirectedRequests).toBe(2);
    expect(fetchRaw.mock.calls.filter(([, options]) => options?.method !== "POST")).toHaveLength(2);
  });

  it.each([
    { consumer: consumers[0], changeHost: true, attempts: 1, message: "Bing detect: empty response" },
    { consumer: consumers[1], changeHost: false, attempts: 1, message: "Bing translate response is empty" },
    { consumer: consumers[1], changeHost: true, attempts: 4, message: "Bing translate response is empty" },
  ])(
    "limits $consumer.name empty-response attempts to $attempts when changeHost=$changeHost",
    async ({ consumer, changeHost, attempts, message }) => {
      fetchRaw.mockImplementation(async (url, options) => {
        if (options?.method !== "POST") return configuration(String(url));
        const redirectUrl = String(url).replace("www.bing.com", "cn.bing.com");
        if (changeHost && String(url) !== redirectUrl) return response(String(url), undefined, 302, redirectUrl);
        return response(String(url), undefined);
      });

      await expect(consumer.run()).rejects.toMatchObject({ name: "RequestError", message });
      expect(fetchRaw.mock.calls.filter(([, options]) => options?.method !== "POST")).toHaveLength(attempts);
      expect(postCalls()).toHaveLength(attempts * (changeHost ? 2 : 1));
    },
  );
});
