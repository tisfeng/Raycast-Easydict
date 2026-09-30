/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getLanguageEnglishName } from "@/core/language/utils";
import { isDarkAppearance } from "@/core/results/appearance";
import { DictionaryType } from "@/core/results/kinds";
import type { QueryWordInfo } from "@/core/results/types";

import { escapeHtml, plainText } from "./markdown";
import type { ViewRow, ViewSection, ViewService } from "./viewTypes";

function languageDirection(info: QueryWordInfo): string {
  return `${getLanguageEnglishName(info.fromLanguage)} → ${getLanguageEnglishName(info.toLanguage)}`;
}

/**
 * Raycast centers a paragraph whose only content is an image, which used to
 * leave short headwords floating in the middle of the pane. The header image
 * carries a trailing zero-width space so it stays inline with the page text and
 * is laid out from the left margin. A fixed image height keeps the word the
 * same size on the narrow favorites pane and the full-width details page.
 */
const HEADER_IMAGE_HEIGHT = 34;
const HEADER_INLINE_MARK = "\u200B";

/** Conservative canvas bounds; SVG lays out the text and pronunciation itself. */
function estimateTextWidth(text: string, fontSize: number): number {
  const widthAt32 = Array.from(text).reduce((width, character) => {
    if (character.codePointAt(0)! > 127) return width + 48;
    if (/[mwMW@%]/.test(character)) return width + 40;
    if (/[il|.,'`:;!]/.test(character)) return width + 14;
    return width + (/[A-Z0-9]/.test(character) ? 32 : 26);
  }, 0);
  return Math.ceil((widthAt32 * fontSize) / 32);
}

/**
 * Standalone pages own the direction line; saved favorites show the language
 * pair in the list, so their details omit it to avoid repeating the same data.
 */
function resultHeader(info: QueryWordInfo, showDirection = true): string {
  const source = plainText(info.word);
  const word = info.isWord === true && !info.word.includes("\n");
  const direction = showDirection ? plainText(languageDirection(info)) : "";
  if (word) {
    // The image contains only the word and pronunciation; the page lays out the direction separately.
    const wordWidth = estimateTextWidth(info.word, 32);
    const phonetic = info.phonetic ?? "";
    if (wordWidth + 8 <= 600) {
      const phoneticWidth = estimateTextWidth(phonetic, 20);
      const inlinePhonetic = wordWidth + 16 + phoneticWidth + 8 <= 600 ? phonetic : "";
      const width = wordWidth + (inlinePhonetic ? 16 + phoneticWidth : 0) + 8;
      const dark = isDarkAppearance();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="44" viewBox="0 0 ${width} 44"><text x="0" y="30" font-family="Georgia, Times New Roman, serif" font-size="32" font-weight="700" fill="${dark ? "#f2f2f2" : "#202020"}">${escapeHtml(info.word)}${inlinePhonetic ? `<tspan dx="16" font-family="Arial, sans-serif" font-size="20" font-weight="400" fill="${dark ? "#aaaaaa" : "#777777"}">${escapeHtml(inlinePhonetic)}</tspan>` : ""}</text></svg>`;
      const image = `![${plainText(`${info.word}${inlinePhonetic ? ` · ${inlinePhonetic}` : ""}`)}](data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}?raycast-width=${Math.ceil((width * HEADER_IMAGE_HEIGHT) / 44)}&raycast-height=${HEADER_IMAGE_HEIGHT})${HEADER_INLINE_MARK}`;
      return [image, !inlinePhonetic && plainText(phonetic), direction].filter(Boolean).join("  \n");
    }
    return [`## ${source}${phonetic ? ` · ${plainText(phonetic)}` : ""}`, direction].filter(Boolean).join("\n\n");
  }
  const quote = source
    .split("\n")
    .map((line) => `> ${line}  `)
    .join("\n");
  return [direction, quote].filter(Boolean).join("\n\n");
}

interface TranslationEntry {
  label: string;
  text: string;
  info: QueryWordInfo;
}

function translationBody(info: QueryWordInfo, results: readonly TranslationEntry[]): string {
  const entries = results
    .filter((result) => result.text.trim())
    .map((result) => ({
      ...result,
      label:
        result.label +
        (result.info.fromLanguage !== info.fromLanguage || result.info.toLanguage !== info.toLanguage
          ? ` · ${languageDirection(result.info)}`
          : ""),
    }));
  const compact =
    info.isWord === true &&
    entries.length > 1 &&
    entries.every((entry) => entry.text.length <= 120 && !entry.text.includes("\n"));
  return compact
    ? table(entries.map((entry) => [entry.label, entry.text]))
    : entries.map((entry) => `**${plainText(entry.label)}**\n\n${entry.text}`).join("\n\n");
}

export function viewRowLabel(
  row: Pick<ViewRow, "kind" | "frequency" | "prominent" | "summarySource" | "service">,
): string {
  switch (row.kind) {
    case "translation":
      return "Translation";
    case "definition":
      return row.service.type === DictionaryType.Youdao ? "Explanation" : "Definition";
    case "equivalent": {
      if (!row.prominent) return row.frequency === "less-common" ? "Less Common" : "Unfeatured";
      switch (row.frequency) {
        case "often":
          return "Often Used";
        case "almost-always":
          return "Almost Always Used";
        case "less-common":
          return "Less Common";
        case "special-forms":
          return "Forms";
        default:
          return "Common";
      }
    }
    case "form":
      return "Forms";
    case "phrase":
      return "Web Phrase";
    case "related":
      return "Related word";
    case "web-translation":
      return "Web Translation";
    case "form-set":
      return "Forms and Tenses";
    case "example":
      return "Example";
    case "summary":
      return row.summarySource === "encyclopedia"
        ? "Baike"
        : row.summarySource === "wikipedia"
          ? "Wikipedia"
          : "Summary";
    case "chinese-entry":
      return "Modern Chinese Dict";
  }
}

// Bare rows keep tables compact; the surrounding section label already names the columns.
function table(rows: readonly (readonly string[])[]): string {
  return `<table>\n${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`)
    .join("\n")}\n</table>`;
}

function isPairedRow(row: ViewRow): boolean {
  return (
    (row.kind === "form" ||
      row.kind === "phrase" ||
      row.kind === "related" ||
      (row.kind === "equivalent" && row.frequency === "special-forms" && row.prominent === true)) &&
    Boolean(row.title && row.subtitle) &&
    row.title.length <= 80 &&
    (row.subtitle?.length ?? 0) <= 120
  );
}

/** Shared row semantics for fresh content and independently decoded saved content. */
export function renderDictionaryBody(row: ViewRow, fallbackBody: () => string): string {
  if (row.kind === "translation")
    return row.service.query.isWord ? `**${plainText(row.title)}**` : plainText(row.title);
  if (isPairedRow(row)) return table([[row.title, row.subtitle ?? ""]]);
  if (row.kind === "example")
    return `- **${plainText(row.title)}**${row.subtitle ? `  \n  ${plainText(row.subtitle)}` : ""}`;
  return fallbackBody();
}

interface ServiceSections {
  service: ViewService;
  sections: ViewSection[];
}

function groupSections(sections: readonly ViewSection[]): ServiceSections[] {
  const groups = new Map<string, ServiceSections>();
  for (const section of sections) {
    if (!section.items.length) continue;
    const { service } = section;
    const key = JSON.stringify([service.serviceId, service.query.fromLanguage, service.query.toLanguage]);
    const group = groups.get(key);
    if (group) group.sections.push(section);
    else groups.set(key, { service, sections: [section] });
  }
  return [...groups.values()];
}

function translationEntry(group: ServiceSections): TranslationEntry {
  return {
    label: group.service.serviceLabel,
    text: group.sections.flatMap((section) => section.items.map((row) => row.copyText)).join("\n\n"),
    info: group.service.query,
  };
}

/** Only the selected translation constructs its comparison; dictionary rows render their own body. */
export function renderSelectedRow(row: ViewRow, sections: readonly ViewSection[]): string {
  if (row.service.kind === "dictionary") return row.renderBody();
  const groups = groupSections(sections).filter((group) => group.service.kind === "translation");
  const current = groups.findIndex((group) => group.service.serviceId === row.service.serviceId);
  if (current > 0) groups.unshift(...groups.splice(current, 1));
  return translationBody(row.service.query, groups.map(translationEntry));
}

export function renderStandaloneRow(row: ViewRow): string {
  return [
    resultHeader({ ...row.service.query, phonetic: row.accessory?.phonetic ?? row.service.query.phonetic }),
    `<small>${escapeHtml(row.service.serviceLabel)}</small>`,
    row.renderBody(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function sectionBody(section: ViewSection): string {
  if (section.items.length > 0 && section.items.every(isPairedRow)) {
    return table(section.items.map((row) => [row.title, row.subtitle ?? ""]));
  }
  if (section.kind === "definitions")
    return section.items.map((row, index) => `<small>${index + 1}.</small> ${row.renderBody()}`).join("\n\n");
  return section.items
    .map((row) => row.renderBody())
    .filter(Boolean)
    .join("\n\n");
}

/** Saved pages reuse row bodies and group adjacent translations without changing service order. */
export function renderSavedView(query: QueryWordInfo, sections: readonly ViewSection[]): string {
  const headerPhonetic =
    query.phonetic ??
    sections.flatMap((section) => section.items).find((row) => row.accessory?.phonetic)?.accessory?.phonetic;
  const content: string[] = [];
  let pendingTranslations: TranslationEntry[] = [];
  const flushTranslations = () => {
    if (pendingTranslations.length) content.push(translationBody(query, pendingTranslations));
    pendingTranslations = [];
  };
  for (const group of groupSections(sections)) {
    if (group.service.kind === "translation") {
      pendingTranslations.push(translationEntry(group));
      continue;
    }
    flushTranslations();
    const info = group.service.query;
    const direction =
      info.fromLanguage !== query.fromLanguage || info.toLanguage !== query.toLanguage
        ? ` · ${languageDirection(info)}`
        : "";
    const phonetic = group.sections.flatMap((section) => section.items).find((row) => row.accessory?.phonetic)
      ?.accessory?.phonetic;
    const body = group.sections
      .map((section, index) => {
        const body = sectionBody(section);
        if (!body) return "";
        const first = section.items[0];
        if (!first || first.kind === "translation" || first.kind === "definition") return body;
        const title = index > 0 && section.title && section.title !== "Details" ? section.title : viewRowLabel(first);
        return `<small><strong>${escapeHtml(title)}</strong></small>\n\n${body}`;
      })
      .filter(Boolean)
      .join("\n\n");
    content.push(
      [
        `<small>${escapeHtml(group.service.serviceLabel + direction)}${phonetic && phonetic !== headerPhonetic ? ` · ${escapeHtml(phonetic)}` : ""}</small>`,
        body,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  flushTranslations();
  return [resultHeader({ ...query, phonetic: headerPhonetic }, false), content.join("\n\n---\n\n")]
    .filter(Boolean)
    .join("\n\n");
}
