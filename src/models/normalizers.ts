import { ProviderStatus, UsageSnapshot } from "../types";

export interface StatusOptions {
  isAuthError?: boolean;
  isNetworkError?: boolean;
}

/**
 * Calculates provider status based on quota utilization and error flags.
 */
export function deriveProviderStatus(
  usedPercent: number,
  options?: StatusOptions
): ProviderStatus {
  if (options?.isAuthError) {
    return "unauthenticated";
  }
  if (options?.isNetworkError) {
    return "error";
  }
  if (usedPercent >= 100) {
    return "exhausted";
  }
  if (usedPercent >= 80) {
    return "warning";
  }
  return "ok";
}

/**
 * Formats a timestamp, epoch seconds, epoch ms, or ISO string into a human-friendly countdown.
 */
export function formatResetCountdown(
  resetTime: string | number | null | undefined,
  referenceNow: number = Date.now()
): string {
  if (!resetTime) {
    return "Ready";
  }

  let targetMs: number;
  if (typeof resetTime === "number") {
    // If timestamp is in seconds (< 100 billion), convert to ms
    targetMs = resetTime < 100_000_000_000 ? resetTime * 1000 : resetTime;
  } else {
    const parsed = Date.parse(resetTime);
    if (isNaN(parsed)) {
      return "Ready";
    }
    targetMs = parsed;
  }

  const diffMs = targetMs - referenceNow;
  if (diffMs <= 0) {
    return "Ready";
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays >= 1) {
    const remainingHours = totalHours % 24;
    return `${totalDays}d ${remainingHours}h`;
  }

  if (totalHours >= 1) {
    const remainingMinutes = totalMinutes % 60;
    return `${totalHours}h ${remainingMinutes}m`;
  }

  if (totalMinutes >= 1) {
    return `${totalMinutes}m`;
  }

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (totalSeconds > 0) {
    return `${totalSeconds}s`;
  }

  return "Ready";
}

interface AntigravityBucket {
  bucketId?: string;
  displayName?: string;
  description?: string;
  window?: "5h" | "weekly" | string;
  remainingFraction?: number;
  resetTime?: string;
}

interface AntigravityGroup {
  displayName?: string;
  description?: string;
  buckets?: AntigravityBucket[];
}

interface AntigravitySessionQuota {
  usedTokens?: number;
  maxTokens?: number;
  resetTimestamp?: number | string;
}

interface AntigravityModelQuota {
  modelFamily?: string;
  usedPercent?: number;
  resetTimestamp?: number | string;
}

interface AntigravityRawPayload {
  response?: {
    groups?: AntigravityGroup[];
    description?: string;
  };
  groups?: AntigravityGroup[];
  userTier?: string;
  userStatus?: {
    userEmail?: string;
    plan?: string;
  };
  sessionQuota?: AntigravitySessionQuota;
  modelQuotas?: AntigravityModelQuota[];
  error?: string;
}

/**
 * Normalizes Connect-RPC quota summary from Antigravity daemon/CLI.
 */
