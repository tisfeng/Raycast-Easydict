// @vitest-environment jsdom
import { LaunchType } from "@raycast/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import Easydict from "./easydict";

const mock = vi.hoisted(() => ({ selected: vi.fn(), automatic: true, conflict: false }));
vi.mock("@/consts", () => ({
  myPreferences: {
    get enableAutomaticQuerySelectedText() {
      return mock.automatic;
    },
  },
}));
vi.mock("@/shared/logger", () => ({ logTrace: vi.fn(), logError: vi.fn() }));
vi.mock("@/features/search/LanguageConflictError", () => ({
  checkIfPreferredLanguagesConflict: () => (mock.conflict ? <div>Language conflict</div> : null),
}));
vi.mock("@/features/search/SearchWord", () => ({
  default: ({
    initialQueryText,
    initialSourceLanguage,
  }: {
    initialQueryText?: string;
    initialSourceLanguage?: string;
  }) => (
    <div data-testid="lookup" data-source={initialSourceLanguage}>
      {initialQueryText}
    </div>
  ),
}));
vi.mock("@raycast/api", () => ({
  getSelectedText: mock.selected,
  LaunchType: { UserInitiated: "userInitiated" },
  List: Object.assign(
    ({ children, actions }: { children?: ReactNode; actions?: ReactNode }) => (
      <div>
        {actions}
        {children}
      </div>
    ),
    { EmptyView: ({ title }: { title: string }) => <p>{title}</p> },
  ),
  ActionPanel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Action: ({ title, onAction }: { title: string; onAction: () => void }) => <button onClick={onAction}>{title}</button>,
}));

function pendingSelection() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const launch = { launchType: LaunchType.UserInitiated, arguments: { queryText: "" } };
beforeEach(() => {
  vi.clearAllMocks();
  mock.automatic = true;
  mock.conflict = false;
});
afterEach(cleanup);

it("waits for hotkey selection before exposing the interactive lookup and capture actions", async () => {
  const selection = pendingSelection();
  mock.selected.mockReturnValue(selection.promise);
  const view = render(<Easydict {...launch} />);
  expect(screen.getByText("Reading Selected Text…")).toBeTruthy();
  expect(screen.queryByTestId("lookup")).toBeNull();
  await act(async () => selection.resolve("  bearing  "));
  expect(screen.getByTestId("lookup").textContent).toBe("bearing");
  view.rerender(<Easydict {...launch} />);
  expect(mock.selected).toHaveBeenCalledTimes(1);
});

it("does not read selection when the root search supplies a word", () => {
  render(<Easydict {...launch} arguments={{ queryText: " assets " }} />);
  expect(screen.getByTestId("lookup").textContent).toBe("assets");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("uses fallback text without reading system selection", () => {
  render(<Easydict {...launch} fallbackText="grouper" />);
  expect(screen.getByTestId("lookup").textContent).toBe("grouper");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("keeps the explicit query ahead of fallback text", () => {
  render(<Easydict {...launch} arguments={{ queryText: "bearing" }} fallbackText="grouper" />);
  expect(screen.getByTestId("lookup").textContent).toBe("bearing");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("opens manual input after selection fails", async () => {
  mock.selected.mockRejectedValue(new Error("Selection unavailable"));
  render(<Easydict {...launch} />);
  expect((await screen.findByTestId("lookup")).textContent).toBe("");
});

it("allows manual entry while selection is pending and ignores its late completion", async () => {
  const selection = pendingSelection();
  mock.selected.mockReturnValue(selection.promise);
  render(<Easydict {...launch} />);
  fireEvent.click(screen.getByText("Enter Word Manually"));
  expect(screen.getByTestId("lookup").textContent).toBe("");
  await act(async () => selection.resolve("stale selection"));
  expect(screen.getByTestId("lookup").textContent).toBe("");
});

it("does not read selection when automatic selected-text lookup is disabled", () => {
  mock.automatic = false;
  render(<Easydict {...launch} />);
  expect(screen.getByTestId("lookup").textContent).toBe("");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("does not resolve a selection into an unmounted command", async () => {
  const selection = pendingSelection();
  mock.selected.mockReturnValue(selection.promise);
  const view = render(<Easydict {...launch} />);
  view.unmount();
  await act(async () => selection.resolve("bearing"));
  expect(screen.queryByTestId("lookup")).toBeNull();
});

it("does not read selection before the user resolves a language configuration conflict", () => {
  mock.conflict = true;
  render(<Easydict {...launch} />);
  expect(screen.getByText("Language conflict")).toBeTruthy();
  expect(mock.selected).not.toHaveBeenCalled();
});

it("passes a valid OCR source hint into lookup without reading system selection", () => {
  render(
    <Easydict
      {...launch}
      arguments={{ queryText: "A large grouper hovered." }}
      launchContext={{ ocrSourceLanguage: "en" }}
    />,
  );
  expect(screen.getByTestId("lookup").getAttribute("data-source")).toBe("en");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("ignores an unsupported OCR source and leaves normal language detection available", () => {
  render(
    <Easydict
      {...launch}
      arguments={{ queryText: "A large grouper hovered." }}
      launchContext={{ ocrSourceLanguage: "unknown" }}
    />,
  );
  expect(screen.getByTestId("lookup").hasAttribute("data-source")).toBe(false);
});
