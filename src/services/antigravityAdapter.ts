import { ProviderAdapter, ProviderId, UsageSnapshot } from "../types";
import { normalizeAntigravityResponse } from "../models/normalizers";

export const ACTIVE_POLL_INTERVAL_MS = 15_000; // 15 seconds active Connect-RPC polling
export const INACTIVE_POLL_INTERVAL_MS = 30_000; // 30 seconds relaxed inactive probe
export const RETRIEVE_QUOTA_ENDPOINT =
  "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";

export interface AntigravityTransport {
  discoverPort(): Promise<number | null>;
  queryRpc(
    port: number,
    path: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<unknown>;
  fetchDirect?(): Promise<UsageSnapshot | null>;
}

export class TauriAntigravityTransport implements AntigravityTransport {
  async isAvailable(): Promise<boolean> {
    return (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    );
  }

  async discoverPort(): Promise<number | null> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const port = await invoke<number | null>("discover_antigravity_port");
      return port;
    } catch {
      return null;
    }
  }

  async queryRpc(
    port: number,
    _path: string,
    _headers: Record<string, string>,
    _body?: unknown
  ): Promise<unknown> {
    const { invoke } = await import("@tauri-apps/api/core");
    const rawJson = await invoke<string>("query_antigravity_rpc", {
      port,
      csrfToken: null,
    });
    return JSON.parse(rawJson);
  }

  async fetchDirect(): Promise<UsageSnapshot | null> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const rawJson = await invoke<string | null>("get_antigravity_usage");
      if (!rawJson) return null;
      const parsed = JSON.parse(rawJson);
      return normalizeAntigravityResponse(parsed);
    } catch {
      return null;
    }
  }
}

export class FetchAntigravityTransport implements AntigravityTransport {
  private fallbackPorts: number[];

  constructor(fallbackPorts: number[] = [58600, 58601, 59661, 59662]) {
    this.fallbackPorts = fallbackPorts;
  }

  async discoverPort(): Promise<number | null> {
    for (const port of this.fallbackPorts) {
      try {
        const url = `http://127.0.0.1:${port}${RETRIEVE_QUOTA_ENDPOINT}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Connect-Protocol-Version": "1",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          return port;
        }
      } catch {
        // Continue probing next port
      }
    }
    return null;
  }

  async queryRpc(
    port: number,
    path: string,
    headers: Record<string, string>,
    body?: unknown
  ): Promise<unknown> {
    const url = `http://127.0.0.1:${port}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      throw new Error(`Connect-RPC HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  }
}

export interface AntigravityAdapterOptions {
  transport?: AntigravityTransport;
}

export class AntigravityAdapter implements ProviderAdapter {
  readonly id: ProviderId = "antigravity";
  readonly name: string = "Google Antigravity";

  private transport: AntigravityTransport;
  private activePort: number | null = null;
  private processActive: boolean = false;
  private pollingTimer: NodeJS.Timeout | number | null = null;
  private isPollingRunning: boolean = false;
  private subscribers: Set<(snapshot: UsageSnapshot) => void> = new Set();
  private lastSnapshot: UsageSnapshot | null = null;

  constructor(options: AntigravityAdapterOptions = {}) {
    if (options.transport) {
      this.transport = options.transport;
    } else if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      this.transport = new TauriAntigravityTransport();
    } else {
      this.transport = new FetchAntigravityTransport();
    }
  }

  isProcessActive(): boolean {
    return this.processActive;
  }

  getActivePort(): number | null {
    return this.activePort;
  }

  getLastSnapshot(): UsageSnapshot | null {
    return this.lastSnapshot;
  }

  subscribe(listener: (snapshot: UsageSnapshot) => void): () => void {
    this.subscribers.add(listener);
    if (this.lastSnapshot) {
      listener(this.lastSnapshot);
    }
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(snapshot: UsageSnapshot): void {
    this.lastSnapshot = snapshot;
    for (const listener of this.subscribers) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error("Error in AntigravityAdapter subscriber:", err);
      }
    }
  }

  /**
   * Discovers port, performs Connect-RPC query, and returns normalized UsageSnapshot.
   */
  async fetchUsage(): Promise<UsageSnapshot> {
    const now = Date.now();

    try {
      const port = await this.transport.discoverPort();
      if (!port) {
        this.activePort = null;
        this.processActive = false;
        const snapshot: UsageSnapshot = {
          provider: "antigravity",
          sessionUsedPercent: 0,
          sessionResetTime: null,
          modelUsedPercent: null,
          modelResetTime: null,
          status: "error",
          errorMessage: "Antigravity process or loopback port not detected",
          updatedAt: now,
        };
        this.notifySubscribers(snapshot);
        return snapshot;
      }

      this.activePort = port;

      const rpcPayload = await this.transport.queryRpc(
        port,
        RETRIEVE_QUOTA_ENDPOINT,
        {
          "Connect-Protocol-Version": "1",
          "Content-Type": "application/json",
        },
        {}
      );

      const snapshot = normalizeAntigravityResponse(rpcPayload, now);
      this.processActive = snapshot.status !== "error";
      this.notifySubscribers(snapshot);
      return snapshot;
    } catch (err) {
      this.processActive = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const snapshot: UsageSnapshot = {
        provider: "antigravity",
        sessionUsedPercent: 0,
        sessionResetTime: null,
        modelUsedPercent: null,
        modelResetTime: null,
        status: "error",
        errorMessage,
        updatedAt: now,
      };
      this.notifySubscribers(snapshot);
      return snapshot;
    }
  }

  /**
   * Starts background polling loop with dynamic auto-adjusting interval:
   * - 15s when process is active
   * - 30s relaxed probe when inactive
   */
  startPolling(): void {
    if (this.isPollingRunning) return;
    this.isPollingRunning = true;
    this.runPollCycle();
  }

  private async runPollCycle(): Promise<void> {
    if (!this.isPollingRunning) return;

    await this.fetchUsage();

    if (!this.isPollingRunning) return;
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (!this.isPollingRunning) return;

    const nextInterval = this.processActive
      ? ACTIVE_POLL_INTERVAL_MS
      : INACTIVE_POLL_INTERVAL_MS;

    this.pollingTimer = setTimeout(() => {
      this.runPollCycle();
    }, nextInterval);
  }

  stopPolling(): void {
    this.isPollingRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * On-demand refresh that resets the next scheduled poll timer.
   */
  async refreshNow(): Promise<UsageSnapshot> {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    const snapshot = await this.fetchUsage();

    if (this.isPollingRunning) {
      this.scheduleNextPoll();
    }

    return snapshot;
  }
}

export const antigravityAdapter = new AntigravityAdapter();

