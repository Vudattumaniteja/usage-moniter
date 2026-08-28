import { ProviderId, ProviderStatus, UsageSnapshot } from "../types";

/**
 * Cache persistence constants and defaults.
 */
export const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
export const CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_CACHE_FILENAME = "cache.json";
export const DEFAULT_CACHE_FOLDER = "usage-monitor";

export interface CachePayload {
  version: number;
  savedAt: number;
  snapshots: Record<ProviderId, UsageSnapshot>;
}

export interface SnapshotSyncState {
  isStale: boolean;
  isSyncing: boolean;
}

const VALID_STATUSES: Set<ProviderStatus> = new Set([
  "ok",
  "warning",
  "exhausted",
  "unauthenticated",
  "error",
]);

/**
 * Validates whether an unknown value conforms to the UsageSnapshot interface.
 */
export function validateUsageSnapshot(obj: unknown): obj is UsageSnapshot {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.provider !== "string" || record.provider.trim().length === 0) {
    return false;
  }

  if (
    typeof record.sessionUsedPercent !== "number" ||
    isNaN(record.sessionUsedPercent) ||
    record.sessionUsedPercent < 0
  ) {
    return false;
  }

  if (
    typeof record.status !== "string" ||
    !VALID_STATUSES.has(record.status as ProviderStatus)
  ) {
    return false;
  }

  if (
    record.modelUsedPercent !== undefined &&
    record.modelUsedPercent !== null &&
    (typeof record.modelUsedPercent !== "number" || isNaN(record.modelUsedPercent))
  ) {
    return false;
  }

  if (
    record.updatedAt !== undefined &&
    record.updatedAt !== null &&
    (typeof record.updatedAt !== "number" || isNaN(record.updatedAt))
  ) {
    return false;
  }

  return true;
}

/**
 * Checks whether a snapshot is older than the given stale threshold (defaults to 15 minutes).
 */
export function isSnapshotStale(
  snapshot: UsageSnapshot | { updatedAt?: number },
  referenceNow: number = Date.now(),
  thresholdMs: number = STALE_THRESHOLD_MS
): boolean {
  if (!snapshot.updatedAt || typeof snapshot.updatedAt !== "number" || isNaN(snapshot.updatedAt)) {
    return true;
  }

  const elapsed = referenceNow - snapshot.updatedAt;
  return elapsed > thresholdMs;
}

/**
 * Validates and parses raw cache data or serialized JSON into a typed CachePayload.
 */
export function validateCachePayload(raw: unknown): CachePayload | null {
  if (!raw) {
    return null;
  }

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  // Case A: Structured CachePayload with version, savedAt, snapshots
  if (
    typeof candidate.version === "number" &&
    typeof candidate.savedAt === "number" &&
    candidate.snapshots &&
    typeof candidate.snapshots === "object"
  ) {
    const rawSnapshots = candidate.snapshots as Record<string, unknown>;
    const validatedSnapshots: Record<ProviderId, UsageSnapshot> = {};

    const entries = Object.entries(rawSnapshots);
    if (entries.length === 0) {
      return null;
    }

    for (const [key, snap] of entries) {
      if (!validateUsageSnapshot(snap)) {
        return null;
      }
      validatedSnapshots[key] = snap;
    }

    return {
      version: candidate.version,
      savedAt: candidate.savedAt,
      snapshots: validatedSnapshots,
    };
  }

  // Case B: Direct dictionary of snapshots (e.g. { antigravity: { ... } })
  const entries = Object.entries(candidate);
  if (entries.length === 0) {
    return null;
  }

  const validatedSnapshots: Record<ProviderId, UsageSnapshot> = {};
  let newestUpdatedAt = 0;

  for (const [key, snap] of entries) {
    if (!validateUsageSnapshot(snap)) {
      return null;
    }
    validatedSnapshots[key] = snap;
    if (snap.updatedAt && snap.updatedAt > newestUpdatedAt) {
      newestUpdatedAt = snap.updatedAt;
    }
  }

  return {
    version: CACHE_SCHEMA_VERSION,
    savedAt: newestUpdatedAt || Date.now(),
    snapshots: validatedSnapshots,
  };
}

/**
 * Derives UI sync and stale states for a snapshot.
 */
export function deriveSnapshotSyncState(
  snapshot: UsageSnapshot,
  isLivePollComplete: boolean,
  referenceNow: number = Date.now(),
  staleThresholdMs: number = STALE_THRESHOLD_MS
): SnapshotSyncState {
  if (isLivePollComplete) {
    return {
      isStale: false,
      isSyncing: false,
    };
  }

  const isStale = isSnapshotStale(snapshot, referenceNow, staleThresholdMs);

  return {
    isStale,
    isSyncing: !isStale,
  };
}

/**
 * Resolves the default cache path, preferring Windows %LOCALAPPDATA%\usage-monitor\cache.json.
 */
