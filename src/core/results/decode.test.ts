import { describe, expect, it } from "vitest";

import { decodeDisplaySections } from "./decode";
import { DictionaryType, LingueeListItemType, TranslationType } from "./kinds";

const info = { word: "hello", fromLanguage: "en", toLanguage: "zh-CHS" };
const item = {
  queryType: DictionaryType.Linguee,
  displayType: LingueeListItemType.Common,
  queryWordInfo: info,
  key: "entry",
  title: "你好",
  copyText: "你好 hello",
};
const sections = [{ type: LingueeListItemType.Common, items: [item] }];

describe("persisted result decoding", () => {
  it("preserves legacy missing metadata and mixed Linguee frequencies in one section", () => {
    const source = [{ ...sections[0], items: [item, { ...item, displayType: LingueeListItemType.LessCommon }] }];
    expect(decodeDisplaySections(JSON.parse(JSON.stringify(source)))).toEqual(source);
  });

  it("preserves all known optional rendering fields and icon variants", () => {
    for (const serviceIcon of [
      { kind: "preset", name: "openai" },
      { kind: "remote", url: "https://example.com/icon.png" },
      { kind: "favicon", website: "https://example.com" },
      { kind: "initials" },
    ]) {
      const source = [
        {
          ...sections[0],
          serviceId: "profile:1",
          sectionTitle: "Details",
          items: [
            {
              ...item,
              serviceId: "profile:1",
              serviceLabel: "Example",
              serviceIcon,
              fromCache: true,
              subtitle: "noun",
              tooltip: "Common",
              detailsMarkdown: "**你好**",
              accessoryItem: { phonetic: "hello", examTypes: ["CET4"], example: "hello there" },
              queryWordInfo: {
                ...info,
                isWord: true,
                phonetic: "hello",
                speechUrl: "https://example.com/audio.mp3",
                examTypes: ["CET4"],
              },
            },
          ],
        },
      ];
      expect(decodeDisplaySections(JSON.parse(JSON.stringify(source)))).toEqual(source);
    }
  });

  it.each([
    { detailsMarkdown: 17 },
    { subtitle: [] },
    { fromCache: "yes" },
    { serviceLabel: false },
    { accessoryItem: { examTypes: [17] } },
    { accessoryItem: { phonetic: {} } },
    { queryWordInfo: { ...info, isWord: "yes" } },
    { queryWordInfo: { ...info, speechUrl: {} } },
    { queryWordInfo: { ...info, examTypes: [false] } },
    { serviceIcon: { kind: "preset", name: "unknown" } },
    { serviceIcon: { kind: "remote", url: 17 } },
    { displayType: "Definition" },
    { queryType: "unknown" },
    { queryType: TranslationType.Bing },
  ])("rejects invalid fields before they reach rendering (%j)", (override) => {
    expect(() => decodeDisplaySections([{ ...sections[0], items: [{ ...item, ...override }] }])).toThrow();
  });

  it("rejects mismatched section and item discriminants", () => {
    expect(() => decodeDisplaySections([{ type: "Definition", items: [item] }])).toThrow();
  });
});
