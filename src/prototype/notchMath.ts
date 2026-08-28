export interface NotchPathOptions {
  totalWidth: number;
  totalHeight: number;
  notchWidth: number;
  notchHeight: number;
  notchTop: number;
  cornerRadius?: number;
  flareRadius?: number;
}

/**
 * Generates an SVG path string for a right-edge docked curved notch overlay.
 * Uses cubic Bezier curves to create organic smooth fillets transitioning from
 * the screen boundary into the floating notch body.
 */
export function generateRightEdgeNotchPath(options: NotchPathOptions): string {
  const {
    totalWidth: W,
    notchWidth: nw,
    notchHeight: nh,
    notchTop: nt,
    cornerRadius: rawCorner = 18,
    flareRadius: rawFlare = 28,
  } = options;

  // Clamp radii to fit within available notch dimensions
  const maxRadius = Math.max(2, Math.floor(nh / 4));
  const flare = Math.min(rawFlare, maxRadius);
  const corner = Math.min(rawCorner, maxRadius);

  const xRight = W;
  const xLeft = W - nw;
  const yTop = nt;
  const yBottom = nt + nh;

  // Control points for smooth organic cubic fillets
  // Start at screen right edge top
  const path: string[] = [
    `M ${xRight} ${yTop}`,
    // Smooth flare entering from the right edge inward
    `C ${xRight - flare * 0.5} ${yTop}, ${xLeft + corner + flare * 0.4} ${yTop + flare * 0.4}, ${xLeft + corner} ${yTop + flare}`,
    // Rounding into the straight left edge
    `C ${xLeft} ${yTop + flare + corner * 0.5}, ${xLeft} ${yTop + flare + corner}, ${xLeft} ${yTop + flare + corner}`,
    // Straight vertical left edge
    `L ${xLeft} ${yBottom - flare - corner}`,
    // Rounding out of the left edge
    `C ${xLeft} ${yBottom - flare - corner * 0.5}, ${xLeft + corner} ${yBottom - flare}, ${xLeft + corner} ${yBottom - flare}`,
    // Smooth flare returning out to the right edge
    `C ${xLeft + corner + flare * 0.4} ${yBottom - flare * 0.4}, ${xRight - flare * 0.5} ${yBottom}, ${xRight} ${yBottom}`,
    // Close along right screen boundary
    `L ${xRight} ${yTop}`,
    `Z`,
  ];

  return path.join(" ");
}

/**
 * Generates an SVG path for the visible exposed border of the notch
 * (excluding the right edge flush with the display boundary).
 */
export function generateNotchBorderPath(options: NotchPathOptions): string {
  const {
    totalWidth: W,
    notchWidth: nw,
    notchHeight: nh,
    notchTop: nt,
    cornerRadius: rawCorner = 18,
    flareRadius: rawFlare = 28,
  } = options;

  const maxRadius = Math.max(2, Math.floor(nh / 4));
  const flare = Math.min(rawFlare, maxRadius);
  const corner = Math.min(rawCorner, maxRadius);

  const xRight = W;
  const xLeft = W - nw;
  const yTop = nt;
  const yBottom = nt + nh;

  const path: string[] = [
    `M ${xRight} ${yTop}`,
    `C ${xRight - flare * 0.5} ${yTop}, ${xLeft + corner + flare * 0.4} ${yTop + flare * 0.4}, ${xLeft + corner} ${yTop + flare}`,
    `C ${xLeft} ${yTop + flare + corner * 0.5}, ${xLeft} ${yTop + flare + corner}, ${xLeft} ${yTop + flare + corner}`,
    `L ${xLeft} ${yBottom - flare - corner}`,
    `C ${xLeft} ${yBottom - flare - corner * 0.5}, ${xLeft + corner} ${yBottom - flare}, ${xLeft + corner} ${yBottom - flare}`,
    `C ${xLeft + corner + flare * 0.4} ${yBottom - flare * 0.4}, ${xRight - flare * 0.5} ${yBottom}, ${xRight} ${yBottom}`,
  ];

  return path.join(" ");
}
