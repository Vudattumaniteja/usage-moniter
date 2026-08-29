import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState, useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Notch } from "../components/Notch";
import { AntigravityAdapter, AntigravityTransport } from "./antigravityAdapter";
import { DEFAULT_PROTOTYPE_SNAPSHOTS } from "../prototype/mockData";
import { UsageSnapshot, ProviderId } from "../types";

const REAL_CONNECT_RPC_PAYLOAD = {
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
            remainingFraction: 0.65, // 35% used
            resetTime: "2026-08-29T21:00:00Z",
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
            remainingFraction: 0.72, // 28% used
            resetTime: "2026-08-31T15:00:29Z",
          },
          {
            bucketId: "3p-5h",
            displayName: "Five Hour Limit Remaining",
            window: "5h",
            remainingFraction: 1.0,
            resetTime: "2026-08-29T21:00:00Z",
          },
        ],
      },
    ],
  },
};

const IntegratedTestHost: React.FC<{ adapter: AntigravityAdapter }> = ({ adapter }) => {
  const [snapshots, setSnapshots] = useState<Record<ProviderId, UsageSnapshot>>(
    DEFAULT_PROTOTYPE_SNAPSHOTS
  );

  useEffect(() => {
    const unsubscribe = adapter.subscribe((snapshot) => {
      setSnapshots((prev) => ({
        ...prev,
        [snapshot.provider]: snapshot,
      }));
    });
    adapter.startPolling();
    return () => {
      unsubscribe();
      adapter.stopPolling();
    };
  }, [adapter]);

  return (
    <Notch
      snapshots={snapshots}
      referenceNow={Date.parse("2026-08-29T17:00:00Z")}
      onVerificationPoll={(pId) => {
        if (pId === "antigravity") {
          adapter.refreshNow();
        }
      }}
    />
  );
};

describe("Antigravity Integration: Discovery, Connect-RPC & UI State", () => {
  let mockTransport: AntigravityTransport;
  let adapter: AntigravityAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTransport = {
      discoverPort: vi.fn().mockResolvedValue(58600),
      queryRpc: vi.fn().mockResolvedValue(REAL_CONNECT_RPC_PAYLOAD),
    };

    adapter = new AntigravityAdapter({ transport: mockTransport });
  });

  afterEach(() => {
    adapter.stopPolling();
    vi.restoreAllMocks();
  });

  it("discovers loopback port, extracts Connect-RPC quota summary, and updates Notch ring gauge and popover card in real-time", async () => {
    render(<IntegratedTestHost adapter={adapter} />);

    // Fast-forward initial poll cycle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Verify Antigravity ring gauge shows normalized 35% session usage
    expect(screen.getByText("35%")).toBeInTheDocument();

    // Hover / Click Antigravity ring gauge to inspect Popover Card
    const antigravityButton = screen.getByRole("button", {
      name: /Antigravity Usage: 35%/i,
    });
    act(() => {
      fireEvent.mouseEnter(antigravityButton);
    });

    // Verify popover card content
    expect(screen.getByRole("dialog", { name: /Antigravity Usage Details/i })).toBeInTheDocument();
    expect(screen.getByText("35% Used")).toBeInTheDocument();
    expect(screen.getByText("28% Used")).toBeInTheDocument(); // Weekly 3p quota
    expect(screen.getByText(/Resets in 4h 0m/i)).toBeInTheDocument();
  });

  it("updates live UI when subsequent 15s poll cycle receives new quota metrics", async () => {
    render(<IntegratedTestHost adapter={adapter} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("35%")).toBeInTheDocument();

    // Update RPC payload for next poll: 82% session usage (warning state)
    const updatedPayload = JSON.parse(JSON.stringify(REAL_CONNECT_RPC_PAYLOAD));
    updatedPayload.response.groups[0].buckets[1].remainingFraction = 0.18; // 82% used
    mockTransport.queryRpc = vi.fn().mockResolvedValue(updatedPayload);

    // Fast-forward 15 seconds to next poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    // Verify ring updated to 82%
    expect(screen.getByText("82%")).toBeInTheDocument();
  });
});
