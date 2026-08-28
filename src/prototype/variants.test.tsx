import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { DEFAULT_PROTOTYPE_SNAPSHOTS } from "./mockData";

describe("VariantA: Organic Curvature Notch", () => {
  it("renders SVG curved notch and usage rings for active providers", () => {
    render(<VariantA snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    expect(screen.getByText(/Antigravity/i)).toBeInTheDocument();
    expect(screen.getByText(/Codex/i)).toBeInTheDocument();
    // Default percentages displayed
    expect(screen.getByText("68%")).toBeInTheDocument();
  });

  it("reveals popover card when clicking or hovering a ring", () => {
    render(<VariantA snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    const agyButton = screen.getByRole("button", { name: /Antigravity: 68%/i });
    fireEvent.click(agyButton);

    expect(screen.getByText(/Google AI Ultra/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly quota/i)).toBeInTheDocument();
  });
});

describe("VariantB: Floating Pill Tab", () => {
  it("renders compact edge pill and expands on interaction", () => {
    render(<VariantB snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    expect(screen.getByText("AGY")).toBeInTheDocument();
    expect(screen.getByText("CDX")).toBeInTheDocument();
  });

  it("shows unified dashboard flyout when clicking expand", () => {
    render(<VariantB snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    const expandBtn = screen.getByRole("button", { name: /Expand HUD/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText(/Next Reset/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Providers/i)).toBeInTheDocument();
  });
});

describe("VariantC: Cyber Chamfer Blade", () => {
  it("renders telemetry blade and raw status inspection", () => {
    render(<VariantC snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    expect(screen.getByText(/TELEMETRY BLADE/i)).toBeInTheDocument();
    expect(screen.getByText(/127.0.0.1/i)).toBeInTheDocument();
  });

  it("toggles JSON diagnostic drawer", () => {
    render(<VariantC snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    const diagBtn = screen.getByRole("button", { name: /Inspect Raw RPC/i });
    fireEvent.click(diagBtn);

    expect(screen.getByText(/RAW RPC SNAPSHOT/i)).toBeInTheDocument();
  });
});
