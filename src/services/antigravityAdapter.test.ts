import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AntigravityAdapter,
  ACTIVE_POLL_INTERVAL_MS,
  INACTIVE_POLL_INTERVAL_MS,
  AntigravityTransport,
} from "./antigravityAdapter";

const MOCK_CONNECT_RPC_PAYLOAD = {
  response: {
    groups: [
      {
        displayName: "Gemini Models",
        description: "Models within this group: Gemini Flash, Gemini Pro",
        buckets: [
          {
            bucketId: "gemini-weekly",
            displayName: "Weekly Limit Remaining",
            window: "weekly",
            remainingFraction: 0.98,
            resetTime: "2026-09-04T09:21:18Z",
          },
          {
            bucketId: "gemini-5h",
            displayName: "Five Hour Limit Remaining",
            window: "5h",
            remainingFraction: 0.70, // 30% used
            resetTime: "2026-08-29T16:22:01Z",
          },
        ],
      },
      {
        displayName: "Claude and GPT models",
        description: "Models within this group: Claude Opus, Claude Sonnet, GPT-OSS",
        buckets: [
          {
            bucketId: "3p-weekly",
            displayName: "Weekly Limit Remaining",
            window: "weekly",
            remainingFraction: 0.85, // 15% used
            resetTime: "2026-08-31T15:00:29Z",
          },
          {
            bucketId: "3p-5h",
            displayName: "Five Hour Limit Remaining",
            window: "5h",
            remainingFraction: 1.0,
            resetTime: "2026-08-29T16:35:51Z",
          },
        ],
      },
    ],
  },
};

describe("AntigravityAdapter", () => {
  let mockTransport: AntigravityTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTransport = {
      discoverPort: vi.fn().mockResolvedValue(58600),
      queryRpc: vi.fn().mockResolvedValue(MOCK_CONNECT_RPC_PAYLOAD),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchUsage", () => {
    it("discovers port and queries Connect-RPC endpoint returning normalized UsageSnapshot", async () => {
      const adapter = new AntigravityAdapter({ transport: mockTransport });
      const snapshot = await adapter.fetchUsage();

      expect(mockTransport.discoverPort).toHaveBeenCalled();
      expect(mockTransport.queryRpc).toHaveBeenCalledWith(
        58600,
        "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary",
        expect.objectContaining({
          "Connect-Protocol-Version": "1",
          "Content-Type": "application/json",
        }),
        {}
      );

      expect(snapshot).toMatchObject({
        provider: "antigravity",
        sessionUsedPercent: 30,
        sessionResetTime: "2026-08-29T16:22:01Z",
        modelUsedPercent: 15,
        modelResetTime: "2026-08-31T15:00:29Z",
        status: "ok",
      });
      expect(adapter.isProcessActive()).toBe(true);
    });

    it("handles inactive process state when port is not found", async () => {
      mockTransport.discoverPort = vi.fn().mockResolvedValue(null);
      const adapter = new AntigravityAdapter({ transport: mockTransport });

      const snapshot = await adapter.fetchUsage();
      expect(snapshot.provider).toBe("antigravity");
      expect(snapshot.status).toBe("error");
      expect(adapter.isProcessActive()).toBe(false);
    });

    it("handles RPC query failure gracefully", async () => {
      mockTransport.queryRpc = vi.fn().mockRejectedValue(new Error("Connection refused"));
      const adapter = new AntigravityAdapter({ transport: mockTransport });

      const snapshot = await adapter.fetchUsage();
      expect(snapshot.provider).toBe("antigravity");
      expect(snapshot.status).toBe("error");
      expect(snapshot.errorMessage).toContain("Connection refused");
      expect(adapter.isProcessActive()).toBe(false);
    });
  });

  describe("Polling Cadence and Dynamic Auto-Resume", () => {
    it("polls on 15-second interval when process is active", async () => {
      const adapter = new AntigravityAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(mockTransport.discoverPort).toHaveBeenCalledTimes(1);

      // Fast-forward 15 seconds
      await vi.advanceTimersByTimeAsync(ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(2);

      // Fast-forward another 15 seconds
      await vi.advanceTimersByTimeAsync(ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(3);

      adapter.stopPolling();
    });

    it("relaxes to 30-second probe when process is inactive, and auto-resumes to 15-second interval when process starts", async () => {
      // Step 1: Process is inactive initially
      mockTransport.discoverPort = vi.fn().mockResolvedValue(null);
      const adapter = new AntigravityAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll -> inactive

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(adapter.isProcessActive()).toBe(false);

      // Should NOT poll after 15 seconds because it is relaxed to 30 seconds
      await vi.advanceTimersByTimeAsync(ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(1);

      // Advance remaining 15 seconds (total 30 seconds) -> second poll occurs
      await vi.advanceTimersByTimeAsync(INACTIVE_POLL_INTERVAL_MS - ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(2);

      // Step 2: Process starts up!
      mockTransport.discoverPort = vi.fn().mockResolvedValue(58600);
      mockTransport.queryRpc = vi.fn().mockResolvedValue(MOCK_CONNECT_RPC_PAYLOAD);

      // Advance 30s to trigger next probe where process is now active
      await vi.advanceTimersByTimeAsync(INACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(3);
      expect(adapter.isProcessActive()).toBe(true);

      // Now that it's active, subsequent poll must happen in 15 seconds (auto-resumed)
      await vi.advanceTimersByTimeAsync(ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(4);

      adapter.stopPolling();
    });

    it("supports on-demand refresh and restarts poll timer", async () => {
      const adapter = new AntigravityAdapter({ transport: mockTransport });
      const onSnapshot = vi.fn();
      adapter.subscribe(onSnapshot);

      adapter.startPolling();
      await vi.advanceTimersByTimeAsync(0); // Initial poll (t=0)
      expect(onSnapshot).toHaveBeenCalledTimes(1);

      // Advance 7 seconds (halfway through 15s interval)
      await vi.advanceTimersByTimeAsync(7000);
      expect(onSnapshot).toHaveBeenCalledTimes(1);

      // Trigger on-demand refresh
      await adapter.refreshNow();
      expect(onSnapshot).toHaveBeenCalledTimes(2);

      // After refresh, the next poll happens 15 seconds later
      await vi.advanceTimersByTimeAsync(ACTIVE_POLL_INTERVAL_MS);
      expect(onSnapshot).toHaveBeenCalledTimes(3);

      adapter.stopPolling();
    });
  });
});
