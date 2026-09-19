/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import {
  AIDictionaryListItemType,
  DictionaryType,
  LingueeListItemType,
  YoudaoDictionaryListItemType,
} from "@/core/results/kinds";
import type { DisplaySection, ListDisplayItem } from "@/core/results/types";

import { plainText } from "./markdown";
import type { ContentEquivalent, ContentExample, DictionaryContent, DictionarySection } from "./types";

type LegacyRow = Pick<ListDisplayItem, "title" | "subtitle" | "copyText" | "detailsMarkdown" | "accessoryItem">;
type ItemKind =
  | { queryType: DictionaryType.AI; displayType: AIDictionaryListItemType }
  | { queryType: DictionaryType.Youdao; displayType: YoudaoDictionaryListItemType }
  | { queryType: DictionaryType.Linguee; displayType: LingueeListItemType };

const frequencyTypes: Record<ContentEquivalent["frequency"], LingueeListItemType> = {
  common: LingueeListItemType.Common,
  often: LingueeListItemType.OftenUsed,
  "almost-always": LingueeListItemType.AlmostAlwaysUsed,
  "less-common": LingueeListItemType.LessCommon,
  "special-forms": LingueeListItemType.SpecialForms,
};

function itemKind(type: DictionaryType, section: DictionarySection, frequency?: LingueeListItemType): ItemKind {
  switch (type) {
    case DictionaryType.AI: {
      let displayType: AIDictionaryListItemType;
      switch (section.kind) {
        case "translation":
          displayType = AIDictionaryListItemType.Translation;
          break;
        case "definitions":
          displayType = AIDictionaryListItemType.Definition;
          break;
        case "pairs":
          displayType = AIDictionaryListItemType.Forms;
          break;
        default:
          throw new Error(`Unsupported AI dictionary section: ${section.kind}`);
      }
      return { queryType: type, displayType };
    }
    case DictionaryType.Youdao: {
      let displayType: YoudaoDictionaryListItemType;
      switch (section.kind) {
        case "translation":
          displayType = YoudaoDictionaryListItemType.Translation;
          break;
        case "definitions":
          displayType = YoudaoDictionaryListItemType.Explanation;
          break;
        case "form-set":
          displayType = YoudaoDictionaryListItemType.Forms;
          break;
        case "pairs":
          displayType =
            section.relation === "web-translation"
              ? YoudaoDictionaryListItemType.WebTranslation
              : YoudaoDictionaryListItemType.WebPhrase;
          break;
        case "summary":
          displayType =
            section.source === "encyclopedia"
              ? YoudaoDictionaryListItemType.Baike
              : YoudaoDictionaryListItemType.Wikipedia;
          break;
        case "chinese-entry":
          displayType = YoudaoDictionaryListItemType.ModernChineseDict;
          break;
        default:
          throw new Error(`Unsupported Youdao section: ${section.kind}`);
      }
      return { queryType: type, displayType };
    }
    case DictionaryType.Linguee: {
      let displayType: LingueeListItemType;
      switch (section.kind) {
        case "translation":
          displayType = LingueeListItemType.Translation;
          break;
        case "equivalents":
          displayType = frequency ?? LingueeListItemType.Common;
          break;
        case "examples":
          displayType = LingueeListItemType.Example;
          break;
        case "pairs":
          displayType = LingueeListItemType.RelatedWord;
          break;
        case "summary":
          displayType = LingueeListItemType.Wikipedia;
          break;
        default:
          throw new Error(`Unsupported Linguee section: ${section.kind}`);
      }
      return { queryType: type, displayType };
    }
    default:
      throw new Error(`Unsupported dictionary: ${type}`);
  }
}

function joinedRow(title: string, subtitle: string): LegacyRow {
  const copyText = `${title} ${subtitle}`;
  return { title, subtitle, copyText, detailsMarkdown: copyText };
}

function youdaoBody(title: string, subtitle?: string): string {
  if (!subtitle || subtitle.startsWith(title)) return subtitle || title;
  return subtitle.match(/"(.*?)"/)?.[1] === title ? subtitle : `${title} ${subtitle}`;
}

function exampleText(example: ContentExample): string {
  return example.translation ? `${example.sentence} — ${example.translation}` : example.sentence;
}

