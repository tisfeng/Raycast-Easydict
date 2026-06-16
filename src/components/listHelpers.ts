/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { Color, Icon, List } from "@raycast/api";
import { ListDisplayItem } from "@/types";
import { playSoundIconGray } from "@/components/icons";

/**
 * Get List.Item.Accessory[] based on the ListDisplayItem.
 */
export function getWordAccessories(item: ListDisplayItem): List.Item.Accessory[] {
  let wordExamTypeAccessory: List.Item.Accessory[] = [];
  let pronunciationAccessory: List.Item.Accessory[] = [];
  let wordAccessories: List.Item.Accessory[] = [];
  const accessoryItem = item.accessoryItem;
  if (accessoryItem) {
    if (accessoryItem.examTypes) {
      wordExamTypeAccessory = [
        {
          icon: { source: Icon.StarCircle, tintColor: Color.Blue },
          tooltip: "Word included in the types of exam",
        },
      ];
      const tags = accessoryItem.examTypes.map((examType) => {
        const tag: List.Item.Accessory = {
          tag: {
            value: examType,
            color: Color.Blue,
          },
        };
        return tag;
      });
      wordAccessories = [...wordExamTypeAccessory, ...tags];
    }
    if (accessoryItem.phonetic) {
      pronunciationAccessory = [
        {
          icon: playSoundIconGray,
          tooltip: "Pronunciation",
        },
        { text: accessoryItem.phonetic },
      ];
      wordAccessories = [...wordAccessories, ...pronunciationAccessory];
    }
  }
  return wordAccessories;
}
