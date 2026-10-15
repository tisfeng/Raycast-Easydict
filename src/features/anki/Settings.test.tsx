// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultProfile } from "./model";
import Settings from "./Settings";

const host = vi.hoisted(() => ({ rpc: vi.fn(), data: new Map<string, string>(), settings: {}, failure: vi.fn() }));
vi.mock("ofetch", () => ({ ofetch: host.rpc }));
vi.mock("@/consts", () => ({ myPreferences: { ankiConnectUrl: "http://localhost:8765" } }));
vi.mock("@raycast/utils", () => ({
  showFailureToast: host.failure,
  usePromise: () => ({ data: host.settings, isLoading: false, revalidate: async () => undefined }),
}));
vi.mock("@raycast/api", async () => {
  const { createElement: h, useState } = await import("react");
  const group = ({ children }: { children?: ReactNode }) => h("div", null, children);
  const action = ({ title, onAction, onSubmit }: { title: string; onAction?: () => void; onSubmit?: () => void }) =>
    h("button", { onClick: onAction ?? onSubmit }, title);
  const input = ({
    title,
    value,
    onChange,
    onBlur,
  }: {
    title: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
  }) =>
    h("input", {
      "aria-label": title,
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      onBlur,
    });
  return {
    Action: Object.assign(action, {
      SubmitForm: action,
      Push: ({ title, target }: { title: string; target: ReactNode }) => {
        const [open, setOpen] = useState(false);
        return open ? target : h("button", { onClick: () => setOpen(true) }, title);
      },
    }),
    ActionPanel: group,
    List: Object.assign(group, { Item: ({ actions }: { actions: ReactNode }) => actions, EmptyView: () => null }),
    Form: Object.assign(
      ({ actions, children }: { actions: ReactNode; children: ReactNode }) => h("div", null, actions, children),
      {
        TextField: input,
        PasswordField: input,
        Separator: () => null,
        Description: ({ title, text }: { title?: string; text: string }) => h("p", null, title, " ", text),
        Dropdown: Object.assign(
          ({
            title,
            value,
            onChange,
            children,
          }: {
            title: string;
            value: string;
            onChange: (value: string) => void;
            children: ReactNode;
          }) =>
            h(
              "select",
              {
                "aria-label": title,
                value,
                onChange: (event: { target: { value: string } }) => onChange(event.target.value),
              },
              children,
            ),
          { Item: ({ value, title }: { value: string; title: string }) => h("option", { value }, title) },
        ),
      },
    ),
    Icon: {},
    Toast: { Style: { Success: "success" } },
    Keyboard: { Shortcut: { Common: { Refresh: {} } } },
    showToast: vi.fn(),
    useNavigation: () => ({ pop: vi.fn() }),
    LocalStorage: {
      getItem: async (key: string) => host.data.get(key),
      setItem: async (key: string, value: string) => {
        host.data.set(key, value);
      },
    },
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  host.data.clear();
  host.settings = {
    version: 1,
    url: "http://localhost:8765",
    apiKey: "",
    activeProfileId: "en-zh",
    profiles: [
      {
        ...defaultProfile(),
        deck: "Study",
        model: "Basic",
        mapping: { term: "Front", meaning: "Back", context: "", example: "" },
      },
    ],
  };
  host.rpc.mockImplementation(async (_url, options) => ({
    result: (
      {
        version: 6,
        deckNames: ["Study", "Japanese"],
        modelNames: ["Basic"],
        modelFieldNames: ["Front", "Back"],
      } as Record<string, unknown>
    )[options.body.action],
    error: null,
  }));
});
afterEach(cleanup);
function open() {
  render(<Settings />);
  fireEvent.click(screen.getByText("Edit Profile"));
}
describe("Anki connection settings", () => {
  it("loads decks automatically and shows connection status without an action-menu visit", async () => {
    open();
    await screen.findByText(/Connected.*2 decks/);
    expect(screen.getByRole("option", { name: "Japanese" })).toBeTruthy();
    expect(host.data.size).toBe(0);
  });
  it("shows authentication failures inline and makes Test Connection the primary action", async () => {
    host.rpc.mockResolvedValue({ result: null, error: "valid API key must be provided" });
    open();
    await screen.findByText(/Authentication failed/);
    expect(screen.getAllByRole("button")[0].textContent).toBe("Test Connection / Retry");
    expect(host.data.size).toBe(0);
  });
  it("keeps fetched decks visible when a stale note type fails to load", async () => {
    const normal = host.rpc.getMockImplementation()!;
    host.rpc.mockImplementation(async (url, options) =>
      options.body.action === "modelFieldNames" ? { result: null, error: "model was removed" } : normal(url, options),
    );
    open();
    await screen.findByText(/model was removed/);
    expect(screen.getByRole("option", { name: "Japanese" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test Connection / Retry" })).toBeTruthy();
  });
  it("reconnects on URL blur and ignores an old connection response", async () => {
    const normal = host.rpc.getMockImplementation()!;
    let release: (() => void) | undefined;
    host.rpc.mockImplementation(async (url, options) => {
      if (url === "http://localhost:8765/" && options.body.action === "version")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return normal(url, options);
    });
    open();
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.change(screen.getByLabelText("AnkiConnect URL"), { target: { value: "localhost:8766" } });
    fireEvent.blur(screen.getByLabelText("AnkiConnect URL"));
    await screen.findByText(/Connected.*2 decks/);
    await act(async () => {
      release?.();
    });
    expect(host.rpc.mock.calls.some(([url]) => url === "http://localhost:8766/")).toBe(true);
    expect(host.data.size).toBe(0);
  });
  it("reports removed decks and mappings before saving", async () => {
    const normal = host.rpc.getMockImplementation()!;
    host.rpc.mockImplementation(async (url, options) =>
      options.body.action === "deckNames" ? { result: ["Japanese"], error: null } : normal(url, options),
    );
    open();
    await screen.findByText(/Selected deck.*no longer exists/);
    fireEvent.click(screen.getByText("Save Profile"));
    await waitFor(() => expect(host.failure).toHaveBeenCalled());
    expect(host.data.size).toBe(0);
  });
  it("keeps missing note types and mapped fields explicit until the user changes them", async () => {
    const normal = host.rpc.getMockImplementation()!;
    host.rpc.mockImplementation(async (url, options) =>
      options.body.action === "modelNames" ? { result: ["Other"], error: null } : normal(url, options),
    );
    open();
    await screen.findByText(/Selected note type.*no longer exists/);
    expect(screen.getByRole("option", { name: "Japanese" })).toBeTruthy();
    cleanup();
    host.rpc.mockImplementation(async (url, options) =>
      options.body.action === "modelFieldNames" ? { result: ["Front"], error: null } : normal(url, options),
    );
    open();
    await screen.findByText(/Mapped fields no longer exist/);
    expect(screen.getByLabelText("Meaning → Field")).toHaveProperty("value", "Back");
  });
  it("uses an edited API key on blur and saves only after the Save Profile action", async () => {
    open();
    await screen.findByText(/Connected.*2 decks/);
    fireEvent.change(screen.getByLabelText("API Key (Optional)"), { target: { value: "updated-key" } });
    fireEvent.blur(screen.getByLabelText("API Key (Optional)"));
    await waitFor(() =>
      expect(host.rpc.mock.calls.some(([, options]) => options.body.key === "updated-key")).toBe(true),
    );
    await screen.findByText(/Connected.*2 decks/);
    await waitFor(() => expect(screen.getAllByRole("button")[0].textContent).toBe("Save Profile"));
    expect(host.data.size).toBe(0);
    fireEvent.click(screen.getByText("Save Profile"));
    await waitFor(() => expect(host.data.size).toBe(1));
    expect(JSON.parse([...host.data.values()][0]).apiKey).toBe("updated-key");
  });
});
