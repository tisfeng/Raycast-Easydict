// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFirstItemAnchor } from "./useFirstItemAnchor";

// These tests cover the props and lifecycle state sent to List. Raycast's
// native list reconciliation still requires verification inside the app.
describe("useFirstItemAnchor", () => {
  it("follows the first result while providers insert results in priority order", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: {
        itemIds: ["provider-c:item"],
        isLoading: true,
      },
    });

    expect(result.current).toBe("provider-c:item");

    rerender({
      itemIds: ["provider-b:item", "provider-c:item"],
      isLoading: true,
    });
    expect(result.current).toBe("provider-b:item");

    rerender({
      itemIds: ["provider-a:item", "provider-b:item", "provider-c:item"],
      isLoading: true,
    });
    expect(result.current).toBe("provider-a:item");
  });

  it("drops the old selection when a query clears and anchors the next query's first result", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: {
        itemIds: ["old-query:first", "old-query:second"],
        isLoading: true,
      },
    });

    expect(result.current).toBe("old-query:first");

    rerender({ itemIds: [], isLoading: false });
    expect(result.current).toBeUndefined();

    rerender({ itemIds: [], isLoading: true });
    expect(result.current).toBeUndefined();

    rerender({ itemIds: ["new-query:first"], isLoading: true });
    expect(result.current).toBe("new-query:first");

    rerender({
      itemIds: ["new-query:preferred", "new-query:first"],
      isLoading: true,
    });
    expect(result.current).toBe("new-query:preferred");
  });

  it("releases controlled selection after the result order settles", () => {
    const { result, rerender } = renderHook(({ itemIds, isLoading }) => useFirstItemAnchor(itemIds, isLoading), {
      initialProps: {
        itemIds: ["provider-a:item", "provider-b:item"],
        isLoading: true,
      },
    });

    expect(result.current).toBe("provider-a:item");

    rerender({
      itemIds: ["provider-a:item", "provider-b:item"],
      isLoading: false,
    });
    expect(result.current).toBeUndefined();
  });
});
