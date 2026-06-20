/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { getPreferenceValues } from "@raycast/api";

import { getLanguageItem } from "@/core/language/utils";

export const myPreferences = getPreferenceValues<Preferences>();
export const preferredLanguage1 = getLanguageItem(myPreferences.language1);
export const preferredLanguage2 = getLanguageItem(myPreferences.language2);
export const preferredLanguages = [preferredLanguage1, preferredLanguage2];
