/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Image } from "@raycast/api";

import { LanguageItem } from "@/core/language/types";

import { ListDisplayItem } from "./display";
import { QueryType } from "./query";

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
