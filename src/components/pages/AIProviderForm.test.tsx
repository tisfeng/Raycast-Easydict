// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleProfile } from "@/ai-providers/types";

import { AIProviderForm } from "./AIProviderForm";

const testDoubles = vi.hoisted(() => ({
  cache: new Map<string, string>(),
  fetch:
    vi.fn<(url: string, options: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<unknown>>(),
  showToast: vi.fn(),
}));

vi.mock("@/utils/http", () => ({ timedFetch: testDoubles.fetch }));
vi.mock("@raycast/utils", () => ({ showFailureToast: vi.fn() }));
vi.mock("@raycast/api", async () => {
  const { createElement } = await import("react");
  const group = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  const input = ({
    id,
    title,
    value,
    onChange,
  }: {
    id: string;
    title: string;
    value: string;
    onChange: (value: string) => void;
  }) =>
    createElement("input", {
      id,
      "aria-label": title,
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    });
  const dropdown = ({
    id,
    title,
    value,
    children,
    isLoading,
    onChange,
    onFocus,
  }: {
    id: string;
    title: string;
    value: string;
    children?: ReactNode;
    isLoading?: boolean;
    onChange: (value: string) => void;
    onFocus?: () => void;
  }) =>
    createElement(
      "select",
      {
        id,
        "aria-label": title,
        value,
        "data-loading": isLoading,
        onFocus,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      },
      children,
    );
  return {
    AI: { Model: {} },
    Action: Object.assign(group, { SubmitForm: group }),
    ActionPanel: group,
    Form: Object.assign(group, {
      TextField: input,
      PasswordField: input,
      Description: () => null,
      Dropdown: Object.assign(dropdown, {
        Item: ({ title, value }: { title: string; value: string }) => createElement("option", { value }, title),
        Section: ({ title, children }: { title: string; children?: ReactNode }) =>
          createElement("optgroup", { label: title }, children),
      }),
    }),
    Icon: { Bolt: "bolt", SaveDocument: "save" },
    Toast: { Style: { Failure: "failure" } },
    Cache: class {
      get(key: string) {
        return testDoubles.cache.get(key);
      }
      set(key: string, value: string) {
        testDoubles.cache.set(key, value);
      }
    },
    environment: { isDevelopment: false },
    getPreferenceValues: () => ({}),
    showToast: testDoubles.showToast,
    useNavigation: () => ({ pop: vi.fn() }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  testDoubles.cache.clear();
  testDoubles.fetch.mockReset();
  testDoubles.showToast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AI provider form model discovery", () => {
  it.each(["https://opencode.ai/zen/v1", "https://opencode.ai/zen/go/v1/chat/completions"])(
    "keeps the loaded public catalog when credentials change for %s",
    async (endpoint) => {
      testDoubles.fetch.mockResolvedValue({ data: [{ id: "public-model" }] });
      render(<AIProviderForm profile={createProfile(endpoint, "")} onSave={vi.fn()} />);

      await advanceTimers(300);
      expect(modelOptions()).toContain("public-model");
      expect(testDoubles.fetch).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "entered-key" } });
      fireEvent.focus(screen.getByLabelText("Model"));
      await advanceTimers(300);

      expect(testDoubles.fetch).toHaveBeenCalledTimes(1);
      expect(modelOptions()).toContain("public-model");
      expect(testDoubles.fetch.mock.calls[0][1]).not.toHaveProperty("headers");
    },
  );

  it("keeps the public request in flight when credentials change and focus overlaps the timer", async () => {
    const pending = deferred();
    testDoubles.fetch.mockReturnValue(pending.promise);
    render(<AIProviderForm profile={createProfile("https://opencode.ai/zen/v1", "")} onSave={vi.fn()} />);

    await advanceTimers(299);
    expect(testDoubles.fetch).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByLabelText("Model"));
    const signal = testDoubles.fetch.mock.calls[0][1].signal;
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "entered-key" } });
    fireEvent.focus(screen.getByLabelText("Model"));
    await advanceTimers(300);

    expect(signal?.aborted).toBe(false);
    expect(testDoubles.fetch).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ data: [{ id: "public-model" }] }));
    expect(modelOptions()).toContain("public-model");
    expect(screen.getByLabelText("Model").getAttribute("data-loading")).toBe("false");
  });

  it("does not reload a catalog when the endpoint changes to an equivalent completion URL", async () => {
    testDoubles.fetch.mockResolvedValue({ data: [{ id: "private-model" }] });
    render(<AIProviderForm profile={createProfile("https://example.com/v1")} onSave={vi.fn()} />);
    await advanceTimers(300);

    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://example.com/v1/chat/completions/" },
    });
    fireEvent.focus(screen.getByLabelText("Model"));
    await advanceTimers(300);

    expect(testDoubles.fetch).toHaveBeenCalledTimes(1);
    expect(modelOptions()).toContain("private-model");
  });

  it("waits for private credentials and the 300 ms delay before loading models", async () => {
    testDoubles.fetch.mockResolvedValue({ data: [{ id: "private-model" }] });
    render(<AIProviderForm profile={createProfile("https://example.com/v1", "")} onSave={vi.fn()} />);
    fireEvent.focus(screen.getByLabelText("Model"));
    await advanceTimers(300);
    expect(testDoubles.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "entered-key" } });
    await advanceTimers(299);
    expect(testDoubles.fetch).not.toHaveBeenCalled();
    await advanceTimers(1);

    expect(testDoubles.fetch).toHaveBeenCalledWith("https://example.com/v1/models", {
      headers: { Authorization: "Bearer entered-key" },
      signal: expect.any(AbortSignal),
    });
    expect(modelOptions()).toContain("private-model");
  });

  it("isolates private model lists by credential and restores the matching cached list", async () => {
    testDoubles.fetch
      .mockResolvedValueOnce({ data: [{ id: "first-model" }] })
      .mockResolvedValueOnce({ data: [{ id: "second-model" }] });
    render(<AIProviderForm profile={createProfile("https://example.com/v1", "first-key")} onSave={vi.fn()} />);
    await advanceTimers(300);

    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "second-key" } });
    expect(modelOptions()).not.toContain("first-model");
    await advanceTimers(300);
    expect(modelOptions()).toContain("second-model");
    expect(testDoubles.fetch.mock.calls[1][1].headers).toEqual({ Authorization: "Bearer second-key" });

    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "first-key" } });
    expect(modelOptions()).toContain("first-model");
    expect(modelOptions()).not.toContain("second-model");
  });

  it("reports an invalid endpoint without fetching and loads models once it is corrected", async () => {
    testDoubles.fetch.mockResolvedValue({ data: [{ id: "private-model" }] });
    render(<AIProviderForm profile={createProfile("not a URL")} onSave={vi.fn()} />);
    await advanceTimers(300);
    expect(testDoubles.fetch).not.toHaveBeenCalled();
    expect(testDoubles.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Unable to fetch models" }));

    fireEvent.change(screen.getByLabelText("API Base URL"), { target: { value: "https://example.com/v1" } });
    await advanceTimers(300);
    expect(modelOptions()).toContain("private-model");
  });

  it("keeps cached models after a failed refresh and retries when the model field is focused", async () => {
    const profile = createProfile("https://example.com/v1");
    testDoubles.fetch
      .mockResolvedValueOnce({ data: [{ id: "cached-model" }] })
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({ data: [{ id: "refreshed-model" }] });
    const firstForm = render(<AIProviderForm profile={profile} onSave={vi.fn()} />);
    await advanceTimers(300);
    firstForm.unmount();
    render(<AIProviderForm profile={profile} onSave={vi.fn()} />);
    expect(modelOptions()).toContain("cached-model");

    await advanceTimers(300);
    expect(modelOptions()).toContain("cached-model");
    expect(testDoubles.showToast).toHaveBeenCalledTimes(1);
    expect(testDoubles.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Unable to fetch models",
        message: "Network unavailable",
      }),
    );

    await act(async () => fireEvent.focus(screen.getByLabelText("Model")));
    expect(testDoubles.fetch).toHaveBeenCalledTimes(3);
    expect(modelOptions()).toContain("refreshed-model");
  });

  it("removes old endpoint options and ignores its late response without clearing the current loading state", async () => {
    const oldRequest = deferred();
    const currentRequest = deferred();
    testDoubles.fetch
      .mockResolvedValueOnce({ data: [{ id: "first-model" }] })
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    render(<AIProviderForm profile={createProfile("https://first.example/v1")} onSave={vi.fn()} />);
    await advanceTimers(300);

    fireEvent.change(screen.getByLabelText("API Base URL"), { target: { value: "https://old.example/v1" } });
    expect(modelOptions()).not.toContain("first-model");
    await advanceTimers(300);
    const oldSignal = testDoubles.fetch.mock.calls[1][1].signal;
    fireEvent.change(screen.getByLabelText("API Base URL"), { target: { value: "https://current.example/v1" } });
    expect(oldSignal?.aborted).toBe(true);
    await advanceTimers(300);

    await act(async () => oldRequest.resolve({ data: [{ id: "stale-model" }] }));
    expect(modelOptions()).not.toContain("stale-model");
    expect(screen.getByLabelText("Model").getAttribute("data-loading")).toBe("true");
    await act(async () => currentRequest.resolve({ data: [{ id: "current-model" }] }));
    expect(modelOptions()).toContain("current-model");
    expect(screen.getByLabelText("Model").getAttribute("data-loading")).toBe("false");
    expect(testDoubles.showToast).not.toHaveBeenCalled();
  });

  it("cancels an in-flight request on unmount without showing a failure toast", async () => {
    const pending = deferred();
    testDoubles.fetch.mockReturnValue(pending.promise);
    const form = render(<AIProviderForm profile={createProfile("https://example.com/v1")} onSave={vi.fn()} />);
    await advanceTimers(300);
    const signal = testDoubles.fetch.mock.calls[0][1].signal;

    form.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.reject(new Error("Cancelled request")));
    expect(testDoubles.showToast).not.toHaveBeenCalled();
  });
});

function createProfile(endpoint: string, apiKey = "private-key"): OpenAICompatibleProfile {
  return {
    id: "profile",
    name: "Provider",
    adapter: "openai-compatible",
    enabled: true,
    order: 0,
    icon: { kind: "initials" },
    wordResultMode: "translation",
    endpoint,
    apiKey,
    model: "",
    tokenLimitMode: "max-tokens",
    jsonOutputMode: "prompt",
  };
}

function modelOptions() {
  return Array.from(screen.getByLabelText<HTMLSelectElement>("Model").options, (option) => option.value);
}

async function advanceTimers(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
