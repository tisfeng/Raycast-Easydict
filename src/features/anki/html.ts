import { TextNode } from "node-html-parser";

import { escapeHtml } from "@/core/content/markdown";

export function textHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}
export function targetMarkup(term: string): string {
  return term.trim() ? `<b class="target">${textHtml(term.trim())}</b>` : "";
}
/** User-edited examples preserve only the target marker; other markup remains text. */
export function exampleHtml(example: string, term: string): string {
  if (!example.trim()) return targetMarkup(term);
  const text = example.trim();
  const exact = /<b\s+class=(?:"target"|'target')>([\s\S]*?)<\/b>/gi;
  let output = "",
    previous = 0;
  for (const match of text.matchAll(exact)) {
    output +=
      textHtml(text.slice(previous, match.index)) + `<b class="target">${textHtml(new TextNode(match[1]).text)}</b>`;
    previous = match.index + match[0].length;
  }
  return output + textHtml(text.slice(previous));
}
