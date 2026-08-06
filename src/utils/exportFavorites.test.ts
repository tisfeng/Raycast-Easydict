import { describe, expect, it } from "vitest";

import type { FavoriteWord } from "@/types/favorite";

import { exportAsCSV, exportAsJSON, exportAsText } from "./exportFavorites";

function makeFavorite(overrides: Partial<FavoriteWord> = {}): FavoriteWord {
  return {
    word: "serendipity",
    fromLanguage: "en",
    toLanguage: "zh-CHS",
    isWord: true,
    translations: ["机缘巧合"],
    displaySections: [],
    createdAt: 1722864000000,
    ...overrides,
  };
}

describe("exportAsText", () => {
  it("joins word and translation with a tab", () => {
    const out = exportAsText([makeFavorite()]);
    expect(out).toBe("serendipity\t机缘巧合");
  });

  it("joins multiple translations with a comma", () => {
    const out = exportAsText([makeFavorite({ translations: ["机缘巧合", "意外发现"] })]);
    expect(out).toBe("serendipity\t机缘巧合, 意外发现");
  });

  it("leaves an empty translation column when no translations", () => {
    const out = exportAsText([makeFavorite({ translations: undefined })]);
    expect(out).toBe("serendipity\t");
  });

  it("separates entries with newlines", () => {
    const out = exportAsText([makeFavorite(), makeFavorite({ word: "ephemeral", translations: ["短暂"] })]);
    expect(out).toBe("serendipity\t机缘巧合\nephemeral\t短暂");
  });
});

describe("exportAsCSV", () => {
  it("emits a header row plus one quoted row per favorite", () => {
    const out = exportAsCSV([makeFavorite()]);
    const lines = out.split("\n");
    expect(lines[0]).toBe('"Word","Translation","From","To"');
    expect(lines[1]).toBe('"serendipity","机缘巧合","en","zh-CHS"');
    expect(lines).toHaveLength(2);
  });

  it("escapes embedded double quotes by doubling them", () => {
    const out = exportAsCSV([makeFavorite({ word: 'so-called "word"', translations: ['a "quote"'] })]);
    expect(out).toContain('"so-called ""word""","a ""quote"""');
  });

  it("handles empty translations", () => {
    const out = exportAsCSV([makeFavorite({ translations: undefined })]);
    expect(out.split("\n")[1]).toBe('"serendipity","","en","zh-CHS"');
  });
});

describe("exportAsJSON", () => {
  it("produces parseable JSON with the documented fields", () => {
    const parsed = JSON.parse(exportAsJSON([makeFavorite()]));
    expect(parsed).toEqual([
      {
        word: "serendipity",
        translations: ["机缘巧合"],
        fromLanguage: "en",
        toLanguage: "zh-CHS",
        isWord: true,
        createdAt: 1722864000000,
      },
    ]);
  });

  it("excludes the heavy displaySections snapshot", () => {
    const parsed = JSON.parse(exportAsJSON([makeFavorite({ displaySections: [{ type: "x", items: [] }] as never })]));
    expect(parsed[0]).not.toHaveProperty("displaySections");
  });
});