export function normalizeAntigravityResponse(
  raw: unknown,
  referenceNow: number = Date.now()
): UsageSnapshot {
  if (!raw || typeof raw !== "object") {
    return {
      provider: "antigravity",
      sessionUsedPercent: 0,
      sessionResetTime: null,
      status: "error",
      errorMessage: "Invalid or empty response from Antigravity service",
      updatedAt: referenceNow,
    };
  }

  const payload = raw as AntigravityRawPayload;
  const groups = payload.response?.groups || payload.groups;

  let sessionUsedPercent = 0;
  let sessionResetTime: number | string | null = null;
  let modelUsedPercent: number | null = null;
  let modelResetTime: number | string | null = null;

  if (Array.isArray(groups) && groups.length > 0) {
    const geminiGroup = groups.find((g) =>
      g.displayName?.toLowerCase().includes("gemini")
    );
    const thirdPartyGroup = groups.find((g) => {
      const lower = g.displayName?.toLowerCase() || "";
      return lower.includes("claude") || lower.includes("gpt") || lower.includes("3p");
    });

    const gemini5h = geminiGroup?.buckets?.find(
      (b) => b.window === "5h" || b.bucketId?.toLowerCase().includes("5h")
    );
    const geminiWeekly = geminiGroup?.buckets?.find(
      (b) => b.window === "weekly" || b.bucketId?.toLowerCase().includes("weekly")
    );

    const tpWeekly = thirdPartyGroup?.buckets?.find(
      (b) => b.window === "weekly" || b.bucketId?.toLowerCase().includes("weekly")
    );
    const tp5h = thirdPartyGroup?.buckets?.find(
      (b) => b.window === "5h" || b.bucketId?.toLowerCase().includes("5h")
    );

    // Primary session quota is Gemini 5h limit
    const sessionRemaining = gemini5h?.remainingFraction ?? (tp5h ? tp5h.remainingFraction : 1.0);
    sessionUsedPercent = Math.max(0, Math.min(100, Math.round((1.0 - (sessionRemaining ?? 1.0)) * 100)));
    sessionResetTime = gemini5h?.resetTime ?? tp5h?.resetTime ?? null;

    // Secondary model quota is Claude/GPT (3p) weekly limit, or Gemini weekly fallback
    const targetWeekly = tpWeekly ?? geminiWeekly;
    if (targetWeekly && targetWeekly.remainingFraction !== undefined) {
      modelUsedPercent = Math.max(
        0,
        Math.min(100, Math.round((1.0 - targetWeekly.remainingFraction) * 100))
      );
      modelResetTime = targetWeekly.resetTime ?? null;
    }
  } else if (payload.sessionQuota) {
    // Legacy fallback format
    const { usedTokens = 0, maxTokens = 1 } = payload.sessionQuota;
    sessionUsedPercent = maxTokens > 0 ? Math.round((usedTokens / maxTokens) * 100) : 0;
    sessionResetTime = payload.sessionQuota.resetTimestamp ?? null;

    if (Array.isArray(payload.modelQuotas) && payload.modelQuotas.length > 0) {
      const primaryModel = payload.modelQuotas[0];
      modelUsedPercent = primaryModel.usedPercent ?? null;
      modelResetTime = primaryModel.resetTimestamp ?? null;
    }
  }

  const maxPercent = Math.max(sessionUsedPercent, modelUsedPercent ?? 0);
  const status = deriveProviderStatus(maxPercent, {
    isNetworkError: Boolean(payload.error),
  });

  return {
    provider: "antigravity",
    sessionUsedPercent,
    sessionResetTime,
    modelUsedPercent,
    modelResetTime,
    status,
    planType: payload.userTier ?? payload.userStatus?.plan ?? null,
    errorMessage: payload.error ?? null,
    updatedAt: referenceNow,
  };
}

interface CodexWindow {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
}

interface CodexRawPayload {
  plan_type?: string;
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: CodexWindow;
    secondary_window?: CodexWindow;
  };
  error?: string;
}

export interface CodexNormalizeOptions extends StatusOptions {
  errorMessage?: string | null;
}

/**
 * Normalizes ChatGPT backend-api wham/usage rate limit payload.
 */
export function normalizeCodexResponse(
  raw: unknown,
  referenceNow: number = Date.now(),
  options?: CodexNormalizeOptions
): UsageSnapshot {
  if (options?.isAuthError) {
    return {
      provider: "codex",
      sessionUsedPercent: 0,
      sessionResetTime: null,
      modelUsedPercent: null,
      modelResetTime: null,
      status: "unauthenticated",
      planType: null,
      errorMessage: options.errorMessage ?? "Run 'codex login' in terminal",
      updatedAt: referenceNow,
    };
  }

  if (!raw || typeof raw !== "object") {
    return {
      provider: "codex",
      sessionUsedPercent: 0,
      sessionResetTime: null,
      modelUsedPercent: null,
      modelResetTime: null,
      status: "error",
      errorMessage:
        options?.errorMessage ?? "Invalid or empty response from Codex service",
      updatedAt: referenceNow,
    };
  }

  const payload = raw as CodexRawPayload;
  const primary = payload.rate_limit?.primary_window;
  const secondary = payload.rate_limit?.secondary_window;

  const sessionUsedPercent = primary?.used_percent ?? 0;
  let sessionResetTime: number | null = null;
  if (primary?.reset_at) {
    sessionResetTime = primary.reset_at * 1000;
  } else if (primary?.reset_after_seconds !== undefined) {
    sessionResetTime = referenceNow + primary.reset_after_seconds * 1000;
  }

  const modelUsedPercent = secondary?.used_percent ?? null;
  let modelResetTime: number | null = null;
  if (secondary?.reset_at) {
    modelResetTime = secondary.reset_at * 1000;
  } else if (secondary?.reset_after_seconds !== undefined) {
    modelResetTime = referenceNow + secondary.reset_after_seconds * 1000;
  }

  const maxPercent = Math.max(sessionUsedPercent, modelUsedPercent ?? 0);
  const isExhausted =
    payload.rate_limit?.limit_reached === true || maxPercent >= 100;
  const status: ProviderStatus = isExhausted
    ? "exhausted"
    : deriveProviderStatus(maxPercent, {
        isAuthError: options?.isAuthError,
        isNetworkError: Boolean(payload.error) || Boolean(options?.isNetworkError),
      });

  return {
    provider: "codex",
    sessionUsedPercent,
    sessionResetTime,
    modelUsedPercent,
    modelResetTime,
    status,
    planType: payload.plan_type ?? null,
    errorMessage: options?.errorMessage ?? payload.error ?? null,
    updatedAt: referenceNow,
  };
}

