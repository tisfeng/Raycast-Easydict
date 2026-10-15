import { describe, expect, it } from "vitest";

import { DictionaryType } from "@/core/results/kinds";

import { contextPreview, imageToken } from "./context";
import { exampleHtml, targetMarkup } from "./html";
import { buildFields, defaultProfile, emptyDraft, seedFromRow } from "./model";

describe("target placeholders", () => {
  it("defaults to only the requested target word, with no example sentence", () => {
    expect(emptyDraft("grouper").example).toBe('<b class="target">grouper</b>');
    expect(exampleHtml("", "bearing")).toBe('<b class="target">bearing</b>');
    expect(targetMarkup("neutral buoyancy")).toBe('<b class="target">neutral buoyancy</b>');
    expect(targetMarkup("")).toBe("");
  });
  it("preserves manual target tags without adding tags to other words", () => {
    const input = 'A <b class="target">grouper</b> and grouper.';
    expect(exampleHtml(input, "grouper")).toBe(input);
    expect(exampleHtml("They charged us.", "charge")).toBe("They charged us.");
    expect(exampleHtml("<img src=x onerror=alert(1)>grouper", "grouper")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;grouper",
    );
  });
  it("does not double-escape generated placeholders or interpret nested HTML", () => {
    const marker = targetMarkup("rock & roll");
    expect(marker).toBe('<b class="target">rock &amp; roll</b>');
    expect(exampleHtml(marker, "rock & roll")).toBe(marker);
    expect(exampleHtml('<b class="target"><img src=x></b>', "x")).toBe('<b class="target">&lt;img src=x&gt;</b>');
  });
  it("ignores dictionary sentences when seeding capture", () => {
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
    expect(seedFromRow(row).example).toBe('<b class="target">grouper</b>');
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
    expect(result.Example).toBe("A grouper hovered.");
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
