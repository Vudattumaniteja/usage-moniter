import { ProviderAdapter, ProviderId, UsageSnapshot } from "../types";
import { normalizeCodexResponse } from "../models/normalizers";
import {
  CodexAuthCredentials,
  CodexAuthWatcher,
  loadCodexAuthFromFile,
} from "./codexAuth";
import { CodexBackoffManager } from "./codexBackoff";
import { NetworkMonitor } from "./networkMonitor";

export const CODEX_POLL_INTERVAL_MS = 60_000; // 60-second polling cadence
export const CODEX_WHAM_USAGE_ENDPOINT =
  "https://chatgpt.com/backend-api/wham/usage";

export interface CodexTransportResponse {
  status: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
}

export interface CodexTransport {
  loadAuth(): Promise<CodexAuthCredentials | null>;
  fetchUsage(
    accessToken: string,
    accountId?: string
  ): Promise<CodexTransportResponse>;
  watchAuth?(onChange: (creds: CodexAuthCredentials) => void): () => void;
}

export class TauriCodexTransport implements CodexTransport {
  private authWatcher: CodexAuthWatcher | null = null;

  async isAvailable(): Promise<boolean> {
    return (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    );
  }

  async loadAuth(): Promise<CodexAuthCredentials | null> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const auth = await invoke<{
        access_token: string;
        account_id?: string;
      } | null>("load_codex_auth");

      if (auth && auth.access_token) {
        return {
          accessToken: auth.access_token,
          accountId: auth.account_id,
        };
      }
      return null;
    } catch {
      return loadCodexAuthFromFile();
    }
  }

  async fetchUsage(
    accessToken: string,
    accountId?: string
  ): Promise<CodexTransportResponse> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{
        status: number;
        body: string;
        headers?: Record<string, string>;
      }>("fetch_codex_usage", {
        accessToken,
        accountId: accountId || null,
      });

      let data: unknown = null;
      try {
        if (result.body) {
          data = JSON.parse(result.body);
        }
      } catch {
        data = result.body;
      }

      return {
        status: result.status,
        data,
        headers: result.headers,
      };
    } catch (err) {
      return {
        status: 500,
        statusText: err instanceof Error ? err.message : String(err),
      };
    }
  }

  watchAuth(onChange: (creds: CodexAuthCredentials) => void): () => void {
    if (!this.authWatcher) {
      this.authWatcher = new CodexAuthWatcher({ pollIntervalMs: 1500 });
      this.authWatcher.startWatching();
    }
    return this.authWatcher.subscribe(onChange);
  }
}

export class FetchCodexTransport implements CodexTransport {
  private authWatcher: CodexAuthWatcher | null = null;

  async loadAuth(): Promise<CodexAuthCredentials | null> {
    return loadCodexAuthFromFile();
  }

  async fetchUsage(
    accessToken: string,
    accountId?: string
  ): Promise<CodexTransportResponse> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "usage-monitor/1.0",
    };

    if (accountId) {
      headers["chatgpt-account-id"] = accountId;
    }

    try {
      const res = await fetch(CODEX_WHAM_USAGE_ENDPOINT, {
        method: "GET",
        headers,
      });

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key.toLowerCase()] = value;
      });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      return {
        status: res.status,
        statusText: res.statusText,
        data,
        headers: resHeaders,
      };
    } catch (err) {
      return {
        status: 500,
        statusText: err instanceof Error ? err.message : String(err),
      };
    }
  }

  watchAuth(onChange: (creds: CodexAuthCredentials) => void): () => void {
    if (!this.authWatcher) {
      this.authWatcher = new CodexAuthWatcher({ pollIntervalMs: 1500 });
      this.authWatcher.startWatching();
    }
    return this.authWatcher.subscribe(onChange);
  }
}

export interface CodexAdapterOptions {
  transport?: CodexTransport;
  pollIntervalMs?: number;
  networkMonitor?: NetworkMonitor;
}

export class CodexAdapter implements ProviderAdapter {
  readonly id: ProviderId = "codex";
  readonly name: string = "OpenAI Codex";

