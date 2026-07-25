/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { describe, expect, it } from "vitest";

import { LingueeListItemType } from "@/providers/dictionary/linguee/types";
import { DictionaryType, TranslationType } from "@/types/api";
import type { DisplaySection, ListDisplayItem } from "@/types/display";

import { getDisplaySectionIds, getListItemId } from "./displayIdentities";

describe("display identities", () => {
  it("keeps a provider section stable when an earlier provider result arrives", () => {
    const google = createSection("static:google", TranslationType.Google, TranslationType.Google);
    const linguee = createSection("static:linguee", DictionaryType.Linguee, LingueeListItemType.Translation);

    expect(getDisplaySectionIds([google], 4)).toEqual([
      `query:4:section:service:static:google:${TranslationType.Google}:0`,
    ]);
    expect(getDisplaySectionIds([linguee, google], 4)[1]).toBe(
      `query:4:section:service:static:google:${TranslationType.Google}:0`,
    );
  });

  it("distinguishes configured services that share the same provider type", () => {
    const firstProfile = createSection("profile:first", TranslationType.OpenAI, TranslationType.OpenAI);
    const secondProfile = createSection("profile:second", TranslationType.OpenAI, TranslationType.OpenAI);

    expect(getDisplaySectionIds([firstProfile, secondProfile], 4)).toEqual([
      `query:4:section:service:profile:first:${TranslationType.OpenAI}:0`,
      `query:4:section:service:profile:second:${TranslationType.OpenAI}:0`,
    ]);
  });

  it("does not reuse section or item IDs across query generations", () => {
    const sections = [createSection("static:google", TranslationType.Google, TranslationType.Google)];
    const firstSectionId = getDisplaySectionIds(sections, 4)[0];
    const nextSectionId = getDisplaySectionIds(sections, 5)[0];

    expect(firstSectionId).not.toBe(nextSectionId);
    expect(getListItemId(firstSectionId, 0)).not.toBe(getListItemId(nextSectionId, 0));
  });

  it("creates unique item IDs without depending on mutable titles or keys", () => {
    const sectionId = "query:1:section:provider:result:0";

    expect(getListItemId(sectionId, 0)).toBe("query:1:section:provider:result:0:item:0");
    expect(getListItemId(sectionId, 1)).toBe("query:1:section:provider:result:0:item:1");
  });
});

function createSection(
  serviceId: string,
  queryType: ListDisplayItem["queryType"],
  type: DisplaySection["type"],
): DisplaySection {
  const queryWordInfo = { word: "test", fromLanguage: "en", toLanguage: "zh-CHS" };
  const item = {
    queryType,
    queryWordInfo,
    key: "mutable-result-text",
    title: "Mutable Result Text",
    copyText: "Mutable Result Text",
  } as ListDisplayItem;

  return { serviceId, type, items: [item] };
}
