/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { boolean, decodeQueryWordInfo, invalid, member, optional, record, strings, text } from "./decodeFields";
import {
  AIDictionaryListItemType,
  DictionaryType,
  LingueeListItemType,
  TranslationType,
  YoudaoDictionaryListItemType,
} from "./kinds";
import {
  type DisplaySection,
  type ListAccessoryItem,
  type ListDisplayItem,
  PROVIDER_ICON_NAMES,
  type ProviderIconConfig,
} from "./types";

export function decodeDisplaySections(value: unknown): DisplaySection[] {
  if (!Array.isArray(value)) throw invalid("displaySections");
  return value.map((value) => {
    const source = record(value, "displaySection");
    const type = member(
      source.type,
      [
        ...Object.values(TranslationType),
        ...Object.values(AIDictionaryListItemType),
        ...Object.values(LingueeListItemType),
        ...Object.values(YoudaoDictionaryListItemType),
      ],
      "displaySection.type",
    );
    if (!Array.isArray(source.items)) throw invalid("displaySection.items");
    const items = source.items.map(decodeDisplayItem);
    const queryType = items[0]?.queryType;
    for (const item of items) {
      if (item.queryType !== queryType) throw invalid("displaySection.items.queryType");
      if (item.displayType === undefined) {
        if (type !== item.queryType) throw invalid("displaySection.type");
      } else {
        switch (item.queryType) {
          case DictionaryType.AI:
            member(type, Object.values(AIDictionaryListItemType), "displaySection.type");
            break;
          case DictionaryType.Linguee:
            member(type, Object.values(LingueeListItemType), "displaySection.type");
            break;
          case DictionaryType.Youdao:
            member(type, Object.values(YoudaoDictionaryListItemType), "displaySection.type");
            break;
        }
      }
    }
    return {
      type,
      items,
      serviceId: optional(source.serviceId, text, "displaySection.serviceId"),
      sectionTitle: optional(source.sectionTitle, text, "displaySection.sectionTitle"),
    };
  });
}

function decodeDisplayItem(value: unknown): ListDisplayItem {
  const source = record(value, "item");
  const fields = {
    queryWordInfo: decodeQueryWordInfo(source.queryWordInfo),
    key: text(source.key, "item.key"),
    title: text(source.title, "item.title"),
    copyText: text(source.copyText, "item.copyText"),
    subtitle: optional(source.subtitle, text, "item.subtitle"),
    tooltip: optional(source.tooltip, text, "item.tooltip"),
    detailsMarkdown: optional(source.detailsMarkdown, text, "item.detailsMarkdown"),
    accessoryItem: optional(source.accessoryItem, decodeAccessory, "item.accessoryItem"),
    fromCache: optional(source.fromCache, boolean, "item.fromCache"),
    serviceId: optional(source.serviceId, text, "item.serviceId"),
    serviceLabel: optional(source.serviceLabel, text, "item.serviceLabel"),
    serviceIcon: optional(source.serviceIcon, decodeIcon, "item.serviceIcon"),
  };
  switch (source.queryType) {
    case DictionaryType.AI:
      return {
        ...fields,
        queryType: source.queryType,
        displayType: member(source.displayType, Object.values(AIDictionaryListItemType), "item.displayType"),
      };
    case DictionaryType.Linguee:
      return {
        ...fields,
        queryType: source.queryType,
        displayType: member(source.displayType, Object.values(LingueeListItemType), "item.displayType"),
      };
    case DictionaryType.Youdao:
      return {
        ...fields,
        queryType: source.queryType,
        displayType: member(source.displayType, Object.values(YoudaoDictionaryListItemType), "item.displayType"),
      };
    default:
      if (source.displayType !== undefined) throw invalid("item.displayType");
      return { ...fields, queryType: member(source.queryType, Object.values(TranslationType), "item.queryType") };
  }
}

function decodeAccessory(value: unknown): ListAccessoryItem {
  const source = record(value, "item.accessoryItem");
  return {
    phonetic: optional(source.phonetic, text, "item.accessoryItem.phonetic"),
    examTypes: optional(source.examTypes, strings, "item.accessoryItem.examTypes"),
    example: optional(source.example, text, "item.accessoryItem.example"),
  };
}

export function decodeIcon(value: unknown): ProviderIconConfig {
  const source = record(value, "item.serviceIcon");
  switch (source.kind) {
    case "preset":
      return { kind: source.kind, name: member(source.name, PROVIDER_ICON_NAMES, "item.serviceIcon.name") };
    case "remote":
      return { kind: source.kind, url: text(source.url, "item.serviceIcon.url") };
    case "favicon":
      return { kind: source.kind, website: optional(source.website, text, "item.serviceIcon.website") };
    case "initials":
      return { kind: source.kind };
    default:
      throw invalid("item.serviceIcon.kind");
  }
}
