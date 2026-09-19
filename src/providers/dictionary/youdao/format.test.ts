import { describe, expect, it, vi } from "vitest";

import { YoudaoDictionaryListItemType } from "@/core/results/kinds";
import type { QueryWordInfo } from "@/core/results/types";

import { formatYoudaoDisplaySections } from "./format";
import type { YoudaoDictionaryData } from "./types";

vi.mock("@raycast/api", () => ({ environment: { isDevelopment: false } }));

const query: QueryWordInfo = { word: "行", fromLanguage: "zh-CHS", toLanguage: "en", isWord: true };

const modernChineseResult: YoudaoDictionaryData = {
  translation: "go",
  modernChineseDict: [
    {
      word: "行",
      pinyin: "xíng",
      sense: [
        {
          cat: "动",
          def: ["行走", "前进"],
          examples: ["步行", "日行千里"],
          subsense: [{ def: "旅行", examples: ["远行"] }, { def: "流动" }],
        },
        { cat: "动", def: "做", examples: ["实行"] },
        { cat: "名", def: "行为" },
        { cat: "动", def: "可以" },
      ],
    },
    {
      word: "行",
      pinyin: "háng",
      sense: [{ def: "行列", examples: ["一行树"] }, { subsense: [{ def: "行业" }] }],
    },
  ],
};

describe("Youdao display formatter", () => {
  it.each([
    {
      name: "a single form",
      forms: [{ wf: { name: "过去式", value: "ran" } }],
      copyText: "过去式: ran",
      body: " [ 过去式: ran ]",
    },
    {
      name: "multiple forms",
      forms: [{ wf: { name: "过去式", value: "ran" } }, { wf: { name: "过去分词", value: "run" } }],
      copyText: "过去式: ran   过去分词: run",
      body: " [ 过去式: ran   过去分词: run ]",
    },
  ])("keeps $name in one copyable row without copying the display brackets", ({ forms, copyText, body }) => {
    const sections = formatYoudaoDisplaySections(
      { word: "run", fromLanguage: "en", toLanguage: "zh-CHS" },
      { translation: "跑", forms },
    );

    expect(sections?.map((section) => section.type)).toEqual([
      YoudaoDictionaryListItemType.Translation,
      YoudaoDictionaryListItemType.Forms,
    ]);
    expect(sections?.[1]).toMatchObject({
      sectionTitle: "Details",
      items: [{ title: "", subtitle: body, copyText, detailsMarkdown: body }],
    });
  });

  it("keeps pronunciation rows, consecutive categories, recursive senses, and examples in list, copy, and Markdown", () => {
    const sections = formatYoudaoDisplaySections(query, modernChineseResult);

    expect(sections?.map((section) => section.type)).toEqual([
      YoudaoDictionaryListItemType.Translation,
      YoudaoDictionaryListItemType.ModernChineseDict,
    ]);
    expect(sections?.[0].items[0].accessoryItem).toMatchObject({ phonetic: "/ xíng /" });
    expect(sections?.[1]).toMatchObject({
      sectionTitle: "Details",
      items: [
        {
          title: "xíng",
          subtitle:
            "动   1. 行走; 前进：步行/日行千里     1.1. 旅行：远行   1.2. 流动  2. 做：实行  名   1. 行为动   1. 可以",
          copyText:
            "xíng  动   1. 行走; 前进：步行/日行千里     1.1. 旅行：远行   1.2. 流动  2. 做：实行  名   1. 行为动   1. 可以",
          detailsMarkdown:
            "xíng\n\n动 \n\n1. 行走; 前进：`步行`/`日行千里`    \n1.1. 旅行：`远行`  \n1.2. 流动\n\n2. 做：`实行`  \n\n名 \n\n1. 行为\n\n动 \n\n1. 可以",
        },
        {
          title: "háng",
          subtitle: "~  1. 行列：一行树    2. ~   2.1. 行业",
          copyText: "háng  ~  1. 行列：一行树    2. ~   2.1. 行业",
          detailsMarkdown: "háng\n\n~\n\n1. 行列：`一行树`  \n\n2. ~  \n2.1. 行业",
        },
      ],
    });
  });

  it("preserves an existing phonetic instead of replacing it with Chinese pinyin", () => {
    const sections = formatYoudaoDisplaySections({ ...query, phonetic: "/ existing /" }, modernChineseResult);

    expect(sections?.[0].items[0].accessoryItem).toMatchObject({ phonetic: "/ existing /" });
  });

  it("uses pinyin from an entry without senses only as a display fallback, leaving query phonetic unset", () => {
    const sections = formatYoudaoDisplaySections(query, {
      ...modernChineseResult,
      modernChineseDict: [{ word: "行", pinyin: "hàng" }, ...(modernChineseResult.modernChineseDict ?? [])],
    });

    expect(sections?.[0].items[0].accessoryItem).toMatchObject({ phonetic: "/ hàng /" });
    expect(sections?.[0].items[0].queryWordInfo.phonetic).toBeUndefined();
  });

  it.each([
    {
      name: "a Baike summary starting with its subject",
      summary: { baike: { key: "光", summary: "光是一种电磁辐射。" } },
      type: YoudaoDictionaryListItemType.Baike,
      subtitle: "光是一种电磁辐射。",
      copyText: "光 光是一种电磁辐射。",
      body: "光是一种电磁辐射。",
    },
    {
      name: "a Wikipedia summary quoting its subject",
      summary: { wikipedia: { key: "光", summary: '物理学中的"光"是可见的电磁辐射。' } },
      type: YoudaoDictionaryListItemType.Wikipedia,
      subtitle: '物理学中的"光"是可见的电磁辐射。',
      copyText: '光 物理学中的"光"是可见的电磁辐射。',
      body: '物理学中的"光"是可见的电磁辐射。',
    },
    {
      name: "a Baike summary without its subject",
      summary: { baike: { key: "光", summary: "可见的电磁辐射。" } },
      type: YoudaoDictionaryListItemType.Baike,
      subtitle: "可见的电磁辐射。",
      copyText: "光 可见的电磁辐射。",
      body: "光 可见的电磁辐射。",
    },
  ])("avoids repeating the subject in the body of $name", ({ summary, type, subtitle, copyText, body }) => {
    const sections = formatYoudaoDisplaySections({ ...query, word: "光" }, { translation: "light", ...summary });

    expect(sections?.[1]).toMatchObject({
      type,
      items: [{ title: "光", subtitle, copyText, detailsMarkdown: body }],
    });
  });
});
