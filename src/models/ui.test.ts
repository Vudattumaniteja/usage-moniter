import { describe, it, expect } from "vitest";
import { UsageSnapshot } from "../types";
import { snapshotToUsageRing, snapshotToPopoverCard } from "./ui";

describe("snapshotToUsageRing", () => {
  it("converts healthy Antigravity snapshot to ring view model", () => {
    const snapshot: UsageSnapshot = {
      provider: "antigravity",
      sessionUsedPercent: 42,
      sessionResetTime: Date.now() + 3600000,
      modelUsedPercent: 60,
      modelResetTime: Date.now() + 7200000,
      status: "ok",
      planType: "PRO",
    };

    const ring = snapshotToUsageRing(snapshot);

    expect(ring.provider).toBe("antigravity");
    expect(ring.label).toBe("Antigravity");
    expect(ring.sessionUsedPercent).toBe(42);
    expect(ring.modelUsedPercent).toBe(60);
    expect(ring.status).toBe("ok");
    expect(ring.accentColor).toBeDefined();
  });

  it("clamps out-of-range percentages between 0 and 100", () => {
    const snapshot: UsageSnapshot = {
      provider: "codex",
      sessionUsedPercent: 125,
      sessionResetTime: null,
      modelUsedPercent: -10,
      status: "exhausted",
    };

    const ring = snapshotToUsageRing(snapshot);
    expect(ring.sessionUsedPercent).toBe(100);
    expect(ring.modelUsedPercent).toBe(0);
  });
});

describe("snapshotToPopoverCard", () => {
  const now = 1770000000000;

  it("formats countdowns and title for popover display", () => {
    const snapshot: UsageSnapshot = {
      provider: "antigravity",
      sessionUsedPercent: 75,
      sessionResetTime: now + 3600 * 1000 * 2,
      modelUsedPercent: 90,
      modelResetTime: now + 86400 * 1000 * 3,
      status: "warning",
      planType: "Google AI Ultra",
    };

    const card = snapshotToPopoverCard(snapshot, now);

    expect(card.provider).toBe("antigravity");
    expect(card.title).toBe("Antigravity");
    expect(card.sessionUsedPercent).toBe(75);
    expect(card.sessionResetFormatted).toBe("2h 0m");
    expect(card.modelUsedPercent).toBe(90);
    expect(card.modelResetFormatted).toBe("3d 0h");
    expect(card.status).toBe("warning");
    expect(card.planType).toBe("Google AI Ultra");
    expect(card.statusMessage).toContain("Approaching limit");
  });

  it("generates clear message for exhausted quota", () => {
    const snapshot: UsageSnapshot = {
      provider: "codex",
      sessionUsedPercent: 100,
      sessionResetTime: now + 1800 * 1000,
      status: "exhausted",
      planType: "ChatGPT Plus",
    };

    const card = snapshotToPopoverCard(snapshot, now);
    expect(card.status).toBe("exhausted");
    expect(card.statusMessage).toContain("Quota exhausted");
    expect(card.sessionResetFormatted).toBe("30m");
  });
});
