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

  it("renders usage rings for provided snapshots", () => {
    render(<Notch snapshots={mockSnapshots} defaultExpanded={true} />);

    expect(screen.getByText("Antigravity")).toBeInTheDocument();
    expect(screen.getByText("Codex / GPT")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("toggles expand and collapse when the tab button is clicked", () => {
    render(<Notch snapshots={mockSnapshots} defaultExpanded={true} />);

    const toggleButton = screen.getByLabelText("Collapse Notch");
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByText("Antigravity")).not.toBeInTheDocument();

    const expandButton = screen.getByLabelText("Expand Notch");
    fireEvent.click(expandButton);
    expect(screen.getByText("Antigravity")).toBeInTheDocument();
  });

  it("opens and closes popover card when clicking a usage ring", () => {
    render(<Notch snapshots={mockSnapshots} defaultExpanded={true} />);

    const antigravityRing = screen.getByLabelText("Antigravity: 40% used");
    fireEvent.click(antigravityRing);

    expect(screen.getByRole("dialog", { name: "Antigravity Details" })).toBeInTheDocument();
    expect(screen.getByText("Session Quota")).toBeInTheDocument();

    // Toggle off by clicking again
    fireEvent.click(antigravityRing);
    expect(screen.queryByRole("dialog", { name: "Antigravity Details" })).not.toBeInTheDocument();
  });
});
