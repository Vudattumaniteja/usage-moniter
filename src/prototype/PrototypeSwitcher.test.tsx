import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrototypeSwitcher, VariantOption } from "./PrototypeSwitcher";

describe("PrototypeSwitcher", () => {
  const variants: VariantOption[] = [
    { key: "A", name: "Organic Curve Notch", description: "Smooth Bezier edge dock" },
    { key: "B", name: "Floating Pill Tab", description: "Compact HUD capsule" },
    { key: "C", name: "Cyber Chamfer Blade", description: "Angular neon telemetry" },
  ];

  it("renders the active variant label and arrow controls", () => {
    const onSelect = vi.fn();
    render(
      <PrototypeSwitcher
        variants={variants}
        current="A"
        onSelectVariant={onSelect}
      />
    );

    expect(screen.getByText(/Organic Curve Notch/i)).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("cycles to next variant when right arrow is clicked", () => {
    const onSelect = vi.fn();
    render(
      <PrototypeSwitcher
        variants={variants}
        current="A"
        onSelectVariant={onSelect}
      />
    );

    const nextBtn = screen.getByLabelText(/Next variant/i);
    fireEvent.click(nextBtn);
    expect(onSelect).toHaveBeenCalledWith("B");
  });

  it("wraps around to last variant when clicking previous from first", () => {
    const onSelect = vi.fn();
    render(
      <PrototypeSwitcher
        variants={variants}
        current="A"
        onSelectVariant={onSelect}
      />
    );

    const prevBtn = screen.getByLabelText(/Previous variant/i);
    fireEvent.click(prevBtn);
    expect(onSelect).toHaveBeenCalledWith("C");
  });

  it("switches variant with arrow keyboard shortcuts", () => {
    const onSelect = vi.fn();
    render(
      <PrototypeSwitcher
        variants={variants}
        current="B"
        onSelectVariant={onSelect}
      />
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenCalledWith("C");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith("A");
  });
});
