import { describe, it, expect } from "vitest";
import {
  deriveProviderStatus,
  formatResetCountdown,
  normalizeAntigravityResponse,
  normalizeCodexResponse,
} from "./normalizers";

describe("deriveProviderStatus", () => {
  it("returns 'ok' when quota usage is under warning threshold", () => {
    expect(deriveProviderStatus(45)).toBe("ok");
    expect(deriveProviderStatus(0)).toBe("ok");
    expect(deriveProviderStatus(79)).toBe("ok");
  });

  it("returns 'warning' when quota usage is between 80% and 99%", () => {
    expect(deriveProviderStatus(80)).toBe("warning");
    expect(deriveProviderStatus(95)).toBe("warning");
  });

  it("returns 'exhausted' when quota usage reaches or exceeds 100%", () => {
    expect(deriveProviderStatus(100)).toBe("exhausted");
    expect(deriveProviderStatus(120)).toBe("exhausted");
  });

  it("returns 'unauthenticated' on auth failure", () => {
    expect(deriveProviderStatus(0, { isAuthError: true })).toBe("unauthenticated");
  });

  it("returns 'error' on general failures", () => {
    expect(deriveProviderStatus(0, { isNetworkError: true })).toBe("error");
  });
});

describe("formatResetCountdown", () => {
  const now = 1770000000000; // Reference timestamp in ms

  it("returns 'Ready' or 'Now' when reset time is null or in the past", () => {
    expect(formatResetCountdown(null, now)).toBe("Ready");
    expect(formatResetCountdown(undefined, now)).toBe("Ready");
    expect(formatResetCountdown(now - 5000, now)).toBe("Ready");
  });

  it("formats countdown in minutes and seconds when under an hour", () => {
    const target = now + 25 * 60 * 1000 + 30 * 1000; // 25m 30s
    expect(formatResetCountdown(target, now)).toBe("25m");
  });

  it("formats countdown in hours and minutes when over an hour", () => {
    const target = now + (3 * 3600 + 45 * 60) * 1000; // 3h 45m
    expect(formatResetCountdown(target, now)).toBe("3h 45m");
  });

  it("formats countdown in days and hours when over 24 hours", () => {
    const target = now + (2 * 86400 + 5 * 3600) * 1000; // 2d 5h
    expect(formatResetCountdown(target, now)).toBe("2d 5h");
  });

  it("formats countdown in seconds when remaining duration is under one minute", () => {
    expect(formatResetCountdown(now + 45 * 1000, now)).toBe("45s");
    expect(formatResetCountdown(now + 1 * 1000, now)).toBe("1s");
  });

  it("parses ISO date strings correctly", () => {
    const isoDate = new Date(now + 3600 * 1000 * 2).toISOString();
    expect(formatResetCountdown(isoDate, now)).toBe("2h 0m");
  });

  it("handles epoch seconds as well as epoch milliseconds", () => {
    const targetSeconds = Math.floor(now / 1000) + 1800; // 30m
    expect(formatResetCountdown(targetSeconds, now)).toBe("30m");
  });

  it("formats duration with hours and minutes according to acceptance criteria (e.g. 2h 15m)", () => {
    const target = now + (2 * 3600 + 15 * 60) * 1000;
    expect(formatResetCountdown(target, now)).toBe("2h 15m");
  });
});

describe("normalizeAntigravityResponse", () => {
  const now = 1770000000000;

  it("normalizes standard Connect-RPC quota summary with session and model limits", () => {
    const rawData = {
      userTier: "PRO",
      sessionQuota: {
        usedTokens: 12000,
        maxTokens: 20000,
        resetTimestamp: now + 7200 * 1000,
      },
      modelQuotas: [
        {
          modelFamily: "claude-sonnet",
          usedPercent: 85,
          resetTimestamp: now + 14400 * 1000,
        },
      ],
    };

    const snapshot = normalizeAntigravityResponse(rawData, now);

    expect(snapshot).toEqual({
      provider: "antigravity",
      sessionUsedPercent: 60,
      sessionResetTime: now + 7200 * 1000,
      modelUsedPercent: 85,
      modelResetTime: now + 14400 * 1000,
      status: "warning",
      planType: "PRO",
      errorMessage: null,
      updatedAt: now,
    });
  });

  it("handles empty or errored payload gracefully", () => {
    const snapshot = normalizeAntigravityResponse(null, now);
    expect(snapshot.provider).toBe("antigravity");
    expect(snapshot.status).toBe("error");
    expect(snapshot.sessionUsedPercent).toBe(0);
  });
});

describe("normalizeCodexResponse", () => {
  const now = 1770000000000;

  it("normalizes ChatGPT backend-api wham/usage payload", () => {
    const rawData = {
      plan_type: "plus",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 24,
          limit_window_seconds: 18000,
          reset_after_seconds: 7320,
          reset_at: Math.floor((now + 7320 * 1000) / 1000),
        },
        secondary_window: {
          used_percent: 40,
          limit_window_seconds: 604800,
          reset_after_seconds: 541200,
          reset_at: Math.floor((now + 541200 * 1000) / 1000),
        },
      },
    };

    const snapshot = normalizeCodexResponse(rawData, now);

    expect(snapshot).toEqual({
      provider: "codex",
      sessionUsedPercent: 24,
      sessionResetTime: Math.floor((now + 7320 * 1000) / 1000) * 1000,
      modelUsedPercent: 40,
      modelResetTime: Math.floor((now + 541200 * 1000) / 1000) * 1000,
      status: "ok",
      planType: "plus",
      errorMessage: null,
      updatedAt: now,
    });
  });

  it("detects exhausted rate limit state", () => {
    const rawData = {
      plan_type: "team",
      rate_limit: {
        allowed: false,
        limit_reached: true,
        primary_window: {
          used_percent: 100,
          reset_at: Math.floor((now + 1800 * 1000) / 1000),
        },
      },
    };

    const snapshot = normalizeCodexResponse(rawData, now);
    expect(snapshot.status).toBe("exhausted");
    expect(snapshot.sessionUsedPercent).toBe(100);
  });
});
