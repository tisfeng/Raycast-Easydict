/*
 * @author: tisfeng
 * @createTime: 2022-07-25 23:04
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-25 23:17
 * @fileName: consts.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

const validLanguagePairKeys = [
  "english-chinese",
  "english-french",
  "english-german",
  "english-italian",
  "english-spanish",
  "english-portuguese",
  "english-russian",
] as const;

export type ValidLanguagePairKey = typeof validLanguagePairKeys[number];

export const validLanguagePairs: Record<
  typeof validLanguagePairKeys[number],
  {
    pair: string;
    title: string;
  }
> = {
  "english-chinese": {
    pair: "english-chinese",
    title: "English ↔️ Chinese",
  },
  "english-french": {
    pair: "english-french",
    title: "English ↔️ French",
  },
  "english-german": {
    pair: "english-german",
    title: "English ↔️ German",
  },
  "english-italian": {
    pair: "english-italian",
    title: "English ↔️ Italian",
  },
  "english-spanish": {
    pair: "english-spanish",
    title: "English ↔️ Spanish",
  },
  "english-portuguese": {
    pair: "english-portuguese",
    title: "English ↔️ Portuguese",
  },
  "english-russian": {
    pair: "english-russian",
    title: "English ↔️ Russian",
  },
};