/** Temporary one-way bridge while query and saved-result consumers still use display sections. */
export function legacyDictionarySections(type: DictionaryType, content: DictionaryContent): DisplaySection[] {
  const query = content.query;
  return content.sections.map((section, sectionIndex) => {
    const rows: { value: LegacyRow; frequency?: LingueeListItemType }[] = [];
    let sectionTitle: string | undefined;
    const add = (value: LegacyRow, frequency?: LingueeListItemType) => rows.push({ value, frequency });

    switch (section.kind) {
      case "translation": {
        const title = type === DictionaryType.Youdao ? section.text.split("\n").join(", ") : section.text;
        const subtitle =
          type === DictionaryType.Youdao ? query.word.split("\n").join(" ") : (section.lemma ?? query.word);
        add({
          title,
          subtitle,
          copyText: type === DictionaryType.Linguee ? `${title} ${subtitle}` : title,
          detailsMarkdown: type === DictionaryType.Youdao ? youdaoBody(title, subtitle) : undefined,
          accessoryItem:
            type === DictionaryType.Linguee
              ? undefined
              : {
                  phonetic: query.phonetic || section.pronunciation,
                  examTypes: type === DictionaryType.Youdao ? query.examTypes : undefined,
                },
        });
        sectionTitle = type === DictionaryType.AI ? undefined : type;
        break;
      }
      case "equivalents": {
        const { word, qualifier = "", partOfSpeech = "" } = section.headword;
        sectionTitle = `${word}${qualifier ? ` ${qualifier}` : ""}${partOfSpeech ? (qualifier.endsWith(".") ? `  ${partOfSpeech}` : `.${partOfSpeech}`) : ""}`;
        const unfeatured: ContentEquivalent[] = [];
        for (const entry of section.entries) {
          if (!entry.prominent) {
            unfeatured.push(entry);
            continue;
          }
          const note = entry.frequency === "common" ? "" : `  ${entry.inflectionNote ?? ""}`;
          const example = entry.firstExampleTranslation ?? "";
          const pos = entry.partOfSpeech ? `${entry.partOfSpeech}${note || example ? "." : ""}` : "";
          add(joinedRow(entry.text, `${pos}${note}       ${example}`), frequencyTypes[entry.frequency]);
        }
        const last = unfeatured.at(-1);
        if (last) {
          const lessCommon = last.frequency === "less-common";
          add(
            joinedRow(
              last.partOfSpeech ? `${last.partOfSpeech}.` : "",
              `${unfeatured.map((entry) => entry.text).join(";  ")}  ${lessCommon ? "(less common)" : ""}`,
            ),
            lessCommon ? LingueeListItemType.LessCommon : LingueeListItemType.Unfeatured,
          );
        }
        break;
      }
      case "definitions": {
        sectionTitle = type === DictionaryType.AI ? "Definitions" : undefined;
        for (const entry of section.entries) {
          if (entry.kind === "plain") {
            const subtitle = entry.note ? ` ${entry.note}` : "";
            add({
              title: entry.text,
              subtitle,
              copyText: `${entry.text}${subtitle}`,
              detailsMarkdown: youdaoBody(entry.text, subtitle),
            });
          } else {
            const title = `${entry.partOfSpeech ? `[${entry.partOfSpeech}] ` : ""}${entry.meanings.join("; ")}`;
            add({
              title,
              subtitle: entry.explanation ?? entry.examples[0]?.sentence,
              copyText: [title, entry.explanation, ...entry.examples.map(exampleText)].filter(Boolean).join("\n"),
              detailsMarkdown: [
                `**${plainText(title)}**`,
                entry.explanation ? plainText(entry.explanation) : undefined,
                entry.examples.length
                  ? entry.examples
                      .map(
                        (example) =>
                          `- **${plainText(example.sentence)}**${example.translation ? `  \n  ${plainText(example.translation)}` : ""}`,
                      )
                      .join("\n\n")
                  : undefined,
              ]
                .filter(Boolean)
                .join("\n\n"),
            });
          }
        }
        break;
      }
      case "pairs": {
        sectionTitle =
          type === DictionaryType.AI ? "Forms" : type === DictionaryType.Linguee ? "Related words:" : undefined;
        for (const entry of section.entries) {
          const subtitle =
            type === DictionaryType.Linguee
              ? `${entry.partOfSpeech ? `${entry.partOfSpeech}.  ` : ""}${entry.meaning}`
              : entry.meaning;
          const value = joinedRow(entry.expression, subtitle);
          if (type === DictionaryType.AI)
            value.copyText = value.detailsMarkdown = `${entry.expression}: ${entry.meaning}`;
          if (type === DictionaryType.Youdao) value.detailsMarkdown = youdaoBody(entry.expression, subtitle);
          add(value);
        }
        break;
      }
      case "form-set": {
        const copyText = section.forms.map((form) => `${form.label}: ${form.value}`).join("   ");
        if (copyText) add({ title: "", subtitle: ` [ ${copyText} ]`, copyText, detailsMarkdown: ` [ ${copyText} ]` });
        break;
      }
      case "examples": {
        sectionTitle = "Examples:";
        for (const entry of section.entries)
          add(
            joinedRow(
              entry.sentence,
              `${entry.partOfSpeech ? `${entry.partOfSpeech}.  ` : ""}—  ${entry.translation ?? ""}`,
            ),
          );
        break;
      }
      case "summary": {
        sectionTitle = type === DictionaryType.Linguee ? "Wikipedia" : undefined;
        for (const entry of section.entries) {
          const value =
            type === DictionaryType.Linguee
              ? joinedRow(`${entry.subject} ${entry.text}`, "")
              : joinedRow(entry.subject, entry.text);
          if (type === DictionaryType.Youdao) value.detailsMarkdown = youdaoBody(entry.subject, entry.text);
          add(value);
        }
        break;
      }
      case "chinese-entry": {
        for (const entry of section.entries)
          add({
            title: entry.pronunciation ?? "",
            subtitle: entry.summary,
            copyText: `${entry.pronunciation ?? ""}  ${entry.summary}`,
            detailsMarkdown: entry.markdown,
          });
        break;
      }
    }
    if (type === DictionaryType.Youdao && sectionIndex === 1) sectionTitle = "Details";
    return {
      type: itemKind(type, section).displayType,
      sectionTitle,
      items: rows.map(({ value, frequency }, itemIndex): ListDisplayItem => {
        const kind = itemKind(type, section, frequency);
        return {
          ...kind,
          ...value,
          queryWordInfo: query,
          key: `${sectionIndex}:${itemIndex}`,
          tooltip: type === DictionaryType.AI ? `AI-Generated ${kind.displayType}` : kind.displayType,
        };
      }),
    };
  });
}
