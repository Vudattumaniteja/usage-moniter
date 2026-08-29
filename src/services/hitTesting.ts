/**
 * Overlay hit-testing and transparent click-through management.
 * Ensures mouse events are intercepted only when clicking the organic notch
 * or active popover card, passing transparent clicks through to Windows desktop.
 */

export interface HitTestRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "notch" | "popover" | "switcher" | "custom";
}

export interface HitTestResult {
  isHit: boolean;
  targetId?: string;
  regionType?: string;
}

/**
 * Calculates the bounding hit-test box for the right-edge notch.
 */
export function calculateNotchHitRegion(
  totalWidth: number,
  _totalHeight: number,
  notchWidth = 76,
  notchHeight = 250,
  notchTop = 150
): HitTestRegion {
  return {
    id: "notch-body",
    x: totalWidth - notchWidth,
    y: notchTop,
    width: notchWidth,
    height: notchHeight,
    type: "notch",
  };
}

/**
 * Calculates the bounding hit-test box for an expanded speech-bubble popover.
 */
export function calculatePopoverHitRegion(
  totalWidth: number,
  popoverYOffset: number,
  width = 260,
  height = 240,
  rightOffset = 90
): HitTestRegion {
  return {
    id: "popover-card",
    x: totalWidth - rightOffset - width,
    y: popoverYOffset,
    width,
    height,
    type: "popover",
  };
}

/**
 * Tests whether a point (x, y) falls inside any registered hit-test region.
 */
export function isPointInHitTestRegions(
  x: number,
  y: number,
  regions: HitTestRegion[]
): HitTestResult {
  for (const region of regions) {
    if (
      x >= region.x &&
      x <= region.x + region.width &&
      y >= region.y &&
      y <= region.y + region.height
    ) {
      return {
        isHit: true,
        targetId: region.id,
        regionType: region.type,
      };
    }
  }

  return { isHit: false };
}

/**
 * Invokes Tauri backend to set window click-through state.
 */
export async function setWindowClickThrough(
  ignore: boolean
): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  ) {
    return false;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const success = await invoke<boolean>("set_window_click_through", {
      ignore,
    });
    return success;
  } catch (err) {
    console.warn("Failed to set window click-through via Tauri:", err);
    return false;
  }
}

/**
 * Manager class that coordinates active overlay regions, mouse coordinates,
 * and window cursor event interception.
 */
export class HitTestManager {
  private baseRegions: HitTestRegion[] = [];
  private popoverRegion: HitTestRegion | null = null;
  private isClickThrough: boolean | null = null;
  private listeners: Set<(isClickThrough: boolean) => void> = new Set();

  setRegions(regions: HitTestRegion[]): void {
    this.baseRegions = [...regions];
  }

  setPopoverRegion(region: HitTestRegion | null): void {
    this.popoverRegion = region;
  }

  getActiveRegions(): HitTestRegion[] {
    if (this.popoverRegion) {
      return [...this.baseRegions, this.popoverRegion];
    }
    return this.baseRegions;
  }

  testPoint(x: number, y: number): HitTestResult {
    return isPointInHitTestRegions(x, y, this.getActiveRegions());
  }

  handleMouseMove(x: number, y: number): boolean {
    const hit = this.testPoint(x, y);
    const newClickThrough = !hit.isHit;

    if (this.isClickThrough !== newClickThrough) {
      this.isClickThrough = newClickThrough;
      this.notifyListeners(newClickThrough);
      setWindowClickThrough(newClickThrough).catch(() => {});
    }

    return hit.isHit;
  }

  subscribe(listener: (isClickThrough: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(isClickThrough: boolean): void {
    for (const listener of this.listeners) {
      try {
        listener(isClickThrough);
      } catch (err) {
        console.error("Error in HitTestManager listener:", err);
      }
    }
  }
}

export const overlayHitTestManager = new HitTestManager();
