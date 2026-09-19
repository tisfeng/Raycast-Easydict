import { describe, expect, it } from "vitest";

import { languageItemList } from "./consts";
import {
  getLangCode,
  getLanguageFromProviderCode,
  getLanguageItem,
  isLanguageCode,
  isSourceLanguage,
  lookupLanguageItem,
  parseSourceLanguage,
} from "./utils";

describe("language boundaries", () => {
  it("distinguishes known languages, automatic source detection, and unknown codes", () => {
    expect(isLanguageCode("en")).toBe(true);
    expect(isLanguageCode("auto")).toBe(false);
    expect(isSourceLanguage("auto")).toBe(true);
    for (const value of ["", "never-a-language", "toString", 1, null]) {
      expect(isSourceLanguage(value)).toBe(false);
      expect(isLanguageCode(value)).toBe(false);
    }
    expect(getLangCode("unknown", "bingLangCode")).toBeUndefined();
    expect(getLanguageFromProviderCode("unknown", "bingLangCode")).toBeUndefined();
    expect(lookupLanguageItem("unknown")).toBeUndefined();
    expect(() => getLanguageItem("unknown")).toThrow("Unknown language");
  });

  it("keeps the existing source/target mappings and ambiguous reverse-map choices", () => {
    expect(getLangCode("zh-CHT", "deepLSourceId")).toBe("ZH");
    expect(getLangCode("zh-CHT", "deepLTargetId")).toBe("ZH-HANT");
    expect(getLanguageFromProviderCode("ZH", "deepLSourceId")).toBe("zh-CHS");
    expect(getLanguageFromProviderCode("cmn", "francLangCode")).toBe("zh-CHS");
    expect(getLanguageFromProviderCode("jp", "tencentDetectCode")).toBe("ja");
    expect(getLanguageFromProviderCode("zh", "baiduLangCode")).toBe("zh-CHS");
  });

  it("resolves the manifest Filipino alias without changing the persisted tl code", () => {
    expect(parseSourceLanguage("fil")).toBe("tl");
    expect(getLanguageItem("fil")).toBe(getLanguageItem("tl"));
    expect(getLangCode("fil", "googleLangCode")).toBe(getLangCode("tl", "googleLangCode"));
    expect(languageItemList.filter((item) => item.youdaoLangCode === "tl")).toHaveLength(1);
  });
});
