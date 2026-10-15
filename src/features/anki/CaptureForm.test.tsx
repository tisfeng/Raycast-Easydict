// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CaptureToAnki from "@/capture-to-anki";
import ResumeAnkiDraft from "@/resume-anki-draft";

import CaptureForm from "./CaptureForm";
import { defaultProfile, emptyDraft } from "./model";

const mock = vi.hoisted(() => ({
  data: new Map<string, string>(),
  rpc: vi.fn(),
  failure: vi.fn(),
  toast: vi.fn(),
  selected: vi.fn(),
  paste: vi.fn(),
  close: vi.fn(),
}));
vi.mock("ofetch", () => ({ ofetch: mock.rpc }));
vi.mock("@/consts", () => ({ myPreferences: { ankiConnectUrl: "http://localhost:8765" } }));
vi.mock("./clipboard", () => ({ pasteContext: mock.paste }));
vi.mock("./Settings", () => ({ default: () => null }));
vi.mock("@raycast/utils", () => ({ showFailureToast: mock.failure }));
vi.mock("@raycast/api", async () => {
  const { createElement: h } = await import("react");
  const group = ({ children }: { children?: ReactNode }) => h("div", null, children);
  const action = ({
    title,
    onAction,
    onSubmit,
    shortcut,
  }: {
    title: string;
    onAction?: () => void;
    onSubmit?: () => void;
    shortcut?: object;
  }) => h("button", { onClick: onAction ?? onSubmit, "data-shortcut": JSON.stringify(shortcut) }, title);
  const input = ({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) =>
    h("input", {
      "aria-label": title,
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    });
  const dropdown = ({
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
      { "aria-label": title, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) },
      children,
    );
  return {
    Action: Object.assign(action, { SubmitForm: action, Push: action }),
    ActionPanel: group,
    Form: Object.assign(
      ({ actions, children }: { actions: ReactNode; children: ReactNode }) => h("div", null, actions, children),
      {
        TextField: input,
        TextArea: input,
        FilePicker: () => null,
        Separator: () => null,
        Description: ({ title, text }: { title?: string; text: string }) => h("p", null, title, " ", text),
        Dropdown: Object.assign(dropdown, {
          Item: ({ title, value }: { title: string; value: string }) => h("option", { value }, title),
        }),
      },
    ),
    Icon: {},
    Detail: ({ markdown, actions }: { markdown: string; actions?: ReactNode }) => h("div", null, markdown, actions),
    closeMainWindow: mock.close,
    PopToRootType: { Suspended: "suspended" },
    Keyboard: { Shortcut: { Common: { Pin: {}, Open: {} } } },
    Toast: { Style: { Failure: "failure", Success: "success" } },
    showToast: mock.toast,
    getSelectedText: mock.selected,
    LocalStorage: {
      getItem: async (key: string) => mock.data.get(key),
      setItem: async (key: string, value: string) => {
        mock.data.set(key, value);
      },
      removeItem: async (key: string) => {
        mock.data.delete(key);
      },
    },
  };
});
const configured = { ...defaultProfile(), model: "Vocabulary", deck: "English" };
const fields = ["English", "Chinese", "Example", "Context", "Custom"];
beforeEach(() => {
  vi.clearAllMocks();
  mock.selected.mockResolvedValue("Other selected text");
  mock.data.clear();
  mock.data.set(
    "anki-capture-settings-v1",
    JSON.stringify({
      version: 1,
      url: "http://localhost:8765",
      apiKey: "",
      activeProfileId: "en-zh",
      profiles: [configured, { ...configured, id: "ja", name: "Japanese", fromLanguage: "ja" }],
    }),
  );
  mock.rpc.mockImplementation(async (_url, options) => ({
    result: (
      {
        modelFieldNames: fields,
        deckNames: ["English"],
        findCards: [],
        canAddNotesWithErrorDetail: [{ canAdd: true }],
        addNote: 42,
      } as Record<string, unknown>
    )[options.body.action],
    error: null,
  }));
});
afterEach(cleanup);
async function loaded() {
  await screen.findByLabelText("Custom");
}
describe("capture form", () => {
  it("prefills selected content and restores edited context after remount", async () => {
    const initial = { ...emptyDraft("charge"), meaning: "收费" };
    const view = render(<CaptureForm initial={initial} />);
    await loaded();
    expect((screen.getByLabelText("Meaning → Chinese") as HTMLInputElement).value).toBe("收费");
    fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "Original sentence" } });
    await waitFor(() =>
      expect([...mock.data.values()].some((value) => value.includes("Original sentence"))).toBe(true),
    );
    view.unmount();
    render(<CaptureForm initial={initial} />);
    await loaded();
    expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Original sentence");
  });
  it("preserves input when Anki rejects a note", async () => {
    const normal = mock.rpc.getMockImplementation()!;
    mock.rpc.mockImplementation(async (url, options) =>
      options.body.action === "canAddNotesWithErrorDetail"
        ? { result: [{ canAdd: false, error: "missing cloze" }], error: null }
        : normal(url, options),
    );
    render(<CaptureForm initial={emptyDraft("charge")} />);
    await loaded();
    fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "Keep this" } });
    fireEvent.click(screen.getByText("Add to Anki"));
    await waitFor(() => expect(mock.failure).toHaveBeenCalled());
    expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Keep this");
    expect(mock.rpc.mock.calls.some(([, options]) => options.body.action === "addNote")).toBe(false);
  });
  it("prevents rapid double submissions and clears only successful drafts", async () => {
    const normal = mock.rpc.getMockImplementation()!;
    let release: (() => void) | undefined;
    mock.rpc.mockImplementation(async (url, options) => {
      if (options.body.action === "addNote")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return normal(url, options);
    });
    render(<CaptureForm initial={emptyDraft("charge")} />);
    await loaded();
    fireEvent.click(screen.getByText("Add to Anki"));
    fireEvent.click(screen.getByText("Add to Anki"));
    await waitFor(() => expect(release).toBeDefined());
    expect(mock.rpc.mock.calls.filter(([, options]) => options.body.action === "addNote")).toHaveLength(1);
    await act(async () => {
      release?.();
    });
    await screen.findByText(/Note 42/);
    expect([...mock.data.keys()].filter((key) => key.startsWith("anki-capture-draft"))).toHaveLength(0);
  });
  it("switches profiles without losing context or carrying over custom fields", async () => {
    render(<CaptureForm initial={emptyDraft("charge")} />);
    await loaded();
    fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "Keep" } });
    fireEvent.change(screen.getByLabelText("Custom"), { target: { value: "Old type" } });
    fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "ja" } });
    await loaded();
    expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Keep");
    expect((screen.getByLabelText("Custom") as HTMLInputElement).value).toBe("");
  });
  it("requires choosing one duplicate before append and lets cancellation keep the draft", async () => {
    const normal = mock.rpc.getMockImplementation()!;
    mock.rpc.mockImplementation(async (url, options) => {
      if (options.body.action === "findCards") return { result: [1, 2], error: null };
      if (options.body.action === "cardsInfo")
        return {
          result: [
            { note: 1, deckName: "English" },
            { note: 2, deckName: "English" },
          ],
          error: null,
        };
      if (options.body.action === "notesInfo")
        return {
          result: [1, 2].map((noteId) => ({
            noteId,
            modelName: "Vocabulary",
            fields: { English: { value: "charge" }, Context: { value: `old ${noteId}` } },
          })),
          error: null,
        };
      return normal(url, options);
    });
    render(<CaptureForm initial={{ ...emptyDraft("charge"), context: "New" }} />);
    await loaded();
    fireEvent.click(screen.getByText("Add to Anki"));
    await screen.findByLabelText("Existing Note");
    expect((screen.getByLabelText("Existing Note") as HTMLSelectElement).value).toBe("");
    fireEvent.click(screen.getByText("Append Context to Selected Note"));
    expect(mock.rpc.mock.calls.some(([, options]) => options.body.action === "updateNoteFields")).toBe(false);
    fireEvent.click(screen.getByText("Cancel Duplicate Action"));
    expect(screen.queryByLabelText("Existing Note")).toBeNull();
    expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("New");
  });
  it("falls back to manual input when system selection is unavailable", async () => {
    mock.selected.mockRejectedValue(new Error("No selection"));
    render(<CaptureToAnki />);
    await loaded();
    fireEvent.change(screen.getByLabelText("Term → English"), { target: { value: "manual" } });
    expect((screen.getByLabelText("Term → English") as HTMLInputElement).value).toBe("manual");
    expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Enter a Word Manually" }));
  });
});

