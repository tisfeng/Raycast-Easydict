import { getSelectedText, launchCommand, showHUD } from "@raycast/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLastQuery } from "@/features/search/lastQuery";

import command from "./search-selected-text";

vi.mock("@raycast/api", () => {
  const store = new Map<string, string>();
  return {
    Cache: class {
      get(key: string) {
        return store.get(key);
      }
      set(key: string, value: string) {
        store.set(key, value);
      }
      remove(key: string) {
        store.delete(key);
      }
    },
    environment: { isDevelopment: false },
    getSelectedText: vi.fn(),
    launchCommand: vi.fn(),
    LaunchType: { UserInitiated: "userInitiated" },
    showHUD: vi.fn(),
  };
});

function launchedQueryText() {
  return vi.mocked(launchCommand).mock.calls.at(-1)?.[0].arguments?.queryText;
}

describe("Search Selected Text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLastQuery("");
  });

  it("launches Search Word with the trimmed selection and marks the selection as already read", async () => {
    setLastQuery("previous");
    vi.mocked(getSelectedText).mockResolvedValue("  house \n");

    await command();

    expect(launchCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "easydict",
        arguments: { queryText: "house" },
        context: { selectedTextChecked: true },
      }),
    );
  });

  it("reopens the last search when nothing is selected", async () => {
    setLastQuery("house");
    vi.mocked(getSelectedText).mockRejectedValue(new Error("Unable to get selected text"));

    await command();

    expect(launchedQueryText()).toBe("house");
  });

  it("opens an empty search when nothing is selected and the last search was cleared", async () => {
    setLastQuery("house");
    setLastQuery("");
    vi.mocked(getSelectedText).mockResolvedValue("   ");

    await command();

    expect(launchedQueryText()).toBe("");
  });

  it("shows a HUD when Search Word cannot be launched", async () => {
    vi.mocked(getSelectedText).mockResolvedValue("house");
    vi.mocked(launchCommand).mockRejectedValue(new Error("launch failed"));

    await command();

    expect(showHUD).toHaveBeenCalledWith("⚠️ Failed to query Easy Dictionary");
  });
});
