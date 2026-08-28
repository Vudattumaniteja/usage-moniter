import { describe, it, expect } from "vitest";
import { generateRightEdgeNotchPath } from "./notchMath";

describe("generateRightEdgeNotchPath", () => {
  it("generates a closed SVG path with bezier curves", () => {
    const path = generateRightEdgeNotchPath({
      totalWidth: 360,
      totalHeight: 580,
      notchWidth: 84,
      notchHeight: 320,
      notchTop: 80,
      cornerRadius: 16,
      flareRadius: 24,
    });

    expect(path).toBeDefined();
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("C"); // Uses cubic bezier curves
  });

  it("handles default radii when omitted", () => {
    const path = generateRightEdgeNotchPath({
      totalWidth: 400,
      totalHeight: 600,
      notchWidth: 90,
      notchHeight: 300,
      notchTop: 100,
    });

    expect(path).toBeDefined();
    expect(path).toContain("M 400 100");
  });

  it("clamps radii if notch height is small", () => {
    const path = generateRightEdgeNotchPath({
      totalWidth: 300,
      totalHeight: 400,
      notchWidth: 70,
      notchHeight: 40,
      notchTop: 50,
      cornerRadius: 30,
      flareRadius: 30,
    });

    expect(path).toBeDefined();
    expect(path.startsWith("M")).toBe(true);
  });
});
