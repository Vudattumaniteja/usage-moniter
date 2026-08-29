import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnDemandRefresh } from "./useOnDemandRefresh";

describe("useOnDemandRefresh hook", () => {
  let onRefresh: (providerId: string) => Promise<void> | void;

  beforeEach(() => {
    vi.useFakeTimers();
    onRefresh = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns handleHoverOrClick trigger function that runs immediate refresh on first call", async () => {
    const { result } = renderHook(() =>
      useOnDemandRefresh({ onRefresh, debounceWindowMs: 5000 })
    );

    await act(async () => {
      await result.current.triggerOnDemandRefresh("antigravity");
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledWith("antigravity");
  });

  it("debounces rapid hover triggers over 5 seconds", async () => {
    const { result } = renderHook(() =>
      useOnDemandRefresh({ onRefresh, debounceWindowMs: 5000 })
    );

    await act(async () => {
      await result.current.triggerOnDemandRefresh("antigravity");
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Hover again after 1s
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await result.current.triggerOnDemandRefresh("antigravity");
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Fast-forward remainder of 5s window
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
