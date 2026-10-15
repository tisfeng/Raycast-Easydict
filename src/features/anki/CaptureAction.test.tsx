// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import CaptureAction from "./CaptureAction";
import { emptyDraft } from "./model";

const mock = vi.hoisted(() => ({ launch: vi.fn(), failure: vi.fn() }));
vi.mock("@raycast/api", () => ({
  Action: ({ title, onAction, shortcut }: { title: string; onAction: () => void; shortcut: object }) => (
    <button onClick={onAction} data-shortcut={JSON.stringify(shortcut)}>
      {title}
    </button>
  ),
  Icon: {},
  launchCommand: mock.launch,
  LaunchType: { UserInitiated: "userInitiated" },
  Keyboard: { Shortcut: { Common: {} } },
}));
vi.mock("@raycast/utils", () => ({ showFailureToast: mock.failure }));
beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

it("hands the exact selected meaning and direction to the standalone form with Option+A", async () => {
  const initial = { ...emptyDraft("grouper"), meaning: "石斑鱼", context: "Source already collected" };
  render(<CaptureAction initial={initial} direction="en:zh-CHS" />);
  expect(screen.getByText("Add to Anki").getAttribute("data-shortcut")).toContain('"modifiers":["opt"]');
  fireEvent.click(screen.getByText("Add to Anki"));
  await waitFor(() =>
    expect(mock.launch).toHaveBeenCalledWith({
      name: "capture-to-anki",
      type: "userInitiated",
      context: { captureDraft: initial, captureDirection: "en:zh-CHS" },
    }),
  );
});

it("does not start two capture commands while a launch is in progress", async () => {
  let finish!: () => void;
  mock.launch.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  render(<CaptureAction initial={emptyDraft("bearing")} />);
  fireEvent.click(screen.getByText("Add to Anki"));
  fireEvent.click(screen.getByText("Add to Anki"));
  expect(mock.launch).toHaveBeenCalledTimes(1);
  await act(async () => finish());
});

it("reports a failed launch and allows trying again with the same collected content", async () => {
  const error = new Error("Launch failed");
  mock.launch.mockRejectedValueOnce(error).mockResolvedValue(undefined);
  const initial = { ...emptyDraft("bearing"), meaning: "轴承" };
  render(<CaptureAction initial={initial} />);
  fireEvent.click(screen.getByText("Add to Anki"));
  await waitFor(() => expect(mock.failure).toHaveBeenCalledWith(error, { title: "Could Not Open Anki Capture" }));
  fireEvent.click(screen.getByText("Add to Anki"));
  await waitFor(() => expect(mock.launch).toHaveBeenCalledTimes(2));
  expect(mock.launch.mock.calls[1][0].context.captureDraft).toEqual(initial);
});
