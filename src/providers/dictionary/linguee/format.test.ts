import { describe, expect, it, vi } from "vitest";

import { LingueeListItemType } from "@/core/results/kinds";
import { resultItemBody } from "@/core/results/resultMarkdown";
import type { DisplaySection, QueryWordInfo } from "@/core/results/types";

import { formatLingueeDisplaySections } from "./format";
import type { LingueeDictionaryResult, LingueeWordExplanation, LingueeWordItem } from "./types";

vi.mock("@/core/results/appearance", () => ({ isDarkAppearance: () => false }));

const queryWordInfo: QueryWordInfo = { word: "good", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };

describe("Linguee display formatter", () => {
  it("does not create a Translation section when the first translation is blank", () => {
    const sections = formatLingueeDisplaySections(
      queryWordInfo,
      createResult({
        wordItems: [createWordItem({ translationItems: [createExplanation("   ")] })],
        examples: [createExample()],
      }),
    );

    expect(sections.some((section) => section.type === LingueeListItemType.Translation)).toBe(false);
  });

  it("preserves headword punctuation, featured notes, and the last unfeatured entry's classification", () => {
    const sections = formatLingueeDisplaySections(
      queryWordInfo,
      createResult({
        wordItems: [
          createWordItem({
            pos: "adj",
            placeholder: "sth.",
            translationItems: [
              createExplanation("良好的", {
                pos: "adj",
                frequencyTag: { tagForms: "unused common note", displayType: LingueeListItemType.Common },
                examples: [
                  {
                    example: { text: "a good book", pos: "" },
                    translations: [
                      { text: "一本好书", pos: "" },
                      { text: "第二个译文", pos: "" },
                    ],
                  },
                  { example: { text: "a good day", pos: "" }, translations: [{ text: "第二个例句", pos: "" }] },
                ],
              }),
              createExplanation("适宜", { featured: false, pos: "adj" }),
              createExplanation("优秀的", {
                pos: "adj",
                frequencyTag: { tagForms: "(often used)", displayType: LingueeListItemType.OftenUsed },
              }),
              createExplanation("bon", {
                pos: "adj",
                frequencyTag: { tagForms: "(bonne f sl)", displayType: LingueeListItemType.SpecialForms },
              }),
              createExplanation("有益", {
                featured: false,
                pos: "v",
                frequencyTag: { tagForms: "", displayType: LingueeListItemType.LessCommon },
              }),
            ],
          }),
          createWordItem({
            word: "goods",
            pos: "n",
            placeholder: "(plural)",
            translationItems: [
              createExplanation("商品", {
                featured: false,
                pos: "adj",
                frequencyTag: { tagForms: "", displayType: LingueeListItemType.LessCommon },
              }),
              createExplanation("货物", { featured: false, pos: "n" }),
            ],
          }),
        ],
      }),
    );

    expect(readingSections(sections)).toEqual([
      {
        heading: "Linguee Dictionary",
        items: [{ type: "Translation", title: "良好的", subtitle: "good", copy: "良好的 good", body: "**良好的**" }],
      },
      {
        heading: "good sth.  adj",
        items: [
          {
            type: "Common",
            title: "良好的",
            subtitle: "adj.       一本好书",
            copy: "良好的 adj.       一本好书",
            body: "良好的 adj.       一本好书",
          },
          {
            type: "Often Used",
            title: "优秀的",
            subtitle: "adj.  (often used)       ",
            copy: "优秀的 adj.  (often used)       ",
            body: "优秀的 adj.  (often used)       ",
          },
          {
            type: "Forms",
            title: "bon",
            subtitle: "adj.  (bonne f sl)       ",
            copy: "bon adj.  (bonne f sl)       ",
            body: "<table>\n<tr><td>bon</td><td>adj.  (bonne f sl)       </td></tr>\n</table>",
          },
          {
            type: "Less Common",
            title: "v.",
            subtitle: "适宜;  有益  (less common)",
            copy: "v. 适宜;  有益  (less common)",
            body: "v. 适宜;  有益  (less common)",
          },
        ],
      },
      {
        heading: "goods (plural).n",
        items: [
          {
            type: "Unfeatured",
            title: "n.",
            subtitle: "商品;  货物  ",
            copy: "n. 商品;  货物  ",
            body: "n. 商品;  货物  ",
          },
        ],
      },
    ]);
  });

  it("limits examples and related words to three while keeping every encyclopedia summary in the title", () => {
    const sections = formatLingueeDisplaySections(
      queryWordInfo,
      createResult({
        examples: [
          {
            example: { text: "good news", pos: "n" },
            translations: [
              { text: "好消息", pos: "" },
              { text: "佳音", pos: "" },
            ],
          },
          createExample(),
          { example: { text: "do good", pos: "v" }, translations: [{ text: "行善", pos: "" }] },
          { example: { text: "omitted example", pos: "" }, translations: [{ text: "不会显示", pos: "" }] },
        ],
        relatedWords: [
          createWordItem({
            word: "goodness",
            pos: "n",
            translationItems: [createExplanation("善良"), createExplanation("美德")],
          }),
          createWordItem({ word: "goodwill", translationItems: [createExplanation("善意")] }),
          createWordItem({ word: "good luck", translationItems: [createExplanation("好运")] }),
          createWordItem({ word: "omitted word" }),
        ],
        wikipedias: [
          { title: "Good", explanation: "An ethical concept.", source: "Wikipedia", sourceUrl: "" },
          { title: "Goods", explanation: "Items for sale.", source: "Wikipedia", sourceUrl: "" },
        ],
      }),
    );

    expect(readingSections(sections)).toEqual([
      {
        heading: "Examples:",
        items: [
          {
            type: "Example",
            title: "good news",
            subtitle: "n.  —  好消息;  佳音",
            copy: "good news n.  —  好消息;  佳音",
            body: "- **good news**  \n  n\\.  —  好消息;  佳音",
          },
          {
            type: "Example",
            title: "a good book",
            subtitle: "—  一本好书",
            copy: "a good book —  一本好书",
            body: "- **a good book**  \n  —  一本好书",
          },
          {
            type: "Example",
            title: "do good",
            subtitle: "v.  —  行善",
            copy: "do good v.  —  行善",
            body: "- **do good**  \n  v\\.  —  行善",
          },
        ],
      },
      {
        heading: "Related words:",
        items: [
          {
            type: "Related word",
            title: "goodness",
            subtitle: "n.  善良;  美德",
            copy: "goodness n.  善良;  美德",
            body: "<table>\n<tr><td>goodness</td><td>n.  善良;  美德</td></tr>\n</table>",
          },
          {
            type: "Related word",
            title: "goodwill",
            subtitle: "善意",
            copy: "goodwill 善意",
            body: "<table>\n<tr><td>goodwill</td><td>善意</td></tr>\n</table>",
          },
          {
            type: "Related word",
            title: "good luck",
            subtitle: "好运",
            copy: "good luck 好运",
            body: "<table>\n<tr><td>good luck</td><td>好运</td></tr>\n</table>",
          },
        ],
      },
      {
        heading: "Wikipedia",
        items: [
          {
            type: "Wikipedia",
            title: "Good An ethical concept.",
            subtitle: "",
            copy: "Good An ethical concept. ",
            body: "Good An ethical concept. ",
          },
          {
            type: "Wikipedia",
            title: "Goods Items for sale.",
            subtitle: "",
            copy: "Goods Items for sale. ",
            body: "Goods Items for sale. ",
          },
        ],
      },
    ]);
  });
});

