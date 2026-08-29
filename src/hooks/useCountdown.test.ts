import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountdownInterpolation, useProviderCountdown } from "./useCountdown";
import { UsageSnapshot } from "../types";

describe("useCountdownInterpolation Hook", () => {
  const baseNow = 1725000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks every 1000ms and formats remaining duration smoothly without network calls", () => {
    const onVerificationPoll = vi.fn();
    const snapshots: Record<string, UsageSnapshot> = {
      antigravity: {
        provider: "antigravity",
        sessionUsedPercent: 60,
        sessionResetTime: baseNow + 45 * 1000, // 45s
        modelUsedPercent: 40,
        modelResetTime: baseNow + (2 * 3600 + 15 * 60) * 1000, // 2h 15m
        status: "ok",
      },
    };

    const { result } = renderHook(() =>
      useCountdownInterpolation({
        snapshots,
        onVerificationPoll,
      })
    );

    // Initial render
    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("45s");
    expect(result.current.countdowns.antigravity.modelResetFormatted).toBe("2h 15m");
    expect(onVerificationPoll).not.toHaveBeenCalled();

    // Advance 1 second (1000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("44s");
    expect(onVerificationPoll).not.toHaveBeenCalled();

    // Advance 10 more seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("34s");
    expect(onVerificationPoll).not.toHaveBeenCalled();
  });

  it("triggers an immediate verification poll as soon as countdown reaches zero", () => {
    const onVerificationPoll = vi.fn();
    const snapshots: Record<string, UsageSnapshot> = {
      antigravity: {
        provider: "antigravity",
        sessionUsedPercent: 85,
        sessionResetTime: baseNow + 3000, // 3s
        status: "warning",
      },
    };

    const { result } = renderHook(() =>
      useCountdownInterpolation({
        snapshots,
        onVerificationPoll,
      })
    );

    // Advance 2s (1s remaining)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("1s");
    expect(onVerificationPoll).not.toHaveBeenCalled();

    // Advance 1s (reaches 0 / Ready)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("Ready");
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
    expect(onVerificationPoll).toHaveBeenCalledWith("antigravity");
  });

  it("schedules a single retry 15 seconds after zero-expiry if quota is still exhausted", () => {
    const onVerificationPoll = vi.fn();
    const snapshots: Record<string, UsageSnapshot> = {
      codex: {
        provider: "codex",
        sessionUsedPercent: 100,
        sessionResetTime: baseNow + 2000, // 2s
        status: "exhausted",
      },
    };

    const { result } = renderHook(() =>
      useCountdownInterpolation({
        snapshots,
        onVerificationPoll,
      })
    );

    // Advance 2s to hit zero
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verification poll immediately triggered
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
    expect(onVerificationPoll).toHaveBeenCalledWith("codex");
    expect(result.current.countdowns.codex.isGraceRetrying).toBe(true);

    // Advance 14s (grace window is 15s)
    act(() => {
      vi.advanceTimersByTime(14000);
    });

    // Still only 1 call
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);

    // Advance 1s (total 15s grace window elapses)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second call: single grace retry
    expect(onVerificationPoll).toHaveBeenCalledTimes(2);
    expect(result.current.countdowns.codex.isGraceRetrying).toBe(false);

    // Advance further 30s: no more automatic retries (falls back to normal cadence)
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(onVerificationPoll).toHaveBeenCalledTimes(2);
  });

  it("cancels grace retry if quota replenishes before the 15-second grace window expires", () => {
    const onVerificationPoll = vi.fn();
    let currentSnapshots: Record<string, UsageSnapshot> = {
      codex: {
        provider: "codex",
        sessionUsedPercent: 100,
        sessionResetTime: baseNow + 2000,
        status: "exhausted",
      },
    };

    const { result, rerender } = renderHook(
      ({ snaps }) =>
        useCountdownInterpolation({
          snapshots: snaps,
          onVerificationPoll,
        }),
      {
        initialProps: { snaps: currentSnapshots },
      }
    );

    // Advance 2s to trigger zero verification
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
    expect(result.current.countdowns.codex.isGraceRetrying).toBe(true);

    // Advance 5s into grace window
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Quota replenished from background poll or user action
    currentSnapshots = {
      codex: {
        provider: "codex",
        sessionUsedPercent: 20,
        sessionResetTime: baseNow + 3600 * 1000, // new 1h reset
        status: "ok",
      },
    };

    rerender({ snaps: currentSnapshots });

    expect(result.current.countdowns.codex.isGraceRetrying).toBe(false);

    // Advance remaining 10s of grace window
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Verification poll not fired again
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
  });

  it("tracks countdowns for multiple providers independently", () => {
    const onVerificationPoll = vi.fn();
    const snapshots: Record<string, UsageSnapshot> = {
      antigravity: {
        provider: "antigravity",
        sessionUsedPercent: 50,
        sessionResetTime: baseNow + 4000, // 4s
        status: "ok",
      },
      codex: {
        provider: "codex",
        sessionUsedPercent: 90,
        sessionResetTime: baseNow + 8000, // 8s
        status: "warning",
      },
    };

    const { result } = renderHook(() =>
      useCountdownInterpolation({
        snapshots,
        onVerificationPoll,
      })
    );

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("4s");
    expect(result.current.countdowns.codex.sessionResetFormatted).toBe("8s");

    // Advance 4s -> antigravity expires, codex has 4s left
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.countdowns.antigravity.sessionResetFormatted).toBe("Ready");
    expect(result.current.countdowns.codex.sessionResetFormatted).toBe("4s");
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
    expect(onVerificationPoll).toHaveBeenCalledWith("antigravity");

    // Advance 4 more seconds -> codex expires
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.countdowns.codex.sessionResetFormatted).toBe("Ready");
    expect(onVerificationPoll).toHaveBeenCalledTimes(2);
    expect(onVerificationPoll).toHaveBeenLastCalledWith("codex");
  });

  it("cleans up intervals and pending grace retry timers on unmount", () => {
    const onVerificationPoll = vi.fn();
    const snapshots: Record<string, UsageSnapshot> = {
      codex: {
        provider: "codex",
        sessionUsedPercent: 100,
        sessionResetTime: baseNow + 1000,
        status: "exhausted",
      },
    };

    const { unmount } = renderHook(() =>
      useCountdownInterpolation({
        snapshots,
        onVerificationPoll,
      })
    );

    // Trigger zero expiry
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onVerificationPoll).toHaveBeenCalledTimes(1);

    // Unmount before 15s grace retry
    unmount();

    // Advance past grace window
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // Should not trigger on unmounted component
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
  });

  it("works with useProviderCountdown for a single snapshot", () => {
    const onVerificationPoll = vi.fn();
    const snapshot: UsageSnapshot = {
      provider: "antigravity",
      sessionUsedPercent: 70,
      sessionResetTime: baseNow + 15000, // 15s
      status: "ok",
    };

    const { result } = renderHook(() =>
      useProviderCountdown({
        snapshot,
        onVerificationPoll,
      })
    );

    expect(result.current.countdown?.sessionResetFormatted).toBe("15s");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.countdown?.sessionResetFormatted).toBe("10s");
    expect(onVerificationPoll).not.toHaveBeenCalled();
  });
});
