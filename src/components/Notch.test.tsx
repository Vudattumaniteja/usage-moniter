import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Notch } from "./Notch";
import { UsageSnapshot } from "../types";

describe("Notch Component", () => {
  const now = 1725000000000;
  const mockSnapshots: Record<string, UsageSnapshot> = {
    antigravity: {
      provider: "antigravity",
      sessionUsedPercent: 40,
      sessionResetTime: now + 3600000,
      modelUsedPercent: 50,
      status: "ok",
      planType: "Pro",
      updatedAt: now - 5 * 60 * 1000, // 5 min ago (fresh)
    },
    codex: {
      provider: "codex",
      sessionUsedPercent: 85,
      sessionResetTime: now + 1800000,
      status: "warning",
      planType: "Plus",
      updatedAt: now - 20 * 60 * 1000, // 20 min ago (stale)
    },
  };

  it("renders usage rings for Antigravity and Codex immediately from cached data", () => {
    render(<Notch snapshots={mockSnapshots} referenceNow={now} />);

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("opens popover card when clicking a usage ring", () => {
    render(<Notch snapshots={mockSnapshots} referenceNow={now} />);

    const antigravityRing = screen.getByRole("button", { name: /Antigravity Usage: 40%/i });
    fireEvent.click(antigravityRing);

    expect(screen.getByRole("dialog", { name: "Antigravity Usage Details" })).toBeInTheDocument();
    expect(screen.getByText(/Current session/i)).toBeInTheDocument();
  });

  it("displays amber stale indicator dot for snapshots older than 15 minutes", () => {
    render(<Notch snapshots={mockSnapshots} referenceNow={now} />);

    // Codex is stale (updated 20 min ago)
    const staleIndicator = screen.getByTestId("stale-dot-codex");
    expect(staleIndicator).toBeInTheDocument();
    expect(staleIndicator).toHaveAttribute("title", expect.stringMatching(/stale/i));

    // Antigravity is fresh (updated 5 min ago)
    expect(screen.queryByTestId("stale-dot-antigravity")).not.toBeInTheDocument();
  });

  it("displays syncing pulse for fresh cached snapshots before live poll completes", () => {
    render(
      <Notch
        snapshots={mockSnapshots}
        referenceNow={now}
        syncStates={{
          antigravity: { isStale: false, isSyncing: true },
          codex: { isStale: true, isSyncing: false },
        }}
      />
    );

    const syncingIndicator = screen.getByTestId("syncing-indicator-antigravity");
    expect(syncingIndicator).toBeInTheDocument();
  });

  it("hides stale dot and syncing pulse when live poll completes", () => {
    render(
      <Notch
        snapshots={mockSnapshots}
        referenceNow={now}
        syncStates={{
          antigravity: { isStale: false, isSyncing: false },
          codex: { isStale: false, isSyncing: false },
        }}
      />
    );

    expect(screen.queryByTestId("stale-dot-codex")).not.toBeInTheDocument();
    expect(screen.queryByTestId("syncing-indicator-antigravity")).not.toBeInTheDocument();
  });

  it("displays stale indicator in popover card when viewing stale provider details", () => {
    render(
      <Notch
        snapshots={mockSnapshots}
        referenceNow={now}
        syncStates={{
          antigravity: { isStale: false, isSyncing: false },
          codex: { isStale: true, isSyncing: false },
        }}
      />
    );

    const codexRing = screen.getByRole("button", { name: /Codex \/ ChatGPT: 85%/i });
    fireEvent.click(codexRing);

    expect(screen.getByText(/Cached data \(stale/i)).toBeInTheDocument();
  });
});
