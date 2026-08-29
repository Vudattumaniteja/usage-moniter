/**
 * Window docking calculations and desktop positioning management.
 * Positions the frameless transparent overlay window pinned to the screen edge.
 */

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor?: number;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export type DockEdge = "right" | "left" | "top" | "bottom";
export type DockAlignment = "center" | "start" | "end";

export interface DockOptions {
  edge?: DockEdge;
  alignment?: DockAlignment;
  verticalOffset?: number;
  horizontalOffset?: number;
  margin?: number;
}

export interface DockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the exact desktop coordinates to dock an overlay window to the right edge.
 */
export function calculateRightEdgeDockPosition(
  display: DisplayBounds,
  windowDim: WindowDimensions,
  options: DockOptions = {}
): DockPosition {
  return calculateDockPosition(display, windowDim, {
    ...options,
    edge: "right",
  });
}

/**
 * Calculates desktop coordinates for any edge dock configuration.
 */
export function calculateDockPosition(
  display: DisplayBounds,
  windowDim: WindowDimensions,
  options: DockOptions = {}
): DockPosition {
  const edge = options.edge ?? "right";
  const alignment = options.alignment ?? "center";
  const verticalOffset = options.verticalOffset ?? 0;
  const horizontalOffset = options.horizontalOffset ?? 0;
  const margin = options.margin ?? 0;

  const winW = Math.min(windowDim.width, display.width);
  const winH = Math.min(windowDim.height, display.height);

  let x = display.x;
  let y = display.y;

  if (edge === "right") {
    x = display.x + display.width - winW - margin + horizontalOffset;
    if (alignment === "center") {
      y = display.y + Math.round((display.height - winH) / 2) + verticalOffset;
    } else if (alignment === "start") {
      y = display.y + margin + verticalOffset;
    } else if (alignment === "end") {
      y = display.y + display.height - winH - margin + verticalOffset;
    }
  } else if (edge === "left") {
    x = display.x + margin + horizontalOffset;
    if (alignment === "center") {
      y = display.y + Math.round((display.height - winH) / 2) + verticalOffset;
    } else if (alignment === "start") {
      y = display.y + margin + verticalOffset;
    } else if (alignment === "end") {
      y = display.y + display.height - winH - margin + verticalOffset;
    }
  } else if (edge === "top") {
    y = display.y + margin + verticalOffset;
    if (alignment === "center") {
      x = display.x + Math.round((display.width - winW) / 2) + horizontalOffset;
    } else if (alignment === "start") {
      x = display.x + margin + horizontalOffset;
    } else if (alignment === "end") {
      x = display.x + display.width - winW - margin + horizontalOffset;
    }
  } else if (edge === "bottom") {
    y = display.y + display.height - winH - margin + verticalOffset;
    if (alignment === "center") {
      x = display.x + Math.round((display.width - winW) / 2) + horizontalOffset;
    } else if (alignment === "start") {
      x = display.x + margin + horizontalOffset;
    } else if (alignment === "end") {
      x = display.x + display.width - winW - margin + horizontalOffset;
    }
  }

  // Ensure within bounds
  const minX = display.x;
  const maxX = display.x + Math.max(0, display.width - winW);
  const minY = display.y;
  const maxY = display.y + Math.max(0, display.height - winH);

  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));

  return {
    x,
    y,
    width: winW,
    height: winH,
  };
}

/**
 * Triggers Tauri backend to position the overlay window pinned to the right edge.
 */
export async function dockOverlayWindow(
  options: DockOptions = {}
): Promise<DockPosition | null> {
  if (
    typeof window === "undefined" ||
    !("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  ) {
    return null;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<DockPosition | null>("dock_overlay_window", {
      options: {
        edge: options.edge ?? "right",
        alignment: options.alignment ?? "center",
        verticalOffset: options.verticalOffset ?? 0,
      },
    });
    return result;
  } catch (err) {
    console.warn("Failed to dock overlay window via Tauri:", err);
    return null;
  }
}
