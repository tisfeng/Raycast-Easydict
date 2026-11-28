import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadStrokeOrderEntries } from "./data";

const testDoubles = vi.hoisted(() => ({
  caches: new Map<string, Map<string, string>>(),
  fetchRaw: vi.fn(),
}));

vi.mock("@raycast/api", async () => {
  const { createCacheMock } = await import("@/test-support/raycastStorage");
  return { Cache: createCacheMock(testDoubles.caches), environment: { isDevelopment: false } };
});

vi.mock("@/shared/http", () => ({
  timedFetch: { raw: testDoubles.fetchRaw },
}));

beforeEach(() => {
  for (const entries of testDoubles.caches.values()) entries.clear();
  testDoubles.fetchRaw.mockReset();
});

describe("loadStrokeOrderEntries", () => {
  it("reuses cached stroke data", async () => {
    testDoubles.fetchRaw.mockResolvedValue({
      ok: true,
      status: 200,
      _data: { strokes: ["M 0 0 L 1 1"] },
    });

    await expect(loadStrokeOrderEntries(["一"])).resolves.toEqual([
      { character: "一", status: "available", strokes: ["M 0 0 L 1 1"] },
    ]);
    await expect(loadStrokeOrderEntries(["一"])).resolves.toEqual([
      { character: "一", status: "available", strokes: ["M 0 0 L 1 1"] },
    ]);
    expect(testDoubles.fetchRaw).toHaveBeenCalledTimes(1);
  });

  it("caches unavailable characters for the pinned data version", async () => {
    testDoubles.fetchRaw.mockResolvedValue({ ok: false, status: 404 });

    await expect(loadStrokeOrderEntries(["𰻞"])).resolves.toEqual([{ character: "𰻞", status: "unavailable" }]);
    await expect(loadStrokeOrderEntries(["𰻞"])).resolves.toEqual([{ character: "𰻞", status: "unavailable" }]);
    expect(testDoubles.fetchRaw).toHaveBeenCalledTimes(1);
  });

  it("does not cache transient errors so they can be retried", async () => {
    testDoubles.fetchRaw.mockResolvedValue({ ok: false, status: 503 });

    await expect(loadStrokeOrderEntries(["字"])).resolves.toEqual([
      { character: "字", status: "error", message: "Stroke data request failed with HTTP 503." },
    ]);
    await expect(loadStrokeOrderEntries(["字"])).resolves.toEqual([
      { character: "字", status: "error", message: "Stroke data request failed with HTTP 503." },
    ]);
    expect(testDoubles.fetchRaw).toHaveBeenCalledTimes(2);
  });
});
