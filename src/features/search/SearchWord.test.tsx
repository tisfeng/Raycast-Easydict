// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { ViewSection } from "@/core/content/viewTypes";
import { DictionaryType } from "@/core/results/kinds";

import SearchWord from "./SearchWord";

const mock = vi.hoisted(() => ({ epoch: 0, sections: [] as ViewSection[] }));
vi.mock("@/consts", () => ({ myPreferences: { enableAIProviders: false } }));
vi.mock("@/core/config", () => ({
  config: { preferredLanguage1: { youdaoLangCode: "en" }, preferredLanguage2: { youdaoLangCode: "zh-CHS" } },
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
    queryText: vi.fn(),
    queryTextWithTextInfo: vi.fn(),
    regenerateService: vi.fn(),
    clearQueryResult: vi.fn(),
  }),
}));
vi.mock("./ActionPanel", () => ({
  ListActionPanel: ({ onCapturePush, onCapturePop }: { onCapturePush: () => void; onCapturePop: () => void }) => (
    <>
      <button onClick={onCapturePush}>Capture Result</button>
      <button onClick={onCapturePop}>Back from Result Capture</button>
    </>
  ),
}));
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
    Action: {
      Push: ({ title, onPush, onPop }: { title: string; onPush?: () => void; onPop?: () => void }) => (
        <>
          <button onClick={onPush}>{title}</button>
          <button onClick={onPop}>Back from Capture</button>
        </>
      ),
    },
    Keyboard: { Shortcut: { Common: {} } },
    Icon: {},
    showToast: vi.fn(),
    Toast: { Style: {} },
  };
});
beforeEach(() => {
  mock.epoch = 0;
  mock.sections = [];
});
afterEach(cleanup);

it("does not replace the lookup List when results arrive beneath an open capture form", () => {
  const view = render(<SearchWord initialQueryText="bearing" />);
  const originalList = screen.getByTestId("lookup-list");
  fireEvent.click(screen.getByText("Add to Anki"));
  mock.epoch = 1;
  view.rerender(<SearchWord initialQueryText="bearing" />);
  expect(screen.getByTestId("lookup-list")).toBe(originalList);
  fireEvent.click(screen.getByText("Back from Capture"));
  expect(screen.getByTestId("lookup-list")).not.toBe(originalList);
});

it("keeps normal list resets for new results when no capture form is open", () => {
  const view = render(<SearchWord initialQueryText="bearing" />);
  const originalList = screen.getByTestId("lookup-list");
  mock.epoch = 1;
  view.rerender(<SearchWord initialQueryText="bearing" />);
  expect(screen.getByTestId("lookup-list")).not.toBe(originalList);
});

it("also preserves the source List when capture opens from a dictionary result", () => {
  const service = {
    serviceId: "dictionary",
    serviceLabel: "Dictionary",
    kind: "dictionary",
    type: DictionaryType.Youdao,
    query: { word: "bearing", fromLanguage: "en", toLanguage: "zh-CHS" },
  } as const;
  mock.epoch = 1;
  mock.sections = [
    {
      kind: "definitions",
      service,
      items: [{ kind: "definition", title: "轴承", copyText: "轴承", service, renderBody: () => "轴承" }],
    },
  ];
  const view = render(<SearchWord initialQueryText="bearing" />);
  const originalList = screen.getByTestId("lookup-list");
  fireEvent.click(screen.getByText("Capture Result"));
  mock.epoch = 2;
  view.rerender(<SearchWord initialQueryText="bearing" />);
  expect(screen.getByTestId("lookup-list")).toBe(originalList);
  fireEvent.click(screen.getByText("Back from Result Capture"));
  expect(screen.getByTestId("lookup-list")).not.toBe(originalList);
});
