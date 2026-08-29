import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateDockPosition,
  calculateRightEdgeDockPosition,
  DisplayBounds,
  WindowDimensions,
  dockOverlayWindow,
} from "./windowDocking";

describe("windowDocking", () => {
  const primaryDisplay: DisplayBounds = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scaleFactor: 1.0,
  };

  const overlayDimensions: WindowDimensions = {
    width: 360,
    height: 580,
  };

  describe("calculateRightEdgeDockPosition", () => {
    it("pins window precisely to the right edge and vertically centered on standard 1080p display", () => {
      const result = calculateRightEdgeDockPosition(primaryDisplay, overlayDimensions);

      // x = 1920 - 360 = 1560
      expect(result.x).toBe(1560);
      // y = (1080 - 580) / 2 = 250
      expect(result.y).toBe(250);
      expect(result.width).toBe(360);
      expect(result.height).toBe(580);
    });

    it("calculates docking correctly on high-DPI 4K display", () => {
      const display4k: DisplayBounds = {
        x: 0,
        y: 0,
        width: 3840,
        height: 2160,
        scaleFactor: 2.0,
      };

      const result = calculateRightEdgeDockPosition(display4k, overlayDimensions);

      // x = 3840 - 360 = 3480
      expect(result.x).toBe(3480);
      // y = (2160 - 580) / 2 = 790
      expect(result.y).toBe(790);
    });

    it("handles secondary monitor with coordinate offset (multi-monitor setup)", () => {
      const secondaryRightDisplay: DisplayBounds = {
        x: 1920,
        y: 0,
        width: 2560,
        height: 1440,
      };

      const result = calculateRightEdgeDockPosition(secondaryRightDisplay, overlayDimensions);

      // x = 1920 + 2560 - 360 = 4120
      expect(result.x).toBe(4120);
      // y = 0 + (1440 - 580) / 2 = 430
      expect(result.y).toBe(430);
    });

    it("supports custom vertical alignment (start, center, end) and offsets", () => {
      const startDock = calculateRightEdgeDockPosition(primaryDisplay, overlayDimensions, {
        alignment: "start",
        verticalOffset: 40,
      });
      expect(startDock.y).toBe(40);

      const endDock = calculateRightEdgeDockPosition(primaryDisplay, overlayDimensions, {
        alignment: "end",
        verticalOffset: -20,
      });
      // 1080 - 580 - 20 = 480
      expect(endDock.y).toBe(480);
    });

    it("clamps position within monitor boundaries if overlay dimensions exceed display", () => {
      const smallDisplay: DisplayBounds = {
        x: 0,
        y: 0,
        width: 300,
        height: 400,
      };

      const result = calculateRightEdgeDockPosition(smallDisplay, overlayDimensions);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe("calculateDockPosition", () => {
    it("supports top edge docking", () => {
      const result = calculateDockPosition(primaryDisplay, overlayDimensions, {
        edge: "top",
        alignment: "center",
      });

      // x = (1920 - 360) / 2 = 780
      expect(result.x).toBe(780);
      expect(result.y).toBe(0);
    });

    it("supports left edge docking", () => {
      const result = calculateDockPosition(primaryDisplay, overlayDimensions, {
        edge: "left",
        alignment: "center",
      });

      expect(result.x).toBe(0);
      expect(result.y).toBe(250);
    });
  });

  describe("dockOverlayWindow", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("falls back gracefully when Tauri API is unavailable in browser", async () => {
      const result = await dockOverlayWindow();
      expect(result).toBeNull();
    });
  });
});