function readingSections(sections: DisplaySection[]) {
  return sections.map((section) => ({
    heading: section.sectionTitle,
    items: section.items.map((item) => ({
      type: item.displayType,
      title: item.title,
      subtitle: item.subtitle,
      copy: item.copyText,
      body: resultItemBody(item),
    })),
  }));
}

function createResult(overrides: Partial<LingueeDictionaryResult> = {}): LingueeDictionaryResult {
  return {
    wordItems: [],
    examples: [],
    relatedWords: [],
    wikipedias: [],
    ...overrides,
  };
}

function createExample() {
  return {
    example: { text: "a good book", pos: "" },
    translations: [{ text: "一本好书", pos: "" }],
  };
}

function createWordItem(overrides: Partial<LingueeWordItem> = {}): LingueeWordItem {
  return {
    word: "good",
    title: "good",
    featured: true,
    pos: "",
    placeholder: "",
    audioUrl: "",
    translationItems: [createExplanation("良好的")],
    ...overrides,
  };
}

function createExplanation(
  translation: string,
  overrides: Partial<LingueeWordExplanation> = {},
): LingueeWordExplanation {
  return {
    featured: true,
    translation,
    pos: "",
    audioUrl: "",
    examples: [],
    frequencyTag: { tagForms: "", displayType: LingueeListItemType.Common },
    ...overrides,
  };
}
