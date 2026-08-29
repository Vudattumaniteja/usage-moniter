import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPointInHitTestRegions,
  calculateNotchHitRegion,
  calculatePopoverHitRegion,
  HitTestManager,
  setWindowClickThrough,
} from "./hitTesting";

describe("hitTesting", () => {
  const totalWidth = 360;
  const totalHeight = 580;

  describe("region calculations", () => {
    it("computes the notch hit region pinned to the right edge", () => {
      const notchRegion = calculateNotchHitRegion(totalWidth, totalHeight);
      expect(notchRegion.x).toBe(284); // 360 - 76
      expect(notchRegion.y).toBe(150);
      expect(notchRegion.width).toBe(76);
      expect(notchRegion.height).toBe(250);
      expect(notchRegion.type).toBe("notch");
    });

    it("computes the popover card hit region positioned to the left of the notch", () => {
      const popoverRegion = calculatePopoverHitRegion(totalWidth, 132);
      expect(popoverRegion.x).toBe(10); // 360 - 90 - 260
      expect(popoverRegion.y).toBe(132);
      expect(popoverRegion.width).toBe(260);
      expect(popoverRegion.type).toBe("popover");
    });
  });

  describe("isPointInHitTestRegions", () => {
    const notchRegion = calculateNotchHitRegion(totalWidth, totalHeight);
    const popoverRegion = calculatePopoverHitRegion(totalWidth, 132);
    const activeRegions = [notchRegion, popoverRegion];

    it("detects points inside the Notch region as hit", () => {
      // (300, 200) is inside notch (x: 284..360, y: 150..400)
      const result = isPointInHitTestRegions(300, 200, activeRegions);
      expect(result.isHit).toBe(true);
      expect(result.regionType).toBe("notch");
    });

    it("detects points inside the Popover Card region as hit", () => {
      // (100, 180) is inside popover (x: 10..270, y: 132..372)
      const result = isPointInHitTestRegions(100, 180, activeRegions);
      expect(result.isHit).toBe(true);
      expect(result.regionType).toBe("popover");
    });

    it("detects points in transparent desktop areas as click-through (no hit)", () => {
      // (50, 50) is top-left empty space
      const resultTopLeft = isPointInHitTestRegions(50, 50, activeRegions);
      expect(resultTopLeft.isHit).toBe(false);
      expect(resultTopLeft.regionType).toBeUndefined();

      // (320, 50) is above the notch
      const resultAboveNotch = isPointInHitTestRegions(320, 50, activeRegions);
      expect(resultAboveNotch.isHit).toBe(false);

      // (320, 500) is below the notch
      const resultBelowNotch = isPointInHitTestRegions(320, 500, activeRegions);
      expect(resultBelowNotch.isHit).toBe(false);
    });

    it("returns false when no regions are registered", () => {
      const result = isPointInHitTestRegions(300, 200, []);
      expect(result.isHit).toBe(false);
    });
  });

  describe("HitTestManager", () => {
    let manager: HitTestManager;

    beforeEach(() => {
      manager = new HitTestManager();
    });

    it("registers and updates active hit-test regions", () => {
      manager.setRegions([
        calculateNotchHitRegion(totalWidth, totalHeight),
      ]);

      expect(manager.testPoint(300, 200).isHit).toBe(true);
      expect(manager.testPoint(100, 180).isHit).toBe(false);

      // Now add popover region
      manager.setPopoverRegion(calculatePopoverHitRegion(totalWidth, 132));
      expect(manager.testPoint(100, 180).isHit).toBe(true);

      // Clear popover region
      manager.setPopoverRegion(null);
      expect(manager.testPoint(100, 180).isHit).toBe(false);
    });

    it("notifies listeners on cursor pass-through state change", () => {
      const listener = vi.fn();
      const unsub = manager.subscribe(listener);

      manager.setRegions([calculateNotchHitRegion(totalWidth, totalHeight)]);

      // Move into transparent area -> clickThrough = true (ignore cursor = true)
      manager.handleMouseMove(50, 50);
      expect(listener).toHaveBeenCalledWith(true);

      // Move again within transparent area -> does NOT duplicate notification
      manager.handleMouseMove(60, 60);
      expect(listener).toHaveBeenCalledTimes(1);

      // Move into notch -> clickThrough = false (ignore cursor = false)
      manager.handleMouseMove(300, 200);
      expect(listener).toHaveBeenCalledWith(false);
      expect(listener).toHaveBeenCalledTimes(2);

      unsub();
    });
  });

  describe("setWindowClickThrough", () => {
    it("falls back gracefully when Tauri API is not running in browser", async () => {
      const result = await setWindowClickThrough(true);
      expect(result).toBe(false);
    });
  });
});
