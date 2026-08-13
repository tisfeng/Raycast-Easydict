// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFirstItemAnchor } from "./useFirstItemAnchor";

describe("useFirstItemAnchor", () => {
  it("follows the first result as providers insert higher-priority items while loading", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: { itemIds: ["provider-c:item"], isLoading: true },
    });

    expect(result.current.selectedItemId).toBe("provider-c:item");

    rerender({ itemIds: ["provider-b:item", "provider-c:item"], isLoading: true });
    expect(result.current.selectedItemId).toBe("provider-b:item");

    rerender({ itemIds: ["provider-a:item", "provider-b:item", "provider-c:item"], isLoading: true });
    expect(result.current.selectedItemId).toBe("provider-a:item");

    rerender({
      itemIds: ["provider-a:item", "provider-b:item", "provider-c:item", "provider-d:item"],
      isLoading: true,
    });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });

  it("keeps the first item controlled after loading finishes", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: { itemIds: ["provider-a:item", "provider-b:item"], isLoading: true },
    });

    rerender({ itemIds: ["provider-a:item", "provider-b:item"], isLoading: false });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });

  it("keeps the final first result when results and loading completion arrive together", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: { itemIds: ["provider-c:item"], isLoading: true },
    });

    rerender({ itemIds: ["provider-a:item", "provider-c:item"], isLoading: false });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });

  it("allows the user to move the controlled selection after loading", () => {
    const { result } = renderHook(() => useFirstItemAnchor(["provider-a:item", "provider-b:item"], false));

    expect(result.current.selectedItemId).toBe("provider-a:item");

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");
  });

  it("returns to the new generation's first item after a query is cleared", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: { itemIds: ["query:old:first", "query:old:second"], isLoading: false },
    });

    act(() => result.current.onSelectionChange("query:old:second"));
    expect(result.current.selectedItemId).toBe("query:old:second");

    rerender({ itemIds: [], isLoading: false });
    expect(result.current.selectedItemId).toBeUndefined();

    rerender({ itemIds: ["query:new:first"], isLoading: true });
    expect(result.current.selectedItemId).toBe("query:new:first");
  });

  it("returns to the first item when the selected item disappears", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: { itemIds: ["provider-a:item", "provider-b:item"], isLoading: false },
    });

    act(() => result.current.onSelectionChange("provider-b:item"));
    expect(result.current.selectedItemId).toBe("provider-b:item");

    rerender({ itemIds: ["provider-a:item", "provider-c:item"], isLoading: false });
    expect(result.current.selectedItemId).toBe("provider-a:item");
  });
});
