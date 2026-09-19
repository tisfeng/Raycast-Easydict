import { beforeEach, describe, expect, it, vi } from "vitest";

import { DictionaryType } from "@/core/results/kinds";
import { RequestError } from "@/shared/errors";
import { timedFetch } from "@/shared/http";

import { YoudaoDictionaryProvider } from "./index";

vi.mock("@raycast/api", () => ({ environment: { isDevelopment: false } }));
vi.mock("@raycast/utils", () => ({ showFailureToast: vi.fn() }));
vi.mock("@/consts", () => ({ myPreferences: { enableYoudaoDictionary: false, enableYoudaoTranslate: false } }));
vi.mock("@/shared/http", () => ({ timedFetch: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const query = { word: "good", fromLanguage: "en", toLanguage: "zh-CHS" };

describe("Youdao dictionary request", () => {
  it("returns semantic content without retaining the vendor response", async () => {
    vi.mocked(timedFetch).mockResolvedValueOnce({
      input: "good",
      le: "en",
      web_trans: { "web-translation": [{ key: "good", trans: [{ value: "好的" }] }] },
      collins: { unused: "vendor payload" },
    });
    const signal = new AbortController().signal;

    const result = await new YoudaoDictionaryProvider().request(query, { signal });

    expect(timedFetch).toHaveBeenCalledWith(expect.stringContaining("https://dict.youdao.com/jsonapi?"), { signal });
    expect(result).toMatchObject({
      type: DictionaryType.Youdao,
      content: {
        kind: "dictionary",
        sections: [
          { kind: "translation", text: "好的" },
          { kind: "pairs", relation: "web-translation", entries: [{ expression: "good", meaning: "好的" }] },
        ],
      },
    });
    expect(result).not.toHaveProperty("result");
    expect(JSON.stringify(result)).not.toContain("vendor payload");
  });

  it("normalizes an invalid top-level response to a provider error", async () => {
    vi.mocked(timedFetch).mockResolvedValueOnce(null);

    await expect(new YoudaoDictionaryProvider().request(query)).rejects.toMatchObject({
      constructor: RequestError,
      type: DictionaryType.Youdao,
      message: "Invalid Youdao dictionary response",
    });
  });
});
