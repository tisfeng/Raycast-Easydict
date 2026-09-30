import { describe, expect, it, vi } from "vitest";

import { DictionaryType, TranslationType } from "@/core/results/kinds";
import type { QueryWordInfo } from "@/core/results/types";

import type { ComposedService } from "./compose";
import { renderSavedView, renderSelectedRow, renderStandaloneRow } from "./render";
import type { DictionarySection } from "./types";
import { buildContentView } from "./view";

vi.mock("@/core/results/appearance", () => ({ isDarkAppearance: () => false }));

const query = { word: "testimony", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };
function translation(serviceId: string, paragraphs: readonly string[], info: QueryWordInfo = query): ComposedService {
  return {
    type: TranslationType.OpenAI,
    serviceId,
    serviceLabel: serviceId,
    serviceOrder: 0,
    content: { kind: "translation", query: info, paragraphs },
  };
}
function dictionary(
  sections: readonly DictionarySection[],
  info: QueryWordInfo = query,
  type = DictionaryType.Youdao,
): ComposedService {
  return {
    type,
    serviceId: "dictionary",
    serviceLabel: "Youdao Dictionary",
    serviceOrder: 1,
    content: { kind: "dictionary", query: info, sections },
  };
}
function view(...services: ComposedService[]) {
  return buildContentView({ services, isShowDetail: false }, true);
}

