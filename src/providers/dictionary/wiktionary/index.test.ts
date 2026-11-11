import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { WiktionaryDictionaryProvider } from ".";
import { parseWiktionaryPronunciation } from "./parse";

const fetchRaw = vi.hoisted(() => vi.fn());
vi.mock("@/shared/http", () => ({ timedFetch: { raw: fetchRaw } }));
vi.mock("@raycast/api", () => ({
  environment: { isDevelopment: false },
  getPreferenceValues: () => ({}),
}));

const fixture = (name: string) => readFileSync(`${__dirname}/fixtures/${name}`, "utf8");

const pages: Record<string, () => unknown> = {
  "rest_v1/page/definition/hus": () => JSON.parse(fixture("definition-hus.json")),
  "rest_v1/page/definition/house": () => JSON.parse(fixture("definition-house.json")),
  "title=hus&action=raw": () => fixture("hus.wikitext"),
  "title=house&action=raw": () => fixture("house.wikitext"),
  "title=house/translations&action=raw": () => fixture("house-translations.wikitext"),
  "action=parse&title=hus&prop=text&contentmodel=wikitext&": () => JSON.parse(fixture("parse-hus.json")),
  "action=parse&title=house&prop=text&contentmodel=wikitext&": () => JSON.parse(fixture("parse-house.json")),
};

beforeEach(() => {
  fetchRaw.mockReset();
  fetchRaw.mockImplementation(async (url: string) => {
    const page = Object.entries(pages).find(([path]) => url.endsWith(path) || url.includes(`${path}format`))?.[1];
    return page ? { status: 200, ok: true, _data: page() } : { status: 404, ok: false, _data: undefined };
  });
});