it("pastes only when explicitly invoked and keeps images inside Context", async () => {
  const { imageToken } = await import("./context");
  const token = imageToken("/copied.png");
  mock.paste.mockResolvedValue({ context: `Source: reef\n${token}`, images: ["/copied.png"] });
  render(<CaptureForm initial={emptyDraft("grouper")} />);
  await loaded();
  expect(mock.paste).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Source (Optional)")).toBeNull();
  expect(screen.queryByLabelText("Context Images")).toBeNull();
  expect(screen.getByText("Add to Anki").getAttribute("data-shortcut")).toContain('"modifiers":["opt"]');
  fireEvent.click(screen.getByText("Paste into Context"));
  await waitFor(() => expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toContain(token));
  fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "Source: reef" } });
  await waitFor(() => {
    const raw = [...mock.data.entries()].find(([key]) => key.startsWith("anki-capture-draft"))?.[1];
    expect(JSON.parse(raw!).draft.images).toEqual([]);
  });
});

it("does not overwrite a reopened draft when an earlier paste finishes after closing", async () => {
  let finish: ((value: { context: string }) => void) | undefined;
  mock.paste.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const initial = emptyDraft("grouper");
  const view = render(<CaptureForm initial={initial} />);
  await loaded();
  fireEvent.click(screen.getByText("Paste into Context"));
  view.unmount();
  render(<CaptureForm initial={initial} />);
  await loaded();
  fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "New draft" } });
  await act(async () => {
    finish?.({ context: "Old paste" });
  });
  expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("New draft");
  await waitFor(() => {
    const raw = [...mock.data.entries()].find(([key]) => key.startsWith("anki-capture-draft"))?.[1];
    expect(JSON.parse(raw!).draft.context).toBe("New draft");
  });
});

