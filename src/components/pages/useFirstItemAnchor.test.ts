// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFirstItemAnchor } from "./useFirstItemAnchor";

describe("useFirstItemAnchor", () => {
  it("follows the first result while the user has not selected an item", () => {
    const { result, rerender } = renderHook(
      ({ itemIds, queryGeneration }) => useFirstItemAnchor(itemIds, queryGeneration),
      { initialProps: { itemIds: ["provider-c:item"], queryGeneration: 1 } },
    );

    expect(result.current.selectedItemId).toBe("provider-c:item");

    act(() => result.current.onSelectionChange(result.current.selectedItemId ?? null));
    rerender({ itemIds: ["provider-b:item", "provider-c:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-b:item");

    act(() => result.current.onSelectionChange(result.current.selectedItemId ?? null));
    rerender({ itemIds: ["provider-a:item", "provider-b:item", "provider-c:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });

  it("preserves a valid user selection when a new first result arrives", () => {
    const { result, rerender } = renderHook(
      ({ itemIds, queryGeneration }) => useFirstItemAnchor(itemIds, queryGeneration),
      { initialProps: { itemIds: ["provider-a:item", "provider-b:item"], queryGeneration: 1 } },
    );

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");

    rerender({ itemIds: ["provider-c:item", "provider-a:item", "provider-b:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-b:item");
  });

  it("preserves a user selection of the first item when another result arrives before it", () => {
    const { result, rerender } = renderHook(
      ({ itemIds, queryGeneration }) => useFirstItemAnchor(itemIds, queryGeneration),
      { initialProps: { itemIds: ["provider-a:item", "provider-b:item"], queryGeneration: 1 } },
    );

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");

    act(() => result.current.onSelectionChange("provider-a:item"));
    expect(result.current.selectedItemId).toBe("provider-a:item");

    rerender({ itemIds: ["provider-c:item", "provider-a:item", "provider-b:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });

  it("returns to the first item when the manual selection disappears", () => {
    const { result, rerender } = renderHook(
      ({ itemIds, queryGeneration }) => useFirstItemAnchor(itemIds, queryGeneration),
      { initialProps: { itemIds: ["provider-a:item", "provider-b:item"], queryGeneration: 1 } },
    );

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");

    rerender({ itemIds: ["provider-c:item", "provider-a:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-c:item");

    rerender({ itemIds: ["provider-d:item", "provider-c:item", "provider-a:item"], queryGeneration: 1 });
    expect(result.current.selectedItemId).toBe("provider-d:item");
  });

  it("resets to automatic selection for a new query generation", () => {
    const { result, rerender } = renderHook(
      ({ itemIds, queryGeneration }) => useFirstItemAnchor(itemIds, queryGeneration),
      { initialProps: { itemIds: ["query:old:first", "query:old:second"], queryGeneration: 1 } },
    );

    act(() => result.current.onSelectionChange("query:old:second"));
    expect(result.current.selectedItemId).toBe("query:old:second");

    rerender({ itemIds: [], queryGeneration: 2 });
    expect(result.current.selectedItemId).toBeUndefined();

    rerender({ itemIds: ["query:new:first"], queryGeneration: 2 });
    expect(result.current.selectedItemId).toBe("query:new:first");

    rerender({ itemIds: ["query:new:leading", "query:new:first"], queryGeneration: 2 });
    expect(result.current.selectedItemId).toBe("query:new:leading");
  });

  it("falls back to the current first item for null or invalid selections", () => {
    const { result } = renderHook(() => useFirstItemAnchor(["provider-a:item", "provider-b:item"], 1));

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");

    act(() => result.current.onSelectionChange(null));
    expect(result.current.selectedItemId).toBe("provider-a:item");

    act(() => result.current.onSelectionChange("missing:item"));
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });
});
