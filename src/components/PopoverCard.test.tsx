import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PopoverCard } from "./PopoverCard";
import { UsageSnapshot } from "../types";

describe("PopoverCard Component Countdown", () => {
  const baseNow = 1725000000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders live interpolated countdown and decrements smoothly every 1000ms", () => {
    const snapshot: UsageSnapshot = {
      provider: "antigravity",
      sessionUsedPercent: 60,
      sessionResetTime: baseNow + 45 * 1000, // 45s
      status: "ok",
      planType: "Pro",
    };

    render(<PopoverCard snapshot={snapshot} />);

    expect(screen.getByText("45s")).toBeInTheDocument();

    // Advance 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("44s")).toBeInTheDocument();

    // Advance 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("39s")).toBeInTheDocument();
  });

  it("fires onVerificationPoll when popover countdown reaches zero", () => {
    const onVerificationPoll = vi.fn();
    const snapshot: UsageSnapshot = {
      provider: "codex",
      sessionUsedPercent: 90,
      sessionResetTime: baseNow + 2000, // 2s
      status: "warning",
      planType: "Plus",
    };

    render(
      <PopoverCard
        snapshot={snapshot}
        onVerificationPoll={onVerificationPoll}
      />
    );

    expect(screen.getByText("2s")).toBeInTheDocument();
    expect(onVerificationPoll).not.toHaveBeenCalled();

    // Advance 2s to zero
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(onVerificationPoll).toHaveBeenCalledTimes(1);
    expect(onVerificationPoll).toHaveBeenCalledWith("codex");
  });
});