  private transport: CodexTransport;
  private networkMonitor?: NetworkMonitor;
  private pollIntervalMs: number;
  private isPollingRunning: boolean = false;
  private isSuspended: boolean = false;
  private isOffline: boolean = false;
  private pollingTimer: NodeJS.Timeout | number | null = null;
  private backoffManager: CodexBackoffManager;
  private subscribers: Set<(snapshot: UsageSnapshot) => void> = new Set();
  private lastSnapshot: UsageSnapshot | null = null;
  private authWatcherUnsubscribe: (() => void) | null = null;
  private networkUnsubscribe: (() => void) | null = null;

  constructor(options: CodexAdapterOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs || CODEX_POLL_INTERVAL_MS;
    this.backoffManager = new CodexBackoffManager();
    this.networkMonitor = options.networkMonitor;

    if (options.transport) {
      this.transport = options.transport;
    } else if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      this.transport = new TauriCodexTransport();
    } else {
      this.transport = new FetchCodexTransport();
    }

    if (this.networkMonitor) {
      this.isOffline = !this.networkMonitor.isOnline();
      this.networkUnsubscribe = this.networkMonitor.subscribe((online) => {
        this.handleNetworkStatusChange(online);
      });
    }
  }

  isAuthSuspended(): boolean {
    return this.isSuspended;
  }

  isNetworkOffline(): boolean {
    return this.isOffline;
  }

  async handleNetworkStatusChange(isOnline: boolean): Promise<void> {
    const wasOffline = this.isOffline;
    this.isOffline = !isOnline;

    if (!isOnline) {
      // Pause remote polls when Windows goes offline
      if (this.pollingTimer) {
        clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
      }
    } else if (wasOffline && isOnline) {
      // Resume immediately when reconnecting
      if (this.isPollingRunning && !this.isSuspended) {
        await this.fetchUsage();
      }
    }
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
        console.error("Error in CodexAdapter subscriber:", err);
      }
    }
  }

  private ensureAuthWatcher(): void {
    if (this.authWatcherUnsubscribe || !this.transport.watchAuth) {
      return;
    }

    this.authWatcherUnsubscribe = this.transport.watchAuth(
      async (newCreds) => {
        if (newCreds && newCreds.accessToken) {
          this.isSuspended = false;
          await this.fetchUsage(newCreds);
        }
      }
    );
  }

  /**
   * Loads access tokens from %USERPROFILE%\.codex\auth.json and queries wham/usage.
   */
  async fetchUsage(overrideCreds?: CodexAuthCredentials): Promise<UsageSnapshot> {
    const now = Date.now();

    if (this.isOffline) {
      const snapshot: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: this.lastSnapshot?.sessionUsedPercent ?? 0,
        sessionResetTime: this.lastSnapshot?.sessionResetTime ?? null,
        modelUsedPercent: this.lastSnapshot?.modelUsedPercent ?? null,
        modelResetTime: this.lastSnapshot?.modelResetTime ?? null,
        status: "error",
        errorMessage: "Network is offline. Polling paused until reconnection.",
        planType: this.lastSnapshot?.planType ?? null,
        updatedAt: now,
      };
      this.notifySubscribers(snapshot);
      return snapshot;
    }

    try {
      const creds = overrideCreds || (await this.transport.loadAuth());
      if (!creds || !creds.accessToken) {
        this.isSuspended = true;
        this.ensureAuthWatcher();

        const snapshot = normalizeCodexResponse(null, now, {
          isAuthError: true,
          errorMessage: "Run 'codex login' in terminal",
        });

        this.notifySubscribers(snapshot);
        return snapshot;
      }

      const response = await this.transport.fetchUsage(
        creds.accessToken,
        creds.accountId
      );

      // Handle HTTP 200 OK
      if (response.status === 200) {
        this.backoffManager.reset();
        this.isSuspended = false;

        const snapshot = normalizeCodexResponse(response.data, now);
        this.notifySubscribers(snapshot);

        if (this.isPollingRunning) {
          this.scheduleNextPoll(this.pollIntervalMs);
        }

        return snapshot;
      }

      // Handle HTTP 401 Unauthenticated
      if (response.status === 401) {
        this.isSuspended = true;
        this.ensureAuthWatcher();

        const snapshot = normalizeCodexResponse(null, now, {
          isAuthError: true,
          errorMessage: "Run 'codex login' in terminal",
        });

        this.notifySubscribers(snapshot);
        return snapshot;
      }

      // Handle HTTP 429 Rate Limit
      if (response.status === 429) {
        const retryAfterHeader =
          response.headers?.["retry-after"] || response.headers?.["Retry-After"];
        const backoffDelay = this.backoffManager.nextDelay(retryAfterHeader);

        const snapshot: UsageSnapshot = {
          provider: "codex",
          sessionUsedPercent: this.lastSnapshot?.sessionUsedPercent ?? 0,
          sessionResetTime: this.lastSnapshot?.sessionResetTime ?? null,
          modelUsedPercent: this.lastSnapshot?.modelUsedPercent ?? null,
          modelResetTime: this.lastSnapshot?.modelResetTime ?? null,
          status: "warning",
          errorMessage: `Rate limited (HTTP 429). Retrying in ${Math.round(
            backoffDelay / 1000
          )}s...`,
          planType: this.lastSnapshot?.planType ?? null,
          updatedAt: now,
        };

        this.notifySubscribers(snapshot);

        if (this.isPollingRunning) {
          this.scheduleNextPoll(backoffDelay);
        }

        return snapshot;
      }

      // Handle other HTTP or network errors
      const backoffDelay = this.backoffManager.nextDelay();
      const snapshot: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: this.lastSnapshot?.sessionUsedPercent ?? 0,
        sessionResetTime: this.lastSnapshot?.sessionResetTime ?? null,
        modelUsedPercent: this.lastSnapshot?.modelUsedPercent ?? null,
        modelResetTime: this.lastSnapshot?.modelResetTime ?? null,
        status: "error",
        errorMessage:
          response.statusText || `Codex service returned HTTP ${response.status}`,
        planType: this.lastSnapshot?.planType ?? null,
        updatedAt: now,
      };

      this.notifySubscribers(snapshot);

      if (this.isPollingRunning) {
        this.scheduleNextPoll(backoffDelay);
      }

      return snapshot;
    } catch (err) {
      const backoffDelay = this.backoffManager.nextDelay();
      const errorMessage = err instanceof Error ? err.message : String(err);
      const snapshot: UsageSnapshot = {
        provider: "codex",
        sessionUsedPercent: this.lastSnapshot?.sessionUsedPercent ?? 0,
        sessionResetTime: this.lastSnapshot?.sessionResetTime ?? null,
        modelUsedPercent: this.lastSnapshot?.modelUsedPercent ?? null,
        modelResetTime: this.lastSnapshot?.modelResetTime ?? null,
        status: "error",
        errorMessage,
        planType: this.lastSnapshot?.planType ?? null,
        updatedAt: now,
      };

      this.notifySubscribers(snapshot);

      if (this.isPollingRunning) {
        this.scheduleNextPoll(backoffDelay);
      }

      return snapshot;
    }
  }

  /**
   * Starts background polling loop with a 60-second polling cadence.
   */
  startPolling(): void {
    if (this.isPollingRunning) return;
    this.isPollingRunning = true;
    this.runPollCycle();
  }

  private async runPollCycle(): Promise<void> {
    if (!this.isPollingRunning) return;
    await this.fetchUsage();
  }

  private scheduleNextPoll(delayMs: number): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (!this.isPollingRunning) return;

    this.pollingTimer = setTimeout(() => {
      this.runPollCycle();
    }, delayMs);
  }

  stopPolling(): void {
    this.isPollingRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.authWatcherUnsubscribe) {
      this.authWatcherUnsubscribe();
      this.authWatcherUnsubscribe = null;
    }
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
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

    if (this.isPollingRunning && !this.isSuspended) {
      this.scheduleNextPoll(this.pollIntervalMs);
    }

    return snapshot;
  }
}

export const codexAdapter = new CodexAdapter();
