// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { ViewSection } from "@/core/content/viewTypes";

import SearchWord from "./SearchWord";

const mock = vi.hoisted(() => ({
  epoch: 0,
  sections: [] as ViewSection[],
  launch: vi.fn(),
  query: vi.fn(),
  knownQuery: vi.fn(),
}));
vi.mock("@/consts", () => ({ myPreferences: { enableAIProviders: false } }));
vi.mock("@/core/config", () => ({
  config: {
    preferredLanguage1: { youdaoLangCode: "en" },
    preferredLanguage2: { youdaoLangCode: "zh-CHS" },
    preferredLanguages: [{ youdaoLangCode: "en" }, { youdaoLangCode: "zh-CHS" }],
  },
}));
vi.mock("@/core/content/render", () => ({ renderSelectedRow: () => "" }));
vi.mock("@/core/results/icons", () => ({ getListItemIcon: () => undefined }));
vi.mock("@/features/anki/CaptureForm", () => ({ default: () => null }));
vi.mock("@/features/favorites/ankiToast", () => ({ addFavoritesToAnkiWithToast: vi.fn() }));
vi.mock("@/features/favorites/model", () => ({ buildFavoriteWord: vi.fn() }));
vi.mock("@/features/favorites/useFavoriteWords", () => ({
  useFavoriteWords: () => ({ has: () => false, toggle: vi.fn() }),
}));
vi.mock("@/providers/profiles/useAIProviderProfiles", () => ({ useAIProviderProfiles: () => ({}) }));
vi.mock("@/providers/registry", () => ({
  builtinDictionaryProviderServices: [],
  builtinTranslationServices: [],
  resolveSearchProviderServices: vi.fn(),
}));
vi.mock("@raycast/utils", () => ({ showFailureToast: vi.fn() }));
vi.mock("./nativeJSONFallback", () => ({ handleNativeJSONFallback: vi.fn() }));
vi.mock("./useInstalledEudic", () => ({ useInstalledEudic: () => ({ isInstalledEudic: false }) }));
vi.mock("./WordAccessories", () => ({ getWordAccessories: () => [] }));
vi.mock("./useQueryEngine", () => ({
  useQueryEngine: () => ({
    listEpoch: mock.epoch,
    queryGeneration: 1,
    viewSections: mock.sections,
    composedContent: { services: [] },
    isLoading: false,
    isShowDetail: false,
    currentFromLanguageItem: { youdaoLangCode: "en" },
    queryText: mock.query,
    queryTextWithTextInfo: mock.knownQuery,
    regenerateService: vi.fn(),
    clearQueryResult: vi.fn(),
  }),
}));
vi.mock("./ActionPanel", () => ({ ListActionPanel: () => null }));
vi.mock("@raycast/api", () => {
  const group = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    environment: { isDevelopment: false },
    List: Object.assign(
      ({ children, actions }: { children?: ReactNode; actions?: ReactNode }) => (
        <main data-testid="lookup-list">
          {actions}
          {children}
        </main>
      ),
      {
        Section: group,
        Item: Object.assign(({ actions }: { actions?: ReactNode }) => <div>{actions}</div>, { Detail: () => null }),
        EmptyView: () => null,
      },
    ),
    ActionPanel: group,
    Action: Object.assign(
      ({ title, onAction }: { title: string; onAction?: () => void }) => <button onClick={onAction}>{title}</button>,
      { Push: ({ title }: { title: string }) => <button>{title}</button> },
    ),
    launchCommand: mock.launch,
    LaunchType: { UserInitiated: "userInitiated" },
    Keyboard: { Shortcut: { Common: {} } },
    Icon: {},
    showToast: vi.fn(),
    Toast: { Style: {} },
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  mock.epoch = 0;
  mock.sections = [];
});
afterEach(cleanup);

it("opens capture as a regular standalone command instead of pushing beneath the hotkey lookup", async () => {
  render(<SearchWord initialQueryText="bearing" />);
  fireEvent.click(screen.getByText("Add to Anki"));
  await waitFor(() =>
    expect(mock.launch).toHaveBeenCalledWith({
      name: "capture-to-anki",
      type: "userInitiated",
      context: {
        captureDraft: {
          profileId: "en-zh",
          term: "bearing",
          meaning: "",
          example: '<b class="target">bearing</b>',
          context: "",
          images: [],
          extra: {},
        },
        captureDirection: "",
      },
    }),
  );
});

it("keeps normal list resets for new results when no capture form is open", () => {
  const view = render(<SearchWord initialQueryText="bearing" />);
  const originalList = screen.getByTestId("lookup-list");
  mock.epoch = 1;
  view.rerender(<SearchWord initialQueryText="bearing" />);
  expect(screen.getByTestId("lookup-list")).not.toBe(originalList);
});

it("uses the trusted OCR source directly and keeps the configured translation direction", () => {
  render(<SearchWord initialQueryText={"A large grouper hovered.\nBeside the reef."} initialSourceLanguage="en" />);
  expect(mock.query).not.toHaveBeenCalled();
  expect(mock.knownQuery).toHaveBeenCalledWith({
    word: "A large grouper hovered. Beside the reef.",
    fromLanguage: "en",
    toLanguage: "zh-CHS",
  });
});

it("switches the target to the other preferred language when OCR recognizes the configured target", () => {
  render(<SearchWord initialQueryText="苹果系统可以识别中文和英文" initialSourceLanguage="zh-CHS" />);
  expect(mock.knownQuery).toHaveBeenCalledWith({
    word: "苹果系统可以识别中文和英文",
    fromLanguage: "zh-CHS",
    toLanguage: "en",
  });
  expect(mock.query).not.toHaveBeenCalled();
});
