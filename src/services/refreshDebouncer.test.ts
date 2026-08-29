import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OnDemandRefreshDebouncer } from "./refreshDebouncer";

describe("OnDemandRefreshDebouncer", () => {
  let onRefresh: (providerId: string) => Promise<void> | void;
  let debouncer: OnDemandRefreshDebouncer;

  beforeEach(() => {
    vi.useFakeTimers();
    onRefresh = vi.fn().mockResolvedValue(undefined);
    debouncer = new OnDemandRefreshDebouncer({
      onRefresh,
      debounceWindowMs: 5000,
    });
  });

  afterEach(() => {
    debouncer.cancelAll();
    vi.restoreAllMocks();
  });

  it("immediately triggers refresh on first hover/click (leading edge)", async () => {
    await debouncer.trigger("antigravity");

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledWith("antigravity");
  });

  it("debounces rapid consecutive hovers within the 5-second window", async () => {
    // First trigger at t = 0 -> executes immediately
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Hover again at t = 1000ms -> should NOT execute immediately
    await vi.advanceTimersByTimeAsync(1000);
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Hover again at t = 2000ms -> should NOT execute immediately
    await vi.advanceTimersByTimeAsync(1000);
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Advance to t = 4999ms -> still hasn't fired trailing
    await vi.advanceTimersByTimeAsync(2999);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Advance to t = 5000ms -> trailing debounced refresh fires exactly once
    await vi.advanceTimersByTimeAsync(1);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("does not fire trailing refresh if no calls occurred within the window", async () => {
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Advance past 5s with no other triggers
    await vi.advanceTimersByTimeAsync(6000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("immediately fires again when triggered after the 5-second window expires", async () => {
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Advance 6 seconds
    await vi.advanceTimersByTimeAsync(6000);

    // Next trigger -> immediate leading edge execution
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("tracks debouncing per provider independently", async () => {
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenLastCalledWith("antigravity");

    // Triggering codex at t=100ms should execute immediately for codex
    await vi.advanceTimersByTimeAsync(100);
    await debouncer.trigger("codex");
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenLastCalledWith("codex");

    // Re-triggering antigravity at t=200ms is debounced
    await vi.advanceTimersByTimeAsync(100);
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(2);

    // Advance to 5000ms (window for antigravity expires)
    await vi.advanceTimersByTimeAsync(4800);
    expect(onRefresh).toHaveBeenCalledTimes(3);
    expect(onRefresh).toHaveBeenLastCalledWith("antigravity");
  });

  it("cancels scheduled debounced executions when cancel is called", async () => {
    await debouncer.trigger("antigravity");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Trigger second call inside window
    await vi.advanceTimersByTimeAsync(1000);
    await debouncer.trigger("antigravity");

    // Cancel pending
    debouncer.cancel("antigravity");

    // Advance past 5s -> trailing does not execute
    await vi.advanceTimersByTimeAsync(5000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
