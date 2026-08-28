import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSnapshotCache } from "./useSnapshotCache";
import { MemoryStorageAdapter, SnapshotCacheService } from "../services/cache";
import { UsageSnapshot } from "../types";

describe("useSnapshotCache Hook", () => {
  const baseNow = 1725000000000;
  let memoryStorage: MemoryStorageAdapter;
  let cacheService: SnapshotCacheService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    memoryStorage = new MemoryStorageAdapter();
    cacheService = new SnapshotCacheService(memoryStorage);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads cached snapshots on bootstrap before live network polling", async () => {
    const cachedSnapshots: Record<string, UsageSnapshot> = {
      antigravity: {
        provider: "antigravity",
        sessionUsedPercent: 35,
        sessionResetTime: baseNow + 10000,
        status: "ok",
        updatedAt: baseNow - 5 * 60 * 1000, // 5 min ago (fresh)
      },
      codex: {
        provider: "codex",
        sessionUsedPercent: 80,
        sessionResetTime: null,
        status: "warning",
        updatedAt: baseNow - 25 * 60 * 1000, // 25 min ago (stale)
      },
    };

    await cacheService.saveSnapshots(cachedSnapshots);

    const { result } = renderHook(() =>
      useSnapshotCache({
        cacheService,
        initialSnapshots: {},
      })
    );

    // Wait for initial cache restore
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isRestored).toBe(true);
    expect(result.current.snapshots.antigravity.sessionUsedPercent).toBe(35);
    expect(result.current.snapshots.codex.sessionUsedPercent).toBe(80);

    // Fresh snapshot (< 15 min) has isSyncing=true and isStale=false
    expect(result.current.syncStates.antigravity).toEqual({
      isStale: false,
      isSyncing: true,
    });

    // Stale snapshot (> 15 min) has isStale=true and isSyncing=false
    expect(result.current.syncStates.codex).toEqual({
      isStale: true,
      isSyncing: false,
    });
  });

  it("persists to disk cache and clears stale indicator on successful live provider poll", async () => {
    const staleSnapshots: Record<string, UsageSnapshot> = {
      codex: {
        provider: "codex",
        sessionUsedPercent: 75,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow - 20 * 60 * 1000, // 20 min ago (stale)
      },
    };

    await cacheService.saveSnapshots(staleSnapshots);

    const { result } = renderHook(() =>
      useSnapshotCache({
        cacheService,
        initialSnapshots: {},
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.syncStates.codex.isStale).toBe(true);

    // Simulate successful live poll
    await act(async () => {
      await result.current.onLivePollSuccess({
        provider: "codex",
        sessionUsedPercent: 60,
        sessionResetTime: baseNow + 1800000,
        status: "ok",
      });
    });

    // Live poll completes: stale flag is cleared, syncing is false
    expect(result.current.snapshots.codex.sessionUsedPercent).toBe(60);
    expect(result.current.syncStates.codex).toEqual({
      isStale: false,
      isSyncing: false,
    });

    // Verify written to disk cache
    const saved = await cacheService.loadSnapshots();
    expect(saved?.snapshots.codex.sessionUsedPercent).toBe(60);
    expect(saved?.snapshots.codex.updatedAt).toBe(baseNow);
  });

  it("falls back to default snapshots if cache is empty or corrupt", async () => {
    const defaultSnapshots: Record<string, UsageSnapshot> = {
      antigravity: {
        provider: "antigravity",
        sessionUsedPercent: 0,
        sessionResetTime: null,
        status: "ok",
        updatedAt: baseNow,
      },
    };

    const { result } = renderHook(() =>
      useSnapshotCache({
        cacheService,
        initialSnapshots: defaultSnapshots,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isRestored).toBe(true);
    expect(result.current.snapshots.antigravity.sessionUsedPercent).toBe(0);
  });
});
