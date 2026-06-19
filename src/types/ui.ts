/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import type { Image } from "@raycast/api";

import type { LanguageItem } from "@/core/language/types";

import type { ListDisplayItem } from "./display";
import type { QueryType } from "./query";

export interface ActionListPanelProps {
  displayItem: ListDisplayItem;
  isInstalledEudic: boolean;
  isShowingReleasePrompt: boolean;
  onHideReleasePrompt: () => void;
  onLanguageUpdate: (language: LanguageItem) => void;
}

export interface WebQueryItem {
  type: QueryType;
  webUrl: string;
  icon: Image.ImageLike;
  title: string;
}
