import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isSnapshotStale,
  validateUsageSnapshot,
  validateCachePayload,
  deriveSnapshotSyncState,
  STALE_THRESHOLD_MS,
  CachePayload,
  SnapshotCacheService,
  MemoryStorageAdapter,
  resolveDefaultCachePath,
} from "./cache";
import { UsageSnapshot } from "../types";

describe("Snapshot Cache Validation and Stale Detection", () => {
  const baseNow = 1725000000000; // Fixed epoch ms

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isSnapshotStale", () => {
    it("flags snapshots older than 15 minutes (900,000ms) as stale", () => {
      const sixteenMinutesAgo = baseNow - 16 * 60 * 1000;
      const snapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 45,
        sessionResetTime: baseNow + 3600000,
        status: "ok",
        updatedAt: sixteenMinutesAgo,
      };

      expect(isSnapshotStale(snapshot, baseNow)).toBe(true);
    });

    it("identifies snapshots within 15 minutes as fresh", () => {
      const fiveMinutesAgo = baseNow - 5 * 60 * 1000;
      const snapshot: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: 70,
        sessionResetTime: baseNow + 1800000,
        status: "ok",
        updatedAt: fiveMinutesAgo,
      };

      expect(isSnapshotStale(snapshot, baseNow)).toBe(false);
    });

    it("treats exactly 15 minutes boundary as fresh", () => {
      const exactlyFifteenMinutesAgo = baseNow - STALE_THRESHOLD_MS;
      const snapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 50,
        sessionResetTime: null,
        status: "ok",
        updatedAt: exactlyFifteenMinutesAgo,
      };

      expect(isSnapshotStale(snapshot, baseNow)).toBe(false);
    });

    it("flags snapshots with missing or invalid updatedAt as stale", () => {
      const noTimestamp: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: 10,
        sessionResetTime: null,
        status: "ok",
      };

      expect(isSnapshotStale(noTimestamp, baseNow)).toBe(true);
    });

    it("supports custom threshold override", () => {
      const twoMinutesAgo = baseNow - 2 * 60 * 1000;
      const snapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 30,
        sessionResetTime: null,
        status: "ok",
        updatedAt: twoMinutesAgo,
      };

      // With a 1-minute threshold, 2 minutes is stale
      expect(isSnapshotStale(snapshot, baseNow, 60 * 1000)).toBe(true);
    });
  });

  describe("validateUsageSnapshot", () => {
    it("accepts valid normalized snapshot", () => {
      const validSnapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 42,
        sessionResetTime: baseNow + 5000,
        modelUsedPercent: 18,
        modelResetTime: null,
        status: "ok",
        updatedAt: baseNow,
        planType: "Pro",
      };

      expect(validateUsageSnapshot(validSnapshot)).toBe(true);
    });

    it("rejects null or non-object values", () => {
      expect(validateUsageSnapshot(null)).toBe(false);
      expect(validateUsageSnapshot(undefined)).toBe(false);
      expect(validateUsageSnapshot("string")).toBe(false);
      expect(validateUsageSnapshot(123)).toBe(false);
    });

    it("rejects snapshot with missing or invalid provider", () => {
      expect(
        validateUsageSnapshot({
          sessionUsedPercent: 50,
          status: "ok",
        })
      ).toBe(false);
      expect(
        validateUsageSnapshot({
          provider: "",
          sessionUsedPercent: 50,
          status: "ok",
        })
      ).toBe(false);
    });

    it("rejects snapshot with negative or non-number sessionUsedPercent", () => {
      expect(
        validateUsageSnapshot({
          provider: "codex",
          sessionUsedPercent: -5,
          status: "ok",
        })
      ).toBe(false);
      expect(
        validateUsageSnapshot({
          provider: "codex",
          sessionUsedPercent: "50",
          status: "ok",
        })
      ).toBe(false);
    });

    it("rejects snapshot with invalid status string", () => {
      expect(
        validateUsageSnapshot({
          provider: "codex",
          sessionUsedPercent: 50,
          status: "unknown_status",
        })
      ).toBe(false);
    });
  });

  describe("validateCachePayload", () => {
    it("validates full CachePayload structure", () => {
      const payload: CachePayload = {
        version: 1,
        savedAt: baseNow,
        snapshots: {
          antigravity: {
            provider: "antigravity",
            sessionUsedPercent: 20,
            sessionResetTime: null,
            status: "ok",
            updatedAt: baseNow,
          },
          codex: {
            provider: "codex",
            sessionUsedPercent: 85,
            sessionResetTime: null,
            status: "warning",
            updatedAt: baseNow,
          },
        },
      };

      const result = validateCachePayload(payload);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.snapshots.antigravity.sessionUsedPercent).toBe(20);
      expect(result?.snapshots.codex.sessionUsedPercent).toBe(85);
    });

    it("supports parsing JSON string input", () => {
      const json = JSON.stringify({
        version: 1,
        savedAt: baseNow,
        snapshots: {
          antigravity: {
            provider: "antigravity",
            sessionUsedPercent: 55,
            sessionResetTime: null,
            status: "ok",
            updatedAt: baseNow,
          },
        },
      });

      const result = validateCachePayload(json);
      expect(result).not.toBeNull();
      expect(result?.snapshots.antigravity.sessionUsedPercent).toBe(55);
    });

    it("handles legacy direct dictionary of snapshots gracefully", () => {
      const flatMap = {
        antigravity: {
          provider: "antigravity",
          sessionUsedPercent: 40,
          sessionResetTime: null,
          status: "ok",
          updatedAt: baseNow - 1000,
        },
      };

      const result = validateCachePayload(flatMap);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.snapshots.antigravity.sessionUsedPercent).toBe(40);
    });

    it("rejects corrupt or invalid JSON", () => {
      expect(validateCachePayload("{ broken json")).toBeNull();
      expect(validateCachePayload(null)).toBeNull();
      expect(validateCachePayload({})).toBeNull();
      expect(
        validateCachePayload({
          version: 1,
          savedAt: baseNow,
          snapshots: {
            invalid: { provider: "invalid", sessionUsedPercent: "bad" },
          },
        })
      ).toBeNull();
    });
  });

  describe("deriveSnapshotSyncState", () => {
    it("returns isStale=false and isSyncing=true for fresh cache before first live poll", () => {
      const freshSnapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 30,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow - 5 * 60 * 1000,
      };

      const state = deriveSnapshotSyncState(freshSnapshot, false, baseNow);
      expect(state.isStale).toBe(false);
      expect(state.isSyncing).toBe(true);
    });

    it("returns isStale=true and isSyncing=false for stale cache before first live poll", () => {
      const staleSnapshot: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: 50,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow - 20 * 60 * 1000,
      };

      const state = deriveSnapshotSyncState(staleSnapshot, false, baseNow);
      expect(state.isStale).toBe(true);
      expect(state.isSyncing).toBe(false);
    });

    it("returns isStale=false and isSyncing=false once live poll completes", () => {
      const snapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 30,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow - 30 * 60 * 1000,
      };

      const state = deriveSnapshotSyncState(snapshot, true, baseNow);
      expect(state.isStale).toBe(false);
      expect(state.isSyncing).toBe(false);
    });
  });

  describe("resolveDefaultCachePath", () => {
    it("formats Windows LOCALAPPDATA path correctly", () => {
      const path = resolveDefaultCachePath({ LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" });
      expect(path).toBe("C:\\Users\\Test\\AppData\\Local\\usage-monitor\\cache.json");
    });

    it("falls back to standard path if LOCALAPPDATA is undefined", () => {
      const path = resolveDefaultCachePath({});
      expect(path).toContain("usage-monitor");
      expect(path).toContain("cache.json");
    });
  });

  describe("SnapshotCacheService", () => {
    let memoryStorage: MemoryStorageAdapter;
    let cacheService: SnapshotCacheService;

    beforeEach(() => {
      memoryStorage = new MemoryStorageAdapter();
      cacheService = new SnapshotCacheService(memoryStorage);
    });

    it("saves snapshots to disk storage and reads them back intact", async () => {
      const snapshots: Record<string, UsageSnapshot> = {
        antigravity: {
          provider: "antigravity",
          sessionUsedPercent: 25,
          sessionResetTime: baseNow + 10000,
          status: "ok",
          updatedAt: baseNow,
        },
        codex: {
          provider: "codex",
          sessionUsedPercent: 88,
          sessionResetTime: baseNow + 5000,
          status: "warning",
          updatedAt: baseNow,
        },
      };

      await cacheService.saveSnapshots(snapshots);

      const loaded = await cacheService.loadSnapshots();
      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe(1);
      expect(loaded?.savedAt).toBe(baseNow);
      expect(loaded?.snapshots.antigravity.sessionUsedPercent).toBe(25);
      expect(loaded?.snapshots.codex.sessionUsedPercent).toBe(88);
    });

    it("returns null when cache storage has no saved file", async () => {
      const loaded = await cacheService.loadSnapshots();
      expect(loaded).toBeNull();
    });

    it("returns null when cache storage has corrupt JSON", async () => {
      await memoryStorage.save("default", "corrupted { json data");
      const loaded = await cacheService.loadSnapshots();
      expect(loaded).toBeNull();
    });

    it("updates single provider snapshot while preserving existing cached providers", async () => {
      const initial: Record<string, UsageSnapshot> = {
        antigravity: {
          provider: "antigravity",
          sessionUsedPercent: 10,
          sessionResetTime: null,
          status: "ok",
          updatedAt: baseNow - 60000,
        },
        codex: {
          provider: "codex",
          sessionUsedPercent: 50,
          sessionResetTime: null,
          status: "ok",
          updatedAt: baseNow - 60000,
        },
      };

      await cacheService.saveSnapshots(initial);

      // Now antigravity updates on successful poll
      const antigravityUpdate: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 15,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow,
      };

      await cacheService.updateProviderSnapshot(antigravityUpdate);

      const loaded = await cacheService.loadSnapshots();
      expect(loaded?.snapshots.antigravity.sessionUsedPercent).toBe(15);
      expect(loaded?.snapshots.codex.sessionUsedPercent).toBe(50);
    });
  });
});
