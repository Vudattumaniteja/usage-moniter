import { PopoverCard, UsageRing, UsageSnapshot } from "../types";
import { formatResetCountdown } from "./normalizers";

const PROVIDER_LABELS: Record<string, string> = {
  antigravity: "Antigravity",
  codex: "Codex / GPT",
  claude: "Claude",
};

const PROVIDER_COLORS: Record<string, string> = {
  antigravity: "#38bdf8", // Sky blue
  codex: "#10b981", // Emerald green
  claude: "#f97316", // Orange
};

function clampPercent(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return Math.min(100, Math.max(0, Math.round(val)));
}

/**
 * Transforms a UsageSnapshot into a UsageRing view model.
 */
export function snapshotToUsageRing(snapshot: UsageSnapshot): UsageRing {
  const label = PROVIDER_LABELS[snapshot.provider] ?? snapshot.provider;
  const sessionUsedPercent = clampPercent(snapshot.sessionUsedPercent) ?? 0;
  const modelUsedPercent = clampPercent(snapshot.modelUsedPercent);

  let accentColor = PROVIDER_COLORS[snapshot.provider] ?? "#64748b";
  if (snapshot.status === "exhausted" || snapshot.status === "error") {
    accentColor = "#f43f5e"; // Rose / Red
  } else if (snapshot.status === "warning") {
    accentColor = "#f59e0b"; // Amber
  }

  return {
    provider: snapshot.provider,
    label,
    sessionUsedPercent,
    modelUsedPercent,
    status: snapshot.status,
    accentColor,
  };
}

/**
 * Generates an informative status message for the popover card.
 */
function getStatusMessage(snapshot: UsageSnapshot, resetFormatted: string): string {
  switch (snapshot.status) {
    case "exhausted":
      return `Quota exhausted - resets in ${resetFormatted}`;
    case "warning":
      return `Approaching limit (${snapshot.sessionUsedPercent}%) - resets in ${resetFormatted}`;
    case "unauthenticated":
      return "Authentication expired or missing token";
    case "error":
      return snapshot.errorMessage ?? "Failed to connect to service";
    case "ok":
    default:
      return "Quota optimal";
  }
}

/**
 * Transforms a UsageSnapshot into an expanded PopoverCard view model.
 */
export function snapshotToPopoverCard(
  snapshot: UsageSnapshot,
  referenceNow: number = Date.now()
): PopoverCard {
  const title = PROVIDER_LABELS[snapshot.provider] ?? snapshot.provider;
  const sessionResetFormatted = formatResetCountdown(snapshot.sessionResetTime, referenceNow);
  const modelResetFormatted = snapshot.modelResetTime
    ? formatResetCountdown(snapshot.modelResetTime, referenceNow)
    : null;

  const statusMessage = getStatusMessage(snapshot, sessionResetFormatted);

  return {
    provider: snapshot.provider,
    title,
    sessionUsedPercent: clampPercent(snapshot.sessionUsedPercent) ?? 0,
    sessionResetFormatted,
    modelUsedPercent: clampPercent(snapshot.modelUsedPercent),
    modelResetFormatted,
    status: snapshot.status,
    statusMessage,
    planType: snapshot.planType ?? undefined,
  };
}
