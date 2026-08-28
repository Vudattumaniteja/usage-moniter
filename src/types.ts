/**
 * Domain model types for Windows AI Usage Notch Monitor.
 * Derived from CONTEXT.md and provider research specifications.
 */

export type ProviderId = "antigravity" | "codex" | "claude" | string;

export type ProviderStatus = "ok" | "warning" | "exhausted" | "unauthenticated" | "error";

export type DockEdge = "right" | "top" | "left" | "bottom";

/**
 * Normalized data record for an AI provider.
 */
export interface UsageSnapshot {
  provider: ProviderId;
  sessionUsedPercent: number;
  sessionResetTime: string | number | null;
  modelUsedPercent?: number | null;
  modelResetTime?: string | number | null;
  status: ProviderStatus;
  updatedAt?: number;
  errorMessage?: string | null;
  planType?: string | null;
}

/**
 * Progress gauge view model for the circular ring inside the Notch.
 */
export interface UsageRing {
  provider: ProviderId;
  label: string;
  sessionUsedPercent: number;
  modelUsedPercent?: number | null;
  status: ProviderStatus;
  accentColor?: string;
}

/**
 * Expanded view model for detailed quota, breakdown, and reset timers.
 */
export interface PopoverCard {
  provider: ProviderId;
  title: string;
  sessionUsedPercent: number;
  sessionResetFormatted: string;
  modelUsedPercent?: number | null;
  modelResetFormatted?: string | null;
  status: ProviderStatus;
  statusMessage?: string;
  planType?: string;
}

/**
 * State and configuration for the screen-edge docked overlay window.
 */
export interface Notch {
  dockEdge: DockEdge;
  isExpanded: boolean;
  activePopoverProvider: ProviderId | null;
  snapshots: Record<ProviderId, UsageSnapshot>;
  isAlwaysOnTop: boolean;
}

/**
 * Adapter interface for extracting and normalizing provider metrics.
 */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;
  fetchUsage(): Promise<UsageSnapshot>;
}
