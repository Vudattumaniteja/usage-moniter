import { useState, useEffect, useCallback, useRef } from "react";
import { ProviderId, UsageSnapshot } from "../types";
import {
  SnapshotCacheService,
  snapshotCache as defaultCacheService,
  SnapshotSyncState,
  deriveSnapshotSyncState,
} from "../services/cache";

export interface UseSnapshotCacheOptions {
  cacheService?: SnapshotCacheService;
  initialSnapshots?: Record<ProviderId, UsageSnapshot>;
}

export interface UseSnapshotCacheResult {
  snapshots: Record<ProviderId, UsageSnapshot>;
  syncStates: Record<ProviderId, SnapshotSyncState>;
  isRestored: boolean;
  onLivePollSuccess: (snapshot: UsageSnapshot) => Promise<void>;
  updateSnapshot: (provider: ProviderId, updates: Partial<UsageSnapshot>) => void;
}

export function useSnapshotCache({
  cacheService = defaultCacheService,
  initialSnapshots = {},
}: UseSnapshotCacheOptions = {}): UseSnapshotCacheResult {
  const [snapshots, setSnapshots] = useState<Record<ProviderId, UsageSnapshot>>(initialSnapshots);
  const [syncStates, setSyncStates] = useState<Record<ProviderId, SnapshotSyncState>>({});
  const [isRestored, setIsRestored] = useState(false);
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  // Restore cached snapshot on application startup before network polling
  useEffect(() => {
    let isMounted = true;

    async function restoreCache() {
      try {
        const cached = await cacheService.loadSnapshots();
        if (!isMounted) return;

        if (cached && Object.keys(cached.snapshots).length > 0) {
          const loadedSnapshots = { ...cached.snapshots };
          const now = Date.now();
          const computedSyncStates: Record<ProviderId, SnapshotSyncState> = {};

          for (const [providerId, snapshot] of Object.entries(loadedSnapshots)) {
            computedSyncStates[providerId] = deriveSnapshotSyncState(snapshot, false, now);
          }

          snapshotsRef.current = loadedSnapshots;
          setSnapshots(loadedSnapshots);
          setSyncStates(computedSyncStates);
        }
      } catch (err) {
        console.warn("Failed to restore snapshot cache on startup:", err);
      } finally {
        if (isMounted) {
          setIsRestored(true);
        }
      }
    }

    restoreCache();

    return () => {
      isMounted = false;
    };
  }, [cacheService]);

  // Handler for successful live provider polls
  const onLivePollSuccess = useCallback(
    async (rawSnapshot: UsageSnapshot) => {
      const now = Date.now();
      const updatedSnapshot: UsageSnapshot = {
        ...rawSnapshot,
        updatedAt: now,
      };

      const nextSnapshots = {
        ...snapshotsRef.current,
        [updatedSnapshot.provider]: updatedSnapshot,
      };

      snapshotsRef.current = nextSnapshots;
      setSnapshots(nextSnapshots);

      setSyncStates((prev) => ({
        ...prev,
        [updatedSnapshot.provider]: {
          isStale: false,
          isSyncing: false,
        },
      }));

      // Persist to disk cache
      try {
        await cacheService.saveSnapshots(nextSnapshots, now);
      } catch (err) {
        console.error("Failed to save snapshot cache to disk:", err);
      }
    },
    [cacheService]
  );

  // Generic local state updater for prototype controls or manual changes
  const updateSnapshot = useCallback(
    (provider: ProviderId, updates: Partial<UsageSnapshot>) => {
      setSnapshots((prev) => {
        const current = prev[provider] || {
          provider,
          sessionUsedPercent: 0,
          status: "ok",
        };
        const nextSnapshot = { ...current, ...updates };
        const next = {
          ...prev,
          [provider]: nextSnapshot,
        };
        snapshotsRef.current = next;
        return next;
      });
    },
    []
  );

  return {
    snapshots,
    syncStates,
    isRestored,
    onLivePollSuccess,
    updateSnapshot,
  };
}
