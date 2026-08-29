import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useState, useEffect } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Notch } from "../components/Notch";
import { CodexAdapter, CodexTransport } from "./codexAdapter";
import { CodexAuthCredentials } from "./codexAuth";
import { DEFAULT_PROTOTYPE_SNAPSHOTS } from "../prototype/mockData";
import { UsageSnapshot, ProviderId } from "../types";

const REAL_WHAM_PAYLOAD = {
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
      used_percent: 12,
      limit_window_seconds: 604800,
      reset_after_seconds: 541200,
      reset_at: 1776672455,
    },
  },
};

const CodexIntegratedTestHost: React.FC<{ adapter: CodexAdapter }> = ({
  adapter,
}) => {
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
      referenceNow={1776103801 * 1000} // 7320s before reset_at
      onVerificationPoll={(pId) => {
        if (pId === "codex") {
          adapter.refreshNow();
        }
      }}
    />
  );
};

describe("Codex Integration: Auth Loading, wham/usage Quota & UI State", () => {
  let mockTransport: CodexTransport;
  let authWatchCallback: ((creds: CodexAuthCredentials) => void) | null = null;
  let adapter: CodexAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    authWatchCallback = null;

    mockTransport = {
      loadAuth: vi.fn().mockResolvedValue({
        accessToken: "test_jwt_access_token",
        accountId: "team_plus_workspace",
      }),
      fetchUsage: vi.fn().mockResolvedValue({
        status: 200,
        data: REAL_WHAM_PAYLOAD,
      }),
      watchAuth: vi.fn().mockImplementation((cb) => {
        authWatchCallback = cb;
        return () => {
          authWatchCallback = null;
        };
      }),
    };

    adapter = new CodexAdapter({ transport: mockTransport });
  });

  afterEach(() => {
    adapter.stopPolling();
    vi.restoreAllMocks();
  });

  it("extracts access token, polls wham/usage, and updates Codex ring gauge and popover card in real-time", async () => {
    render(<CodexIntegratedTestHost adapter={adapter} />);

    // Advance initial poll cycle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Verify Codex ring gauge shows normalized 24% session usage
    expect(screen.getByText("24%")).toBeInTheDocument();

    // Hover / Click Codex ring gauge to inspect Popover Card
    const codexButton = screen.getByRole("button", {
      name: /Codex \/ ChatGPT: 24%/i,
    });
    act(() => {
      fireEvent.mouseEnter(codexButton);
    });

    // Verify popover card content
    expect(
      screen.getByRole("dialog", { name: /Codex \/ ChatGPT Details/i })
    ).toBeInTheDocument();
    expect(screen.getByText("24% Used")).toBeInTheDocument();
    expect(screen.getByText("12% Used")).toBeInTheDocument(); // Weekly quota
    expect(screen.getByText(/plus/i)).toBeInTheDocument();
    expect(screen.getByText(/Resets in 2h 2m/i)).toBeInTheDocument();
  });

  it("displays Run 'codex login' in terminal on 401 unauthenticated and auto-resumes when auth file is refreshed", async () => {
    mockTransport.fetchUsage = vi.fn().mockResolvedValue({
      status: 401,
      statusText: "Unauthorized",
    });

    render(<CodexIntegratedTestHost adapter={adapter} />);

    // Advance initial poll cycle -> 401
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Pop open popover card
    const codexButton = screen.getByRole("button", {
      name: /Codex \/ ChatGPT/i,
    });
    act(() => {
      fireEvent.mouseEnter(codexButton);
    });

    // Verify 'Run codex login in terminal' message is displayed
    expect(
      screen.getByText("Run 'codex login' in terminal")
    ).toBeInTheDocument();
    expect(adapter.isAuthSuspended()).toBe(true);

    // Simulate user logging in via terminal -> auth file updated
    mockTransport.fetchUsage = vi.fn().mockResolvedValue({
      status: 200,
      data: REAL_WHAM_PAYLOAD,
    });

    await act(async () => {
      await authWatchCallback!({
        accessToken: "new_valid_token",
        accountId: "team_plus_workspace",
      });
    });

    // UI restores to normal quota state
    expect(screen.getByText("24% Used")).toBeInTheDocument();
    expect(adapter.isAuthSuspended()).toBe(false);
  });
});
