import { describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleProfile } from "@/ai-providers/types";
import { myPreferences } from "@/consts";
import { DictionaryType, TranslationType } from "@/types/api";
import type { QueryInput } from "@/types/query";

import { builtinProviderCatalog, getBuiltinProviderPreferenceStatus } from "./catalog";
import { getCombinedAvailableProviderKeys, getCombinedProviderOrder } from "./order";
import { builtinDictionaryProviderServices, builtinTranslationServices, resolveProviderServices } from "./registry";

vi.mock("@raycast/api", () => ({
  AI: { Model: {} },
  Cache: class {
    get() {
      return undefined;
    }
    set() {}
    remove() {}
  },
  LocalStorage: {
    getItem: vi.fn().mockResolvedValue("test-cookie"),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  environment: { extensionName: "easydict", isDevelopment: false, canAccess: () => true },
  getPreferenceValues: () => ({
    servicesOrder: "",
    enableLingueeDictionary: true,
    enableYoudaoDictionary: true,
    enableDeepLTranslate: false,
    enableYoudaoTranslate: false,
    deepLAuthKey: "deepl-placeholder",
    enableOpenAITranslate: true,
    enableGeminiTranslate: true,
    openAIAPIKey: "openai-placeholder",
    openAIAPIURL: "https://api.openai.com/v1",
    openAIModel: "gpt-4.1-mini",
    geminiAPIKey: "gemini-placeholder",
    geminiAPIURL: "https://generativelanguage.googleapis.com",
    geminiModel: "gemini-2.5-flash",
  }),
}));

const defaultOrder = [
  "builtin:dictionary:Youdao Dictionary",
  "builtin:dictionary:Linguee Dictionary",
  "builtin:translation:DeepL Translate",
  "builtin:translation:DeepLX Translate",
  "builtin:translation:Google Translate",
  "builtin:translation:Bing Translate",
  "builtin:translation:Apple Translate",
  "builtin:translation:Baidu Translate",
  "builtin:translation:Tencent Translate",
  "builtin:translation:Volcano Translate",
  "builtin:translation:Youdao Translate",
  "builtin:translation:Caiyun Translate",
];
const wordQuery: QueryInput = { word: "word", fromLanguage: "en", toLanguage: "zh-CHS", isWord: true };

function createProfile(id: string, wordResultMode: OpenAICompatibleProfile["wordResultMode"]): OpenAICompatibleProfile {
  return {
    id,
    adapter: "openai-compatible",
    name: id,
    enabled: true,
    order: 0,
    icon: { kind: "initials" },
    wordResultMode,
    endpoint: "https://example.com/v1",
    model: "model",
    apiKey: "placeholder",
    tokenLimitMode: "max-tokens",
    jsonOutputMode: "prompt",
  };
}

describe("combined provider registry", () => {
  it("assembles every catalog provider with its factory and the default global order", () => {
    const services = [...builtinDictionaryProviderServices, ...builtinTranslationServices];
    expect(getCombinedProviderOrder([])).toEqual(defaultOrder);
    expect(getCombinedAvailableProviderKeys([]).sort()).toEqual([...defaultOrder].sort());
    expect(services.sort((left, right) => left.order - right.order).map((service) => service.providerKey)).toEqual(
      defaultOrder,
    );
    expect(services.map((service) => service.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const service of services) {
      expect(service.id).toBe(`static:${service.type}`);
      expect(service.createProvider().type).toBe(service.type);
    }
  });

  it("shares a saved position between one profile's two services and keeps another profile independent", () => {
    const profiles = [createProfile("dictionary", "dictionary"), createProfile("translation", "translation")];
    const snapshot = resolveProviderServices({
      version: 2,
      profiles,
      migratedLegacyProviders: [],
      providerOrder: [
        "ai:translation",
        "builtin:dictionary:Youdao Dictionary",
        "ai:dictionary",
        "builtin:translation:Google Translate",
        "ai:translation",
        "deleted",
      ],
    });
    const services = [...snapshot.dictionaryServices, ...snapshot.translationServices];
    expect(
      services
        .filter((service) => service.id.startsWith("profile:"))
        .map(({ id, providerKey, order }) => ({ id, providerKey, order })),
    ).toEqual([
      { id: "profile:dictionary:dictionary", providerKey: "ai:dictionary", order: 2 },
      { id: "profile:dictionary", providerKey: "ai:dictionary", order: 2 },
      { id: "profile:translation", providerKey: "ai:translation", order: 0 },
    ]);
    expect(services.find((service) => service.type === TranslationType.Google)?.order).toBe(3);
    expect(services.find((service) => service.type === DictionaryType.Linguee)?.order).toBe(4);
    expect(
      services
        .filter((service) => service.id.startsWith("profile:") && service.enabled(wordQuery))
        .map((service) => service.id),
    ).toEqual(["profile:dictionary:dictionary", "profile:translation"]);
    expect(
      services
        .filter((service) => service.id.startsWith("profile:") && service.enabled({ ...wordQuery, isWord: false }))
        .map((service) => service.id),
    ).toEqual(["profile:dictionary", "profile:translation"]);
    expect(
      snapshot.dictionaryServices.find((service) => service.id === "profile:dictionary:dictionary")
        ?.canTriggerAutomaticAudio,
    ).toBe(false);
    expect(profiles.map((profile) => profile.order)).toEqual([0, 0]);
  });

  it("reports implicit preference enablement while applying its query restrictions at runtime", () => {
    const deepL = builtinProviderCatalog.find((provider) => provider.type === TranslationType.DeepL)!;
    const youdao = builtinProviderCatalog.find((provider) => provider.type === TranslationType.Youdao)!;
    expect(getBuiltinProviderPreferenceStatus(deepL, myPreferences)).toEqual({
      enabledInPreferences: false,
      implicitlyEnabledBy: "Linguee",
    });
    expect(getBuiltinProviderPreferenceStatus(youdao, myPreferences)).toEqual({
      enabledInPreferences: false,
      implicitlyEnabledBy: "Youdao Dictionary",
    });
    const deepLService = builtinTranslationServices.find((service) => service.type === TranslationType.DeepL)!;
    const youdaoService = builtinTranslationServices.find((service) => service.type === TranslationType.Youdao)!;
    for (const service of [deepLService, youdaoService]) {
      expect(service.enabled(wordQuery)).toBe(true);
      expect(service.enabled({ ...wordQuery, isWord: false })).toBe(false);
    }
    expect(deepLService.enabled({ ...wordQuery, toLanguage: "ko" })).toBe(false);
    expect(youdaoService.enabled({ ...wordQuery, fromLanguage: "de" })).toBe(false);
  });

  it("removes deleted profiles without restoring legacy AI preference services", () => {
    const profile = createProfile("removed", "dictionary");
    const state = { version: 2 as const, profiles: [profile], migratedLegacyProviders: [] };
    const before = resolveProviderServices(state);
    expect(before.translationServices.map((service) => service.id)).toContain("profile:removed");
    expect(before.dictionaryServices.map((service) => service.id)).toContain("profile:removed:dictionary");
    const after = resolveProviderServices({ ...state, profiles: [], providerOrder: ["ai:removed", ...defaultOrder] });
    expect([...after.dictionaryServices, ...after.translationServices].map((service) => service.id).sort()).toEqual(
      defaultOrder.map((key) => `static:${key.split(":")[2]}`).sort(),
    );
    expect(after.translationServices.map((service) => service.type)).not.toContain(TranslationType.OpenAI);
    expect(after.translationServices.map((service) => service.type)).not.toContain(TranslationType.Gemini);
    expect(after.dictionaryServices.map((service) => service.type)).not.toContain(DictionaryType.AI);
  });
});
