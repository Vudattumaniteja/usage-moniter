import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Notch } from "./Notch";
import { UsageSnapshot } from "../types";

describe("Notch Component", () => {
  const mockSnapshots: Record<string, UsageSnapshot> = {
    antigravity: {
      provider: "antigravity",
      sessionUsedPercent: 40,
      sessionResetTime: Date.now() + 3600000,
      modelUsedPercent: 50,
      status: "ok",
      planType: "Pro",
    },
    codex: {
      provider: "codex",
      sessionUsedPercent: 85,
      sessionResetTime: Date.now() + 1800000,
      status: "warning",
      planType: "Plus",
    },
  };

  it("renders usage rings for Antigravity and Codex", () => {
    render(<Notch snapshots={mockSnapshots} />);

    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("opens popover card when clicking a usage ring", () => {
    render(<Notch snapshots={mockSnapshots} />);

    const antigravityRing = screen.getByRole("button", { name: /Antigravity Usage: 40%/i });
    fireEvent.click(antigravityRing);

    expect(screen.getByRole("dialog", { name: "Antigravity Usage Details" })).toBeInTheDocument();
    expect(screen.getByText(/Current session/i)).toBeInTheDocument();
  });
});
