// @vitest-environment jsdom

import { getSelectedText, launchCommand, LaunchType, showHUD } from "@raycast/api";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TranslationContent } from "@/core/content/types";
import { LanguageDetectType } from "@/core/results/kinds";
import type { QueryInput } from "@/core/results/types";
import { setLastQuery } from "@/features/search/lastQuery";
import type { createQueryProviders } from "@/test-support/queryProviders";

import Easydict from "./easydict";
import command from "./search-selected-text";

const provider = vi.hoisted(() => ({ requests: [] as ReturnType<typeof createQueryProviders>["translationRequests"] }));

vi.mock("@/providers/registry", async () => {
  const { createQueryProviders } = await import("@/test-support/queryProviders");
  const providers = createQueryProviders();
  provider.requests = providers.translationRequests;
  const translationServices = [providers.translationService()];
  return {
    builtinDictionaryProviderServices: [],
    builtinTranslationServices: translationServices,
    resolveProviderServices: () => ({
      dictionaryServices: [],
      translationServices,
    }),
  };
});

vi.mock("@/core/detect", () => ({
  detectLanguage: async () => ({ type: LanguageDetectType.Bing, language: "en", confirmed: true }),
}));

vi.mock("@/providers/profiles/useAIProviderProfiles", () => ({
  useAIProviderProfiles: () => ({
    state: { kind: "missing", state: { version: 2, profiles: [], migratedLegacyProviders: [] } },
    isLoading: false,
    profiles: [],
    storedState: { version: 2, profiles: [], migratedLegacyProviders: [] },
    update: vi.fn(),
    revalidate: vi.fn(),
  }),
}));

vi.mock("@raycast/utils", () => {
  const revalidate = vi.fn();
  return {
    showFailureToast: vi.fn(),
    useLocalStorage: () => ({ isLoading: true }),
    usePromise: () => ({ isLoading: true, revalidate }),
  };
});

vi.mock("@raycast/api", async () => {
  const { createElement: h } = await import("react");
  const { createCacheMock } = await import("@/test-support/raycastStorage");
  const group = ({ children }: { children?: ReactNode }) => h("div", null, children);
  const action = ({ title, onAction }: { title: string; onAction?: () => void }) =>
    h("button", { onClick: onAction }, title);
  const ignore = () => null;
  return {
    Action: Object.assign(action, { CopyToClipboard: ignore, OpenInBrowser: ignore, Push: ignore }),
    ActionPanel: Object.assign(group, { Section: group }),
    List: Object.assign(group, {
      Section: group,
      EmptyView: ignore,
      Item: Object.assign(({ actions }: { actions: ReactNode }) => actions, { Detail: ignore }),
    }),
    Cache: createCacheMock(),
    Color: {},
    Icon: {},
    Keyboard: { Shortcut: { Common: {} } },
    LocalStorage: { getItem: vi.fn() },
    Detail: ignore,
    open: vi.fn(),
    openCommandPreferences: vi.fn(),
    showToast: vi.fn(),
    getApplications: vi.fn(),
    getPreferenceValues: () => ({
      language1: "en",
      language2: "zh-CHS",
      queryCacheMode: "off",
      aiQueryCacheMode: "off",
      enableAutomaticQuerySelectedText: true,
      enableSelectTargetLanguage: true,
    }),
    environment: { isDevelopment: false },
    getSelectedText: vi.fn(),
    launchCommand: vi.fn(),
    LaunchType: { UserInitiated: "userInitiated" },
    showHUD: vi.fn(),
  };
});

function renderLastLaunch() {
  const launch = vi.mocked(launchCommand).mock.lastCall?.[0];
  if (launch?.name !== "easydict") throw new Error("Search Word was not launched");
  const queryText = launch.arguments?.queryText;
  return render(
    createElement(Easydict, {
      arguments: { queryText: typeof queryText === "string" ? queryText : "" },
      launchType: LaunchType.UserInitiated,
      launchContext: launch.context ?? undefined,
    }),
  );
}

async function completeTranslation(index: number) {
  await act(async () => {
    const { query, resolve } = provider.requests[index];
    const content: TranslationContent = { kind: "translation", query, paragraphs: ["Translation"] };
    resolve(content);
  });
}

function expectTranslation(index: number, query: Pick<QueryInput, "word" | "toLanguage">) {
  return waitFor(() => {
    expect(provider.requests[index]?.query).toMatchObject(query);
  });
}

describe("Search Selected Text", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    provider.requests.length = 0;
    setLastQuery("");
  });

  afterEach(cleanup);

  it("restores the manually selected target without applying it to the next selection", async () => {
    setLastQuery("previous");
    vi.mocked(getSelectedText).mockResolvedValue("  house \n");
    await command();
    const first = renderLastLaunch();
    await expectTranslation(0, { word: "house", toLanguage: "zh-CHS" });
    await completeTranslation(0);

    fireEvent.click(screen.getByRole("button", { name: "Japanese" }));
    await expectTranslation(1, { word: "house", toLanguage: "ja" });
    first.unmount();

    vi.mocked(getSelectedText).mockRejectedValue(new Error("Unable to get selected text"));
    await command();
    const reopened = renderLastLaunch();
    await expectTranslation(2, { word: "house", toLanguage: "ja" });
    reopened.unmount();

    vi.mocked(getSelectedText).mockResolvedValue("garden");
    await command();
    renderLastLaunch();
    await expectTranslation(3, { word: "garden", toLanguage: "zh-CHS" });
  });

  it("reopens the last search when nothing is selected", async () => {
    setLastQuery("house");
    vi.mocked(getSelectedText).mockRejectedValue(new Error("Unable to get selected text"));

    await command();
    renderLastLaunch();

    await expectTranslation(0, { word: "house", toLanguage: "zh-CHS" });
  });

  it("opens an empty search without taking a second selection when the last search was cleared", async () => {
    setLastQuery("house");
    setLastQuery("");
    vi.mocked(getSelectedText).mockResolvedValueOnce("   ").mockResolvedValue("another selection");

    await command();
    renderLastLaunch();

    expect(getSelectedText).toHaveBeenCalledTimes(1);
    expect(provider.requests).toHaveLength(0);
  });

  it("shows a HUD when Search Word cannot be launched", async () => {
    vi.mocked(getSelectedText).mockResolvedValue("house");
    vi.mocked(launchCommand).mockRejectedValue(new Error("launch failed"));

    await command();

    expect(showHUD).toHaveBeenCalledWith("⚠️ Failed to query Easy Dictionary");
  });

  it.each([
    { queryText: "  argument  ", fallbackText: "fallback", word: "argument", selectionReads: 0 },
    { queryText: "", fallbackText: "  fallback  ", word: "fallback", selectionReads: 0 },
    { queryText: "", fallbackText: undefined, word: "selected", selectionReads: 1 },
  ])("looks up $word for a regular Search Word launch", async ({ queryText, fallbackText, word, selectionReads }) => {
    vi.mocked(getSelectedText).mockResolvedValue("  selected  ");

    render(createElement(Easydict, { arguments: { queryText }, fallbackText, launchType: LaunchType.UserInitiated }));

    await expectTranslation(0, { word, toLanguage: "zh-CHS" });
    expect(getSelectedText).toHaveBeenCalledTimes(selectionReads);
  });
});