it("updates the default placeholder with the term but preserves a manually edited Example", async () => {
  render(<CaptureForm initial={emptyDraft("bearing")} />);
  await loaded();
  expect((screen.getByLabelText("Example → Example") as HTMLInputElement).value).toBe('<b class="target">bearing</b>');
  fireEvent.change(screen.getByLabelText("Term → English"), { target: { value: "grouper" } });
  expect((screen.getByLabelText("Example → Example") as HTMLInputElement).value).toBe('<b class="target">grouper</b>');
  fireEvent.change(screen.getByLabelText("Example → Example"), {
    target: { value: 'Manual <b class="target">grouper</b>' },
  });
  fireEvent.change(screen.getByLabelText("Term → English"), { target: { value: "reef" } });
  expect((screen.getByLabelText("Example → Example") as HTMLInputElement).value).toBe(
    'Manual <b class="target">grouper</b>',
  );
});
it("automatically recognizes ID and hides it from manual extra fields", async () => {
  const normal = mock.rpc.getMockImplementation()!;
  mock.rpc.mockImplementation(async (url, options) =>
    options.body.action === "modelFieldNames" ? { result: ["ID", ...fields], error: null } : normal(url, options),
  );
  render(<CaptureForm initial={emptyDraft("bearing")} />);
  await loaded();
  expect(screen.queryByLabelText("ID")).toBeNull();
  expect(screen.getByText(/Assigned automatically/)).toBeTruthy();
});

