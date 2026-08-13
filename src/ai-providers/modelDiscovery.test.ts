import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchOpenAICompatibleModelIds, getCachedOpenAICompatibleModelIds, getModelsURL } from "./modelDiscovery";

const timedFetch = vi.hoisted(() => vi.fn());
const cacheStorage = vi.hoisted(() => new Map<string, string>());
const logSummary = vi.hoisted(() => vi.fn());
const logTrace = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());

vi.mock("@/utils/http", () => ({ timedFetch }));
vi.mock("@/utils/logger", () => ({
  logSummary,
  logTrace,
  logWarn,
}));
vi.mock("@raycast/api", () => ({
  Cache: class {
    get(key: string) {
      return cacheStorage.get(key);
    }

    set(key: string, value: string) {
      cacheStorage.set(key, value);
    }
  },
}));

beforeEach(() => {
  timedFetch.mockReset();
  cacheStorage.clear();
  logSummary.mockReset();
  logTrace.mockReset();
  logWarn.mockReset();
});

describe("OpenAI-compatible model discovery", () => {
  it("resolves models relative to the configured API base without appending another v1", () => {
    expect(getModelsURL("https://api.example.com/v1").toString()).toBe("https://api.example.com/v1/models");
    expect(getModelsURL("https://api.example.com/v1/chat/completions").toString()).toBe(
      "https://api.example.com/v1/models",
    );
    expect(getModelsURL("https://example.com/v1beta/openai/").toString()).toBe(
      "https://example.com/v1beta/openai/models",
    );
  });

  it("requests models with the endpoint, authorization, and signal and sorts usable IDs", async () => {
    const signal = new AbortController().signal;
    timedFetch.mockResolvedValue({
      data: [{ id: "model-b" }, { id: "" }, { id: 42 }, { id: "model-a" }, { id: "model-b" }],
    });

    await expect(fetchOpenAICompatibleModelIds("https://api.example.com/v1", "test-key", signal)).resolves.toEqual([
      "model-a",
      "model-b",
    ]);
    expect(timedFetch).toHaveBeenCalledWith("https://api.example.com/v1/models", {
      headers: { Authorization: "Bearer test-key" },
      signal,
    });
  });

  it("isolates cached models by credential without exposing endpoint or API key", async () => {
    timedFetch.mockResolvedValue({ data: [{ id: "model-b" }, { id: "model-a" }] });

    await fetchOpenAICompatibleModelIds("https://api.example.com/v1", "test-key");

    expect(getCachedOpenAICompatibleModelIds("https://api.example.com/v1", "test-key")).toEqual(["model-a", "model-b"]);
    expect(getCachedOpenAICompatibleModelIds("https://api.example.com/v1", "other-key")).toEqual([]);
    const cacheKey = [...cacheStorage.keys()][0];
    expect(cacheKey).not.toContain("api.example.com");
    expect(cacheKey).not.toContain("test-key");
    expect(JSON.stringify([logSummary.mock.calls, logTrace.mock.calls, logWarn.mock.calls])).not.toContain("test-key");
  });
});