describe("Wiktionary dictionary", () => {
  it("shows English glosses, pronunciation, and word forms for a Danish word", async () => {
    const result = await new WiktionaryDictionaryProvider().request({
      word: "hus",
      fromLanguage: "da",
      toLanguage: "en",
    });
    const sections = result.content.sections;

    expect(result.content.query).toMatchObject({ word: "hus", isWord: true, phonetic: "[ˈhuˀs]" });
    expect(sections[0]).toEqual({
      kind: "translation",
      text: "house; building; block of flats, cottage",
      lemma: "hus",
    });
    expect(sections[1]).toEqual({
      kind: "form-set",
      forms: [
        { label: "noun", value: "hus" },
        { label: "gender", value: "neuter" },
        { label: "singular definite", value: "huset" },
        { label: "plural indefinite", value: "huse" },
      ],
    });
    expect(sections[2]).toMatchObject({
      kind: "equivalents",
      headword: { word: "hus", partOfSpeech: "noun" },
      entries: [
        { text: "house", partOfSpeech: "n", prominent: true },
        { text: "building", partOfSpeech: "n", prominent: true },
        { text: "block of flats, cottage", partOfSpeech: "n", prominent: true },
        { text: "shell", partOfSpeech: "n", prominent: true },
      ],
    });
    // "imperative of huse" is a grammatical form, folded into a collapsed row.
    expect(sections).toContainEqual({
      kind: "equivalents",
      headword: { word: "hus", partOfSpeech: "verb" },
      entries: [{ text: "imperative of huse", partOfSpeech: "v", prominent: false, frequency: "special-forms" }],
    });
    // Only the Danish headword templates are rendered, not the whole section.
    const formsCall = fetchRaw.mock.calls.find(([url]) => String(url).includes("action=parse"));
    expect(formsCall?.[1]).toMatchObject({ method: "POST" });
    expect((formsCall?.[1].body as URLSearchParams).get("text")).toBe(
      "===Noun===\n{{da-noun|et|e}}\n===Verb===\n{{head|da|verb form}}",
    );
  });

  it("shows Danish translations, forms, and examples for an English word", async () => {
    const result = await new WiktionaryDictionaryProvider().request({
      word: "house",
      fromLanguage: "en",
      toLanguage: "da",
    });
    const sections = result.content.sections;

    expect(result.content.query.phonetic).toBe("/haʊ̯s/");
    expect(sections[0]).toMatchObject({ kind: "translation", text: "hus" });
    expect(sections[1]).toMatchObject({
      kind: "form-set",
      forms: [
        { label: "noun", value: "house" },
        { label: "plural", value: "houses" },
      ],
    });
    expect(sections).toContainEqual({
      kind: "equivalents",
      headword: { word: "house", qualifier: "(human abode)", partOfSpeech: "noun" },
      entries: [{ text: "hus", partOfSpeech: "n", prominent: true, frequency: "common" }],
    });
    expect(sections).toContainEqual(
      expect.objectContaining({
        headword: expect.objectContaining({
          qualifier: "(keep within a structure or container)",
          partOfSpeech: "verb",
        }),
        entries: [expect.objectContaining({ text: "indhuse", partOfSpeech: "v" })],
      }),
    );
    // Illustrations before `{{en-noun}}` must not hide the headword template from the rendered fragment.
    const formsCall = fetchRaw.mock.calls.find(([url]) => String(url).includes("action=parse"));
    expect((formsCall?.[1].body as URLSearchParams).get("text")).toBe(
      [
        "====Noun====",
        "{{en-noun|~|s|housen<l:dialectal>|hice<l:chiefly,humorous>}}",
        "====Verb====",
        "{{en-verb}}",
        "====Noun====",
        "{{en-noun|-}}",
      ].join("\n"),
    );
    expect(sections.map((section) => section.kind)).not.toContain("examples");
    expect(sections.at(-1)).toMatchObject({
      kind: "definitions",
      entries: expect.arrayContaining([
        {
          kind: "structured",
          meanings: [expect.stringContaining("A structure built or serving as an abode of human beings")],
          partOfSpeech: "n",
          examples: [{ sentence: "This is my house and my family's ancestral home." }],
        },
      ]),
    });
  });

  it("shows Bokmål and Nynorsk entries for a Norwegian word", async () => {
    const result = await new WiktionaryDictionaryProvider().request({
      word: "hus",
      fromLanguage: "no",
      toLanguage: "en",
    });

    expect(result.content.query.phonetic).toBe("/hʉːs/");
    // Bokmål and Nynorsk share the meaning "a house"; it is shown once.
    expect(result.content.sections[0]).toMatchObject({ kind: "translation", text: "a house" });
    const glosses = result.content.sections.flatMap((section) =>
      section.kind === "equivalents" ? section.entries.map((entry) => entry.text) : [],
    );
    expect(glosses.filter((gloss) => gloss === "a house")).toHaveLength(1);
    expect(result.content.sections).toContainEqual(
      expect.objectContaining({
        kind: "equivalents",
        headword: { word: "hus", partOfSpeech: "noun" },
        entries: expect.arrayContaining([expect.objectContaining({ text: "a house" })]),
      }),
    );
    const formsCall = fetchRaw.mock.calls.find(([url]) => String(url).includes("action=parse"));
    const fragment = (formsCall?.[1].body as URLSearchParams).get("text");
    expect(fragment).toContain("{{nb-noun-n1}}");
    expect(fragment).toContain("{{nn-noun-n1}}");
  });

  it.each(["sr-Latn", "hr"])("shows Serbo-Croatian translations for %s", async (toLanguage) => {
    const result = await new WiktionaryDictionaryProvider().request({ word: "house", fromLanguage: "en", toLanguage });

    expect(result.content.sections).toContainEqual(
      expect.objectContaining({
        headword: expect.objectContaining({ qualifier: "(human abode)" }),
        entries: expect.arrayContaining([expect.objectContaining({ text: "kȕća" })]),
      }),
    );
  });

  it("puts each meaning's first example inline, strips embedded styles, and keeps long definitions out of the first row", async () => {
    pages["rest_v1/page/definition/contingency"] = () => ({
      en: [
        {
          partOfSpeech: "Noun",
          language: "English",
          definitions: [
            {
              definition:
                'The quality of being contingent. <style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .defdate{font-size:smaller}</style>',
              parsedExamples: [{ example: "The <b>contingency</b> of events.", translation: "Det tilfældige." }],
            },
            { definition: "An amount of money paid to the other party (usually the supplier) on breach of contract." },
          ],
        },
      ],
    });
    const result = await new WiktionaryDictionaryProvider().request({
      word: "contingency",
      fromLanguage: "en",
      toLanguage: "da",
    });

    expect(result.content.sections[0]).toEqual({
      kind: "translation",
      text: "The quality of being contingent.",
      lemma: "contingency",
    });
    expect(result.content.sections[1]).toMatchObject({
      kind: "equivalents",
      entries: [
        {
          text: "The quality of being contingent.",
          firstExampleTranslation: "The contingency of events.",
          examples: [{ sentence: "The contingency of events.", translation: "Det tilfældige." }],
        },
        { text: "An amount of money paid to the other party (usually the supplier) on breach of contract." },
      ],
    });
    delete pages["rest_v1/page/definition/contingency"];
  });

  it("uses the Commons MP3 transcode of the first recording for the source language", () => {
    const wikitext =
      "==English==\n{{audio|en|en-us-cat.ogg}}\n==Danish==\n* {{IPA|da|[kʰæd]}}\n* {{audio|da|Da-kat.ogg}}\n";

    expect(parseWiktionaryPronunciation(wikitext, ["Danish"], ["da"])).toEqual({
      ipa: "[kʰæd]",
      audioUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/35/Da-kat.ogg/Da-kat.ogg.mp3",
    });
  });

  it("uses the original file of an MP3 recording, which Commons does not transcode", () => {
    const wikitext = "==Hausa==\n* {{audio|ha|Karai-Karai pronunciation.mp3}}\n";

    expect(parseWiktionaryPronunciation(wikitext, ["Hausa"], ["ha"]).audioUrl).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/7/73/Karai-Karai_pronunciation.mp3",
    );
  });

  it("retries a capitalized word in lowercase", async () => {
    const result = await new WiktionaryDictionaryProvider().request({
      word: "Hus",
      fromLanguage: "da",
      toLanguage: "en",
    });

    expect(result.content.query.word).toBe("hus");
    expect(result.content.sections.length).toBeGreaterThan(0);
  });

  it("returns no sections for a missing page instead of failing", async () => {
    const result = await new WiktionaryDictionaryProvider().request({
      word: "qwzxv",
      fromLanguage: "da",
      toLanguage: "en",
    });

    expect(result.content.sections).toEqual([]);
  });

  it("reports server errors as request failures", async () => {
    fetchRaw.mockResolvedValue({ status: 503, ok: false, _data: undefined });

    await expect(
      new WiktionaryDictionaryProvider().request({ word: "hus", fromLanguage: "da", toLanguage: "en" }),
    ).rejects.toThrow("503");
  });
});
