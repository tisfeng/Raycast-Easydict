import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { textHtml } from "./html";

export function imageToken(path: string): string {
  return `[[image:${createHash("sha256").update(path).digest("hex")}]]`;
}
export function referencedImages(draft: { context: string; images: string[] }): string[] {
  return [...new Set(draft.images)].filter((path) => draft.context.includes(imageToken(path)));
}
/** Render only registered image markers. Everything else remains plain text. */
export function renderContext(
  context: string,
  images: string[],
  render: (path: string, index: number) => string,
): string {
  const replacements = new Map(images.map((path, index) => [imageToken(path), render(path, index)]));
  return context
    .split(/(\[\[image:[a-f0-9]{64}\]\])/g)
    .map((part) => replacements.get(part) ?? textHtml(part))
    .join("");
}
export function contextPreview(draft: { context: string; images: string[] }): string {
  const images = referencedImages(draft);
  // A text code block prevents pasted Markdown/HTML from creating unregistered remote images.
  const tokens = new Map(images.map((path) => [imageToken(path), path]));
  return draft.context
    .split(/(\[\[image:[a-f0-9]{64}\]\])/g)
    .map((part) => {
      const path = tokens.get(part);
      if (path) return `\n\n![Context image](${pathToFileURL(path).href})\n\n`;
      return part ? `\n\n\`\`\`\`\n${part.replace(/`/g, "ˋ")}\n\`\`\`\`\n\n` : "";
    })
    .join("");
}