it("saves a freshly opened card before hiding and suspends the return to root search", async () => {
  const initial = { ...emptyDraft("bearing"), meaning: "轴承" };
  render(<CaptureForm initial={initial} />);
  await loaded();
  mock.close.mockImplementation(async () => {
    const { loadRecentDraft } = await import("./storage");
    expect((await loadRecentDraft())?.draft).toEqual(initial);
  });
  fireEvent.click(screen.getByText("Hide and Keep Draft"));
  await waitFor(() => expect(mock.close).toHaveBeenCalledWith({ popToRootType: "suspended" }));
});
it("resumes the original storage key even when the word changed, without reading selected text", async () => {
  const { draftKey, saveDraft, loadRecentDraft } = await import("./storage");
  const original = draftKey("bearing", "en:zh-CHS");
  await saveDraft(original, { ...emptyDraft("grouper"), context: "Already copied" });
  render(<ResumeAnkiDraft />);
  await loaded();
  expect((screen.getByLabelText("Term → English") as HTMLInputElement).value).toBe("grouper");
  expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Already copied");
  expect(mock.selected).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Context → Context"), { target: { value: "More copied text" } });
  await waitFor(async () =>
    expect(await loadRecentDraft()).toMatchObject({ key: original, draft: { context: "More copied text" } }),
  );
});
it("resumes an untouched seeded card after its original command is closed", async () => {
  const initial = { ...emptyDraft("bearing"), meaning: "轴承" };
  const view = render(<CaptureForm initial={initial} direction="en:zh-CHS" />);
  await loaded();
  view.unmount();
  render(<ResumeAnkiDraft />);
  await loaded();
  expect((screen.getByLabelText("Meaning → Chinese") as HTMLInputElement).value).toBe("轴承");
});
it("offers a new capture when no unsent card exists", async () => {
  render(<ResumeAnkiDraft />);
  await screen.findByText(/No unsent Anki draft/);
  expect(mock.selected).not.toHaveBeenCalled();
});

it("keeps dictionary handoff fields and language profile without rereading system selection", async () => {
  const captureDraft = { ...emptyDraft("魚"), meaning: "鱼", context: "Original source", extra: { Custom: "Kept" } };
  render(<CaptureToAnki launchContext={{ captureDraft, captureDirection: "ja:zh-CHS" }} />);
  await loaded();
  expect((screen.getByLabelText("Term → English") as HTMLInputElement).value).toBe("魚");
  expect((screen.getByLabelText("Meaning → Chinese") as HTMLInputElement).value).toBe("鱼");
  expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Original source");
  expect((screen.getByLabelText("Custom") as HTMLInputElement).value).toBe("Kept");
  expect((screen.getByLabelText("Profile") as HTMLSelectElement).value).toBe("ja");
  expect(mock.selected).not.toHaveBeenCalled();
  expect(mock.rpc.mock.calls.every(([, options]) => options.body.action === "modelFieldNames")).toBe(true);
});

it("restores the existing word and direction draft when promoting capture into its own command", async () => {
  const { draftKey, saveDraft } = await import("./storage");
  const edited = { ...emptyDraft("bearing"), meaning: "Edited meaning", context: "Already copied" };
  await saveDraft(draftKey("bearing", "en:zh-CHS"), edited);
  render(
    <CaptureToAnki
      launchContext={{ captureDraft: { ...emptyDraft("bearing"), meaning: "轴承" }, captureDirection: "en:zh-CHS" }}
    />,
  );
  await loaded();
  expect((screen.getByLabelText("Meaning → Chinese") as HTMLInputElement).value).toBe("Edited meaning");
  expect((screen.getByLabelText("Context → Context") as HTMLInputElement).value).toBe("Already copied");
  expect(mock.selected).not.toHaveBeenCalled();
});

it("rejects malformed capture handoffs without changing drafts or reading selection", async () => {
  const before = [...mock.data];
  render(
    <CaptureToAnki
      launchContext={{ captureDraft: { ...emptyDraft("bearing"), meaning: 42 }, captureDirection: "en:zh-CHS" }}
    />,
  );
  expect(await screen.findByText(/Invalid capture handoff/)).toBeTruthy();
  expect([...mock.data]).toEqual(before);
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.selected).not.toHaveBeenCalled();
});