describe("content rendering", () => {
  it("keeps word and pronunciation together in an inline SVG and shows the direction only in standalone details", () => {
    const info = { ...query, phonetic: "/ ˈtestɪmoʊni /" };
    const sections = view(dictionary([{ kind: "translation", text: "证词" }], info));

    const standalone = renderStandaloneRow(sections[0].items[0]);
    const saved = renderSavedView(info, sections);
    for (const markdown of [standalone, saved]) {
      const encoded = markdown.match(/base64,([A-Za-z0-9+/=]+)/);
      expect(encoded).not.toBeNull();
      const svg = Buffer.from(encoded![1], "base64").toString("utf8");
      expect(svg).toContain("testimony<tspan");
      expect(svg).toContain("/ ˈtestɪmoʊni /</tspan>");
      expect(svg).not.toContain("English");
      expect(svg).toContain('font-family="Georgia, Times New Roman, serif"');
      expect(markdown).toContain("**证词**");
      expect(markdown).not.toContain("## testimony");
    }
    expect(standalone).toContain("  \nEnglish → Chinese\\-Simplified");
    expect(saved).not.toContain("English → Chinese\\-Simplified");
  });

  it("keeps the header image inline at a fixed height so Raycast does not center it", () => {
    const info = { ...query, word: "good", phonetic: "/ɡʊd/" };
    const sections = view(dictionary([{ kind: "translation", text: "好" }], info));
    const markdown = renderStandaloneRow(sections[0].items[0]);
    // Raycast centers a paragraph whose only content is an image; the trailing
    // zero-width space keeps the header on the text baseline instead.
    expect(markdown).toMatch(/raycast-height=34\)\u200B/);
  });

  it("escapes short headwords in the shared SVG header and lets very long headwords wrap as text", () => {
    const [section] = view(translation("One", ["translation"], { ...query, word: "<b>x" }));
    const markdown = renderStandaloneRow(section.items[0]);
    const encoded = markdown.match(/base64,([A-Za-z0-9+/=]+)/);
    expect(encoded).not.toBeNull();
    const svg = Buffer.from(encoded![1], "base64").toString("utf8");
    expect(svg).toContain("&lt;b&gt;x");
    expect(svg).not.toContain("<b>");
    const longWord = "W".repeat(30);
    const [longSection] = view(translation("One", ["translation"], { ...query, word: longWord }));
    const longMarkdown = renderStandaloneRow(longSection.items[0]);
    expect(longMarkdown).toContain(`## ${longWord}`);
    expect(longMarkdown).not.toContain("data:image");
  });

  it("lets a long pronunciation wrap as native text while preserving the SVG word", () => {
    const phonetic = "a".repeat(80);
    const [section] = view(translation("One", ["translation"], { ...query, word: "good", phonetic }));
    const markdown = renderStandaloneRow(section.items[0]);
    const encoded = markdown.match(/base64,([A-Za-z0-9+/=]+)/);
    expect(encoded).not.toBeNull();
    const svg = Buffer.from(encoded![1], "base64").toString("utf8");
    expect(svg).toContain("good</text>");
    expect(svg).not.toContain(phonetic);
    expect(markdown).toContain(`  \n${phonetic}  \nEnglish → Chinese\\-Simplified`);
  });

  it("compares visible profiles with the selected service first and marks differing language directions", () => {
    const sections = view(
      translation("One", ["证词"]),
      translation("Two", ["témoignage"], { ...query, toLanguage: "fr" }),
    );
    const markdown = renderSelectedRow(sections[1].items[0], sections);
    expect(markdown).toContain("<table>");
    expect(markdown).not.toContain("<th>");
    expect(markdown).toContain("One · English → Chinese-Simplified");
    expect(markdown.indexOf("Two")).toBeLessThan(markdown.indexOf("One"));
    expect(markdown).not.toContain(query.word);
    expect(sections.map((section) => section.service.serviceId)).toEqual(["One", "Two"]);
  });

  it("uses a dictionary translation's own body instead of the neighboring machine comparison", () => {
    const sections = view(translation("One", ["machine text"]), dictionary([{ kind: "translation", text: "证词" }]));
    expect(renderSelectedRow(sections[1].items[0], sections)).toBe("**证词**");
    expect(renderStandaloneRow(sections[1].items[0])).toContain("<small>Youdao Dictionary</small>\n\n**证词**");
    expect(renderStandaloneRow(sections[1].items[0])).not.toContain("machine text");
  });

  it("renders the shared word header once and numbers definitions without repeating the source subtitle", () => {
    const sections = view(
      dictionary(
        [
          { kind: "translation", text: "证词" },
          {
            kind: "definitions",
            entries: [
              { kind: "plain", text: "n. 证词；证言" },
              { kind: "plain", text: "evidence" },
            ],
          },
        ],
        { ...query, phonetic: "/ɡʊd/" },
      ),
    );
    const markdown = renderSavedView(query, sections);
    expect(markdown.match(/testimony/g)).toHaveLength(1);
    expect(markdown.match(/Youdao Dictionary/g)).toHaveLength(1);
    expect(markdown.match(/ɡʊd/g)).toHaveLength(1);
    expect(markdown).toContain("<small>1.</small> n. 证词；证言");
    expect(markdown).toContain("<small>2.</small> evidence");
    expect(markdown).not.toContain("证词 testimony");
  });

  it("escapes and combines short pairs into one saved table while retaining long prose bodies", () => {
    const sections = view(
      dictionary([
        {
          kind: "pairs",
          relation: "phrase",
          entries: [
            { expression: "<script>", meaning: "A & B" },
            { expression: "next", meaning: "meaning" },
          ],
        },
      ]),
    );
    expect(sections[0].items[0].renderBody()).toBe(
      "<table>\n<tr><td>&lt;script&gt;</td><td>A &amp; B</td></tr>\n</table>",
    );
    const saved = renderSavedView(query, sections);
    expect(saved.match(/<table>/g)).toHaveLength(1);
    expect(saved).not.toContain("<th>");
    expect(saved).toContain("<td>next</td><td>meaning</td>");
    const long = "a".repeat(121);
    const longSections = view(
      dictionary([{ kind: "pairs", relation: "phrase", entries: [{ expression: "term", meaning: long }] }]),
    );
    expect(longSections[0].items[0].renderBody()).toBe(`term ${long}`);
    expect(renderSavedView(query, longSections)).not.toContain("<table>");
  });

  it("renders AI forms and Linguee special forms as compact pair tables without column headers", () => {
    const forms = view(
      dictionary(
        [{ kind: "pairs", relation: "form", entries: [{ expression: "past tense", meaning: "ran" }] }],
        query,
        DictionaryType.AI,
      ),
    );
    expect(forms[0].items[0].copyText).toBe("past tense: ran");
    expect(renderSavedView(query, forms)).toContain("<td>past tense</td><td>ran</td>");
    const equivalents = view(
      dictionary(
        [
          {
            kind: "equivalents",
            headword: { word: "good" },
            entries: [
              {
                text: "bon",
                partOfSpeech: "adj",
                frequency: "special-forms",
                prominent: true,
                inflectionNote: "bonne",
              },
            ],
          },
        ],
        query,
        DictionaryType.Linguee,
      ),
    );
    const saved = renderSavedView(query, equivalents);
    expect(saved).toContain("<table>");
    expect(saved).not.toContain("<th>");
  });

  it("keeps multiline source and translation paragraphs outside headings and comparison tables", () => {
    const sentence = { ...query, word: "First line\nSecond line", isWord: false };
    const sections = view(translation("One", ["第一段", "", "第二段"], sentence));
    expect(sections[0].items[0]).toMatchObject({ title: "第一段, , 第二段", copyText: "第一段\n\n第二段" });
    const standalone = renderStandaloneRow(sections[0].items[0]);
    expect(standalone).toContain("> First line  \n> Second line");
    expect(standalone).toContain("第一段\n\n第二段");
    expect(standalone).not.toContain("##");
    expect(standalone).not.toContain("<table>");
    expect(renderSelectedRow(sections[0].items[0], sections)).not.toContain("First line");
    const saved = renderSavedView(sentence, sections);
    expect(saved).toContain("First line");
    expect(saved).not.toContain("English →");
  });

  it("compacts adjacent translations without moving them across a dictionary and keeps different profiles", () => {
    const sections = view(
      translation("First", ["证词"]),
      dictionary([{ kind: "translation", text: "证言" }]),
      translation("Second", ["证词"]),
      translation("Third", ["证据"]),
    );
    const saved = renderSavedView(query, sections);
    expect(saved.indexOf("First")).toBeLessThan(saved.indexOf("Youdao Dictionary"));
    expect(saved.indexOf("Youdao Dictionary")).toBeLessThan(saved.indexOf("Second"));
    expect(saved).toContain("Third");
    expect(saved.match(/<table>/g)).toHaveLength(1);
    expect(saved.match(/testimony/g)).toHaveLength(1);
  });

  it("skips empty sections and labels a dictionary's different direction and pronunciation", () => {
    const sections = view(
      dictionary(
        [
          { kind: "definitions", entries: [] },
          { kind: "translation", text: "témoignage", pronunciation: "temwaɲaʒ" },
        ],
        { ...query, toLanguage: "fr" },
      ),
    );
    const saved = renderSavedView({ ...query, phonetic: "source sound" }, sections);
    expect(saved).toContain("Youdao Dictionary · English → French · temwaɲaʒ");
    expect(saved).toContain("**témoignage**");
    expect(saved).not.toContain("Explanation");
  });
});
