import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CodexAdapter,
  CODEX_POLL_INTERVAL_MS,
  CodexTransport,
  CodexTransportResponse,
} from "./codexAdapter";
import { CodexAuthCredentials } from "./codexAuth";

const MOCK_WHAM_PAYLOAD = {
  plan_type: "plus",
  rate_limit: {
    allowed: true,
    limit_reached: false,
    primary_window: {
      used_percent: 24,
      limit_window_seconds: 18000,
      reset_after_seconds: 7320,
      reset_at: 1776111121,
    },
    secondary_window: {
      used_percent: 10,
      limit_window_seconds: 604800,
      reset_after_seconds: 541200,
      reset_at: 1776672455,
    },
  },
};

describe("CodexAdapter", () => {
  let mockTransport: CodexTransport;
  let mockAuth: CodexAuthCredentials;
  let authWatchCallback: ((creds: CodexAuthCredentials) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAuth = {
      accessToken: "mock_token_abc123",
      accountId: "acc_456",
    };

    authWatchCallback = null;

    mockTransport = {
      loadAuth: vi.fn().mockResolvedValue(mockAuth),
      fetchUsage: vi.fn().mockResolvedValue({
        status: 200,
        data: MOCK_WHAM_PAYLOAD,
      } as CodexTransportResponse),
      watchAuth: vi.fn().mockImplementation((cb) => {
        authWatchCallback = cb;
        return () => {
          authWatchCallback = null;
        };
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchUsage", () => {
    it("loads auth token, queries https://chatgpt.com/backend-api/wham/usage, and normalizes snapshot", async () => {
      const adapter = new CodexAdapter({ transport: mockTransport });
      const snapshot = await adapter.fetchUsage();

      expect(mockTransport.loadAuth).toHaveBeenCalledTimes(1);
      expect(mockTransport.fetchUsage).toHaveBeenCalledWith(
        "mock_token_abc123",
        "acc_456"
      );

      expect(snapshot).toMatchObject({
        provider: "codex",
        sessionUsedPercent: 24,
        sessionResetTime: 1776111121 * 1000,
        modelUsedPercent: 10,
        modelResetTime: 1776672455 * 1000,
        status: "ok",
        planType: "plus",
      });
      expect(adapter.isAuthSuspended()).toBe(false);
    });

    it("handles missing auth credentials with unauthenticated status and Run 'codex login' in terminal", async () => {
      mockTransport.loadAuth = vi.fn().mockResolvedValue(null);
      const adapter = new CodexAdapter({ transport: mockTransport });

      const snapshot = await adapter.fetchUsage();

      expect(snapshot.provider).toBe("codex");
      expect(snapshot.status).toBe("unauthenticated");
      expect(snapshot.errorMessage).toBe("Run 'codex login' in terminal");
      expect(adapter.isAuthSuspended()).toBe(true);
    });

    it("handles HTTP 401 unauthenticated response and suspends polling", async () => {
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 401,
        statusText: "Unauthorized",
      });

      const adapter = new CodexAdapter({ transport: mockTransport });
      const snapshot = await adapter.fetchUsage();

      expect(snapshot.status).toBe("unauthenticated");
      expect(snapshot.errorMessage).toBe("Run 'codex login' in terminal");
      expect(adapter.isAuthSuspended()).toBe(true);
    });

    it("handles HTTP 429 rate limit and calculates exponential backoff", async () => {
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "45" },
      });

      const adapter = new CodexAdapter({ transport: mockTransport });
      const snapshot = await adapter.fetchUsage();

      expect(snapshot.status).toBe("warning");
      expect(snapshot.errorMessage).toContain("429");
    });
  });

  describe("60-second Polling Interval", () => {
    it("polls every 60 seconds when healthy", async () => {
      const adapter = new CodexAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Fast-forward 60 seconds
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(2);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      // Fast-forward another 60 seconds
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(3);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(3);

      adapter.stopPolling();
    });
  });

  describe("HTTP 401 Polling Suspension and Auth Watching Auto-Resume", () => {
    it("suspends 60s polling on 401, and auto-resumes when auth file changes", async () => {
      // Return 401 on first poll
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 401,
        statusText: "Unauthorized",
      });

      const adapter = new CodexAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll -> 401

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(adapter.isAuthSuspended()).toBe(true);
      expect(mockTransport.watchAuth).toHaveBeenCalled();

      // Advancing 60s should NOT trigger polling because it is suspended
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Now simulate user running 'codex login' -> auth file updated
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 200,
        data: MOCK_WHAM_PAYLOAD,
      });

      // Trigger watcher callback
      expect(authWatchCallback).not.toBeNull();
      await authWatchCallback!({
        accessToken: "newly_refreshed_token",
        accountId: "acc_456",
      });

      // Auto-resume should immediately fetch usage with new token
      expect(mockTransport.fetchUsage).toHaveBeenCalledWith(
        "newly_refreshed_token",
        "acc_456"
      );
      expect(adapter.isAuthSuspended()).toBe(false);

      // And regular 60s polling is resumed
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      adapter.stopPolling();
    });
  });

  describe("HTTP 429 Exponential Backoff", () => {
    it("applies exponential backoff sequence (30s -> 60s -> 120s -> 300s max) on 429", async () => {
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 429,
        statusText: "Too Many Requests",
      });

      const adapter = new CodexAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll (attempt 1 -> 429, backoff 30s)
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Should not poll at 15s
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Should poll at 30s (attempt 2 -> 429, backoff 60s)
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      // Next poll happens after 60s (attempt 3 -> 429, backoff 120s)
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(3);

      // Next poll happens after 120s (attempt 4 -> 429, backoff 300s)
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(4);

      // Now service recovers (200 OK)
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 200,
        data: MOCK_WHAM_PAYLOAD,
      });

      // Poll at 300s
      await vi.advanceTimersByTimeAsync(300_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Normal 60s cadence is restored
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      adapter.stopPolling();
    });

    it("respects Retry-After header on 429", async () => {
      mockTransport.fetchUsage = vi.fn().mockResolvedValue({
        status: 429,
        headers: { "retry-after": "40" },
      });

      const adapter = new CodexAdapter({ transport: mockTransport });
      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Should not poll at 30s
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Should poll at 40s
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      adapter.stopPolling();
    });
  });

  describe("On-demand refreshNow", () => {
    it("resets scheduled poll timer and fetches immediately", async () => {
      const adapter = new CodexAdapter({ transport: mockTransport });
      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll (t=0)
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Advance 25 seconds
      await vi.advanceTimersByTimeAsync(25_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Trigger refreshNow
      await adapter.refreshNow();
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      // Next scheduled poll should be 60 seconds after refreshNow
      await vi.advanceTimersByTimeAsync(59_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(3);

      adapter.stopPolling();
    });
  });

  describe("Offline Remote Polling Pause and Online Auto-Resume", () => {
    it("pauses polling when network goes offline and resumes immediately when reconnecting", async () => {
      const adapter = new CodexAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll (t=0)
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Network goes offline
      adapter.handleNetworkStatusChange(false);
      expect(adapter.isNetworkOffline()).toBe(true);

      // Fast-forward 120 seconds while offline -> no remote requests made
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(1);

      // Network comes back online
      await adapter.handleNetworkStatusChange(true);
      expect(adapter.isNetworkOffline()).toBe(false);

      // Immediate poll on reconnection
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(2);

      // Regular 60s polling resumes
      await vi.advanceTimersByTimeAsync(CODEX_POLL_INTERVAL_MS);
      expect(mockTransport.fetchUsage).toHaveBeenCalledTimes(3);

      adapter.stopPolling();
    });

    it("prevents remote requests when fetchUsage is invoked directly while offline", async () => {
      const adapter = new CodexAdapter({ transport: mockTransport });
      adapter.handleNetworkStatusChange(false);

      const snapshot = await adapter.fetchUsage();
      expect(mockTransport.fetchUsage).not.toHaveBeenCalled();
      expect(snapshot.status).toBe("error");
      expect(snapshot.errorMessage).toContain("offline");
    });
  });
});

