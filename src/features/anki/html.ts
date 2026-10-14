import { escapeHtml } from "@/core/content/markdown";

export function textHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}
/** Preserve only the target marker; all other markup is escaped as text. */
export function exampleHtml(example: string, term: string): string {
  const exact = /<b\s+class=(?:"target"|'target')>([\s\S]*?)<\/b>/gi;
  const auto = (text: string) => {
    const word = term.trim();
    if (!word) return textHtml(text);
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
    let output = "",
      previous = 0;
    for (const match of text.matchAll(pattern)) {
      output += textHtml(text.slice(previous, match.index)) + `<b class="target">${textHtml(match[0])}</b>`;
      previous = match.index + match[0].length;
    }
    return output + textHtml(text.slice(previous));
  };
  let output = "",
    previous = 0;
  for (const match of example.trim().matchAll(exact)) {
    output += auto(example.trim().slice(previous, match.index));
    // Nested input is never interpreted as HTML.
    output += `<b class="target">${textHtml(match[1])}</b>`;
    previous = match.index + match[0].length;
  }
  return output + auto(example.trim().slice(previous));
}