export function resolveDefaultCachePath(
  env?: Record<string, string | undefined>
): string {
  const localAppData =
    env?.LOCALAPPDATA ??
    (typeof process !== "undefined" && process.env?.LOCALAPPDATA) ??
    null;

  if (localAppData) {
    const trimmed = localAppData.replace(/[/\\]+$/, "");
    return `${trimmed}\\${DEFAULT_CACHE_FOLDER}\\${DEFAULT_CACHE_FILENAME}`;
  }

  return `${DEFAULT_CACHE_FOLDER}/${DEFAULT_CACHE_FILENAME}`;
}

/**
 * Abstract storage adapter interface for reading/writing cache data.
 */
export interface CacheStorageAdapter {
  save(content: string, customPath?: string): Promise<void>;
  load(customPath?: string): Promise<string | null>;
  getPath(): Promise<string>;
}

/**
 * In-memory storage adapter for testing and isolated sandboxes.
 */
export class MemoryStorageAdapter implements CacheStorageAdapter {
  private store: Map<string, string> = new Map();
  private defaultPath: string;

  constructor(defaultPath: string = resolveDefaultCachePath()) {
    this.defaultPath = defaultPath;
  }

  async save(content: string, customPath?: string): Promise<void> {
    const targetPath = customPath || this.defaultPath;
    this.store.set(targetPath, content);
  }

  async load(customPath?: string): Promise<string | null> {
    const targetPath = customPath || this.defaultPath;
    return this.store.get(targetPath) ?? null;
  }

  async getPath(): Promise<string> {
    return this.defaultPath;
  }
}

/**
 * LocalStorage fallback adapter for browser prototypes and web views.
 */
export class LocalStorageAdapter implements CacheStorageAdapter {
  private key: string;
  private path: string;

  constructor(
    key: string = "usage-monitor-snapshot-cache",
    path: string = resolveDefaultCachePath()
  ) {
    this.key = key;
    this.path = path;
  }

  async save(content: string): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(this.key, content);
    }
  }

  async load(): Promise<string | null> {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(this.key);
    }
    return null;
  }

  async getPath(): Promise<string> {
    return this.path;
  }
}

/**
 * Tauri desktop storage adapter invoking native Rust backend commands.
 */
export class TauriStorageAdapter implements CacheStorageAdapter {
  private cachedPath: string | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  }

  async save(content: string): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_cache", { payload: content });
  }

  async load(): Promise<string | null> {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<string | null>("load_cache");
    return result;
  }

  async getPath(): Promise<string> {
    if (this.cachedPath) {
      return this.cachedPath;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string>("get_cache_path");
      this.cachedPath = path;
      return path;
    } catch {
      return resolveDefaultCachePath();
    }
  }
}

/**
 * High-level Service managing disk persistence and retrieval of usage snapshots.
 */
export class SnapshotCacheService {
  private storage: CacheStorageAdapter;

  constructor(storage?: CacheStorageAdapter) {
    if (storage) {
      this.storage = storage;
    } else if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      this.storage = new TauriStorageAdapter();
    } else if (typeof window !== "undefined" && window.localStorage) {
      this.storage = new LocalStorageAdapter();
    } else {
      this.storage = new MemoryStorageAdapter();
    }
  }

  /**
   * Persists normalized snapshot map to disk storage.
   */
  async saveSnapshots(
    snapshots: Record<ProviderId, UsageSnapshot>,
    timestamp: number = Date.now()
  ): Promise<void> {
    const payload: CachePayload = {
      version: CACHE_SCHEMA_VERSION,
      savedAt: timestamp,
      snapshots,
    };
    const json = JSON.stringify(payload, null, 2);
    await this.storage.save(json);
  }

  /**
   * Loads and validates cached snapshots from disk.
   */
  async loadSnapshots(): Promise<CachePayload | null> {
    try {
      const raw = await this.storage.load();
      if (!raw) {
        return null;
      }
      return validateCachePayload(raw);
    } catch {
      return null;
    }
  }

  /**
   * Updates a single provider's snapshot in the cache while preserving others.
   */
  async updateProviderSnapshot(
    snapshot: UsageSnapshot,
    timestamp: number = Date.now()
  ): Promise<void> {
    const existing = await this.loadSnapshots();
    const currentSnapshots: Record<ProviderId, UsageSnapshot> = existing
      ? { ...existing.snapshots }
      : {};

    currentSnapshots[snapshot.provider] = snapshot;
    await this.saveSnapshots(currentSnapshots, timestamp);
  }

  /**
   * Gets the active storage file path.
   */
  async getCachePath(): Promise<string> {
    return this.storage.getPath();
  }
}

/**
 * Singleton instance of SnapshotCacheService for application-wide use.
 */
export const snapshotCache = new SnapshotCacheService();
