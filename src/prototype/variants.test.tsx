import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { DEFAULT_PROTOTYPE_SNAPSHOTS } from "./mockData";

describe("VariantA: Organic Curvature Notch", () => {
  it("renders SVG curved notch and usage rings for Antigravity and Codex", () => {
    render(<VariantA snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    expect(screen.getByText(/Antigravity Usage/i)).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
  });

  it("reveals popover card when clicking or hovering a ring", () => {
    render(<VariantA snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    const codexButton = screen.getByRole("button", { name: /Codex \/ ChatGPT: 86%/i });
    fireEvent.click(codexButton);

    expect(screen.getByText(/Codex Usage/i)).toBeInTheDocument();
    expect(screen.getByText(/Current session/i)).toBeInTheDocument();
  });
});

describe("VariantB: Floating Pill Tab", () => {
  it("renders compact edge pill and expands on interaction", () => {
    render(<VariantB snapshots={DEFAULT_PROTOTYPE_SNAPSHOTS} />);

    expect(screen.getByTitle(/Antigravity Usage: 68%/i)).toBeInTheDocument();
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
