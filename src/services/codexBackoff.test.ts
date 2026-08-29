import { describe, it, expect, beforeEach } from "vitest";
import {
  CodexBackoffManager,
  calculateBackoffDelay,
  CODEX_BACKOFF_STEPS_MS,
  MAX_BACKOFF_MS,
} from "./codexBackoff";

describe("CodexBackoffManager", () => {
  let backoff: CodexBackoffManager;

  beforeEach(() => {
    backoff = new CodexBackoffManager();
  });

  it("calculates exponential backoff delays (30s -> 60s -> 120s -> 300s max)", () => {
    expect(CODEX_BACKOFF_STEPS_MS).toEqual([30_000, 60_000, 120_000, 300_000]);
    expect(MAX_BACKOFF_MS).toBe(300_000);

    expect(backoff.nextDelay()).toBe(30_000); // Attempt 1 (index 0)
    expect(backoff.nextDelay()).toBe(60_000); // Attempt 2 (index 1)
    expect(backoff.nextDelay()).toBe(120_000); // Attempt 3 (index 2)
    expect(backoff.nextDelay()).toBe(300_000); // Attempt 4 (index 3)
    expect(backoff.nextDelay()).toBe(300_000); // Attempt 5 (capped at max 300s)
    expect(backoff.nextDelay()).toBe(300_000); // Attempt 6 (capped at max 300s)
  });

  it("respects Retry-After numeric seconds from headers", () => {
    expect(backoff.nextDelay(45)).toBe(45_000);
    expect(backoff.nextDelay("90")).toBe(90_000);
    expect(backoff.nextDelay("15.5")).toBe(15_500);
  });

  it("falls back to exponential step when Retry-After is invalid, negative, or zero", () => {
    expect(backoff.nextDelay("invalid-header")).toBe(30_000);
    expect(backoff.nextDelay(-5)).toBe(60_000);
    expect(backoff.nextDelay(0)).toBe(120_000);
  });

  it("resets backoff attempt counter upon successful request", () => {
    expect(backoff.nextDelay()).toBe(30_000);
    expect(backoff.nextDelay()).toBe(60_000);
    expect(backoff.getAttemptCount()).toBe(2);

    backoff.reset();
    expect(backoff.getAttemptCount()).toBe(0);
    expect(backoff.nextDelay()).toBe(30_000);
  });

  describe("calculateBackoffDelay helper", () => {
    it("returns correct delay for given attempt index", () => {
      expect(calculateBackoffDelay(0)).toBe(30_000);
      expect(calculateBackoffDelay(1)).toBe(60_000);
      expect(calculateBackoffDelay(2)).toBe(120_000);
      expect(calculateBackoffDelay(3)).toBe(300_000);
      expect(calculateBackoffDelay(10)).toBe(300_000);
    });

    it("parses Retry-After header correctly", () => {
      expect(calculateBackoffDelay(0, "60")).toBe(60_000);
      expect(calculateBackoffDelay(2, 75)).toBe(75_000);
    });
  });
});
