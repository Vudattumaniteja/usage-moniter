import { ProviderId, ProviderStatus, UsageSnapshot } from "../types";

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  shortName: string;
  tagline: string;
  brandColor: string;
  accentGradient: string;
  sessionWindowLabel: string;
  modelWindowLabel: string;
  defaultPlan: string;
}

export const PROVIDER_METADATA: Record<string, ProviderMeta> = {
  antigravity: {
    id: "antigravity",
    name: "Antigravity Usage",
    shortName: "AGY",
    tagline: "Google Advanced Agentic Coding",
    brandColor: "#38bdf8", // Sky blue
    accentGradient: "from-sky-400 to-cyan-500",
    sessionWindowLabel: "Current session (5h)",
    modelWindowLabel: "Weekly quota",
    defaultPlan: "Google AI Ultra / Pro",
  },
  codex: {
    id: "codex",
    name: "Codex / ChatGPT",
    shortName: "CDX",
    tagline: "OpenAI Codex CLI & ChatGPT",
    brandColor: "#10b981", // Emerald Green
    accentGradient: "from-emerald-500 to-teal-400",
    sessionWindowLabel: "Current session (3h)",
    modelWindowLabel: "All models",
    defaultPlan: "ChatGPT Plus (GPT-4o)",
  },
};

const NOW = Date.now();

export const DEFAULT_PROTOTYPE_SNAPSHOTS: Record<ProviderId, UsageSnapshot> = {
  antigravity: {
    provider: "antigravity",
    sessionUsedPercent: 68,
    sessionResetTime: NOW + 1000 * (60 * 102), // 1h 42m
    modelUsedPercent: 35,
    modelResetTime: NOW + 1000 * (60 * 60 * 24 * 4), // 4 days
    status: "ok",
    planType: "Google AI Ultra",
    updatedAt: NOW - 12000,
  },
  codex: {
    provider: "codex",
    sessionUsedPercent: 86,
    sessionResetTime: NOW + 1000 * (60 * 28), // 28m
    modelUsedPercent: 62,
    modelResetTime: NOW + 1000 * (60 * 60 * 24 * 2), // 2 days
    status: "warning",
    planType: "ChatGPT Plus",
    updatedAt: NOW - 5000,
  },
};

export function updateMockSnapshot(
  current: Record<ProviderId, UsageSnapshot>,
  provider: ProviderId,
  updates: Partial<UsageSnapshot>
): Record<ProviderId, UsageSnapshot> {
  const existing = current[provider] || {
    provider,
    sessionUsedPercent: 0,
    sessionResetTime: null,
    status: "ok" as ProviderStatus,
  };

  const clampedSession =
    updates.sessionUsedPercent !== undefined
      ? Math.max(0, Math.min(100, Math.round(updates.sessionUsedPercent)))
      : existing.sessionUsedPercent;

  const clampedModel =
    updates.modelUsedPercent !== undefined && updates.modelUsedPercent !== null
      ? Math.max(0, Math.min(100, Math.round(updates.modelUsedPercent)))
      : existing.modelUsedPercent;

  let autoStatus: ProviderStatus = updates.status || existing.status;
  if (!updates.status && updates.sessionUsedPercent !== undefined) {
    if (clampedSession >= 95) {
      autoStatus = "exhausted";
    } else if (clampedSession >= 80) {
      autoStatus = "warning";
    } else {
      autoStatus = "ok";
    }
  }

  return {
    ...current,
    [provider]: {
      ...existing,
      ...updates,
      sessionUsedPercent: clampedSession,
      modelUsedPercent: clampedModel,
      status: autoStatus,
      updatedAt: Date.now(),
    },
  };
}

export function getMockProviderList(snapshots: Record<ProviderId, UsageSnapshot>) {
  return Object.keys(snapshots).map((id) => ({
    id,
    snapshot: snapshots[id],
    meta: PROVIDER_METADATA[id] || {
      id,
      name: id,
      shortName: id.slice(0, 3).toUpperCase(),
      tagline: "Custom Provider",
      brandColor: "#94a3b8",
      accentGradient: "from-slate-500 to-slate-400",
      sessionWindowLabel: "Current session",
      modelWindowLabel: "All models",
      defaultPlan: "Standard",
    },
  }));
}
