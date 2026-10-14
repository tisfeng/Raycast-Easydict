import { describe, expect, it } from "vitest";

import { DictionaryType } from "@/core/results/kinds";

import { contextPreview, imageToken } from "./context";
import { exampleHtml } from "./html";
import { buildFields, defaultProfile, emptyDraft, seedFromRow } from "./model";

describe("target examples", () => {
  it("wraps the exact target word in the requested HTML", () => {
    expect(exampleHtml("A large grouper hovered beside the reef.", "grouper")).toBe(
      'A large <b class="target">grouper</b> hovered beside the reef.',
    );
  });
  it("matches phrases and repeated words while preserving case and boundaries", () => {
    expect(exampleHtml("Grouper, grouper, groupers, agrouper", "grouper")).toBe(
      '<b class="target">Grouper</b>, <b class="target">grouper</b>, groupers, agrouper',
    );
    expect(exampleHtml("Maintain neutral buoyancy.", "neutral buoyancy")).toBe(
      'Maintain <b class="target">neutral buoyancy</b>.',
    );
    expect(exampleHtml("C++ is a language", "C++")).toBe('<b class="target">C++</b> is a language');
    expect(exampleHtml("They charged us.", "charge")).toBe("They charged us.");
  });
  it("keeps existing target tags without nesting and treats other HTML as text", () => {
    const input = 'A <b class="target">grouper</b> and grouper.';
    const expected = 'A <b class="target">grouper</b> and <b class="target">grouper</b>.';
    expect(exampleHtml(input, "grouper")).toBe(expected);
    expect(exampleHtml(expected, "grouper")).toBe(expected);
    expect(exampleHtml("<img src=x onerror=alert(1)>grouper", "grouper")).toBe(
      '&lt;img src=x onerror=alert(1)&gt;<b class="target">grouper</b>',
    );
  });
  it("extracts only original example sentences and prefers an attached sense example", () => {
    const row = {
      kind: "example" as const,
      title: "A grouper hovered.",
      copyText: "A grouper hovered. — 石斑鱼悬停。",
      renderBody: () => "",
      service: {
        kind: "dictionary" as const,
        query: { word: "grouper", fromLanguage: "en", toLanguage: "zh-CHS" },
        type: DictionaryType.Youdao,
        serviceId: "youdao",
        serviceLabel: "Youdao",
      },
    };
    expect(seedFromRow(row).example).toBe("A grouper hovered.");
    expect(
      seedFromRow({ ...row, kind: "definition", exampleSentence: "Sense example." }, "Other example").example,
    ).toBe("Sense example.");
  });
});
describe("unified context", () => {
  const profile = { ...defaultProfile(), deck: "Default", model: "Vocabulary" };
  const fields = ["English", "Chinese", "Example", "Context"];
  it("renders a registered image in place and keeps sources as plain text", () => {
    const draft = {
      ...emptyDraft("grouper"),
      context: `Before\n${imageToken("/local.png")}\nSource: reef`,
      images: ["/local.png"],
      example: "A grouper hovered.",
    };
    const result = buildFields(profile, draft, fields, ["anki.png"]);
    expect(result.Context).toBe('Before<br><img src="anki.png"><br>Source: reef');
    expect(result.Example).toBe('A <b class="target">grouper</b> hovered.');
  });
  it("does not render removed attachments or arbitrary local/remote image references", () => {
    const draft = { ...emptyDraft(), context: "Source", images: ["/removed.png"] };
    expect(buildFields(profile, { ...draft, term: "x" }, fields, ["anki.png"]).Context).toBe("Source");
    const preview = contextPreview({ context: "![remote](https://example.com/x.png)", images: [] });
    expect(preview).toContain("````");
    expect(contextPreview({ context: imageToken("/local image.png"), images: ["/local image.png"] })).toContain(
      "file:///local%20image.png",
    );
  });
});
