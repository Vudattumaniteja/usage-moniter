import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ProviderId, UsageSnapshot } from "../types";
import { formatResetCountdown } from "../models/normalizers";

export interface ProviderCountdownState {
  sessionResetFormatted: string;
  modelResetFormatted: string | null;
  sessionRemainingMs: number;
  modelRemainingMs: number | null;
  isSessionExpired: boolean;
  isModelExpired: boolean;
  isGraceRetrying: boolean;
}

export interface UseCountdownInterpolationOptions {
  snapshots: Record<ProviderId, UsageSnapshot>;
  onVerificationPoll?: (providerId: ProviderId) => void | Promise<void>;
  tickIntervalMs?: number; // default 1000ms
  graceWindowMs?: number; // default 15000ms (15s)
  referenceNow?: number;
  enabled?: boolean;
}

export interface UseCountdownInterpolationResult {
  countdowns: Record<ProviderId, ProviderCountdownState>;
  referenceNow: number;
  triggerZeroVerification: (providerId: ProviderId) => Promise<void>;
}

function parseTargetMs(resetTime: string | number | null | undefined): number | null {
  if (!resetTime) return null;
  if (typeof resetTime === "number") {
    return resetTime < 100_000_000_000 ? resetTime * 1000 : resetTime;
  }
  const parsed = Date.parse(resetTime);
  return isNaN(parsed) ? null : parsed;
}

function isQuotaExhausted(snapshot: UsageSnapshot): boolean {
  return snapshot.status === "exhausted" || snapshot.sessionUsedPercent >= 100;
}

export function useCountdownInterpolation({
  snapshots,
  onVerificationPoll,
  tickIntervalMs = 1000,
  graceWindowMs = 15000,
  referenceNow: initialReferenceNow,
  enabled = true,
}: UseCountdownInterpolationOptions): UseCountdownInterpolationResult {
  const [now, setNow] = useState<number>(() => initialReferenceNow ?? Date.now());
  const [graceRetryingProviders, setGraceRetryingProviders] = useState<Record<ProviderId, boolean>>({});

  const onVerificationPollRef = useRef(onVerificationPoll);
  onVerificationPollRef.current = onVerificationPoll;

  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  // Track the target timestamps that have been armed (future when seen) and expired
  const armedTargetsRef = useRef<Record<ProviderId, { targetMs: number; triggered: boolean } | null>>({});
  const graceTimersRef = useRef<Record<ProviderId, NodeJS.Timeout | number | null>>({});

  // 1-second client-side clock tick
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, tickIntervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, tickIntervalMs]);

  // Synchronize snapshots with armed targets and cancel grace timers if replenished
  useEffect(() => {
    const currentNow = Date.now();
    for (const [providerId, snapshot] of Object.entries(snapshots)) {
      const targetMs = parseTargetMs(snapshot.sessionResetTime);
      const isExhausted = isQuotaExhausted(snapshot);

      // Cancel pending grace retry if quota has replenished
      if (!isExhausted && graceTimersRef.current[providerId]) {
        clearTimeout(graceTimersRef.current[providerId] as NodeJS.Timeout);
        graceTimersRef.current[providerId] = null;
        setGraceRetryingProviders((prev) => {
          if (!prev[providerId]) return prev;
          const next = { ...prev };
          delete next[providerId];
          return next;
        });
      }

      if (targetMs !== null && targetMs > currentNow) {
        // Arm future countdown
        armedTargetsRef.current[providerId] = {
          targetMs,
          triggered: false,
        };
      } else if (targetMs === null) {
        armedTargetsRef.current[providerId] = null;
      }
    }
  }, [snapshots]);

  // Check for zero-expiry triggers on each tick
  useEffect(() => {
    if (!enabled) return;

    for (const [providerId, armed] of Object.entries(armedTargetsRef.current)) {
      if (!armed || armed.triggered) continue;

      if (now >= armed.targetMs) {
        armed.triggered = true;

        // Immediate verification poll at zero expiry
        onVerificationPollRef.current?.(providerId);

        const currentSnapshot = snapshotsRef.current[providerId];
        if (currentSnapshot && isQuotaExhausted(currentSnapshot)) {
          // Schedule a single retry after 15-second grace window
          setGraceRetryingProviders((prev) => ({ ...prev, [providerId]: true }));

          if (graceTimersRef.current[providerId]) {
            clearTimeout(graceTimersRef.current[providerId] as NodeJS.Timeout);
          }

          graceTimersRef.current[providerId] = setTimeout(() => {
            graceTimersRef.current[providerId] = null;
            setGraceRetryingProviders((prev) => {
              const next = { ...prev };
              delete next[providerId];
              return next;
            });
            onVerificationPollRef.current?.(providerId);
          }, graceWindowMs);
        }
      }
    }
  }, [now, enabled, graceWindowMs]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const providerId of Object.keys(graceTimersRef.current)) {
        if (graceTimersRef.current[providerId]) {
          clearTimeout(graceTimersRef.current[providerId] as NodeJS.Timeout);
        }
      }
    };
  }, []);

  const triggerZeroVerification = useCallback(async (providerId: ProviderId) => {
    await onVerificationPollRef.current?.(providerId);
  }, []);

  const countdowns = useMemo(() => {
    const result: Record<ProviderId, ProviderCountdownState> = {};

    for (const [providerId, snapshot] of Object.entries(snapshots)) {
      const sessionTargetMs = parseTargetMs(snapshot.sessionResetTime);
      const modelTargetMs = parseTargetMs(snapshot.modelResetTime);

      const sessionRemainingMs = sessionTargetMs !== null ? Math.max(0, sessionTargetMs - now) : 0;
      const modelRemainingMs = modelTargetMs !== null ? Math.max(0, modelTargetMs - now) : null;

      result[providerId] = {
        sessionResetFormatted: formatResetCountdown(snapshot.sessionResetTime, now),
        modelResetFormatted: snapshot.modelResetTime ? formatResetCountdown(snapshot.modelResetTime, now) : null,
        sessionRemainingMs,
        modelRemainingMs,
        isSessionExpired: sessionRemainingMs <= 0,
        isModelExpired: modelRemainingMs !== null ? modelRemainingMs <= 0 : false,
        isGraceRetrying: Boolean(graceRetryingProviders[providerId]),
      };
    }

    return result;
  }, [snapshots, now, graceRetryingProviders]);

  return {
    countdowns,
    referenceNow: now,
    triggerZeroVerification,
  };
}

export interface UseProviderCountdownOptions {
  snapshot?: UsageSnapshot | null;
  onVerificationPoll?: (providerId: ProviderId) => void | Promise<void>;
  tickIntervalMs?: number;
  graceWindowMs?: number;
  referenceNow?: number;
  enabled?: boolean;
}

export function useProviderCountdown(options: UseProviderCountdownOptions) {
  const snapshots = useMemo(() => {
    if (!options.snapshot) return {};
    return { [options.snapshot.provider]: options.snapshot };
  }, [options.snapshot]);

  const interpolation = useCountdownInterpolation({
    ...options,
    snapshots,
  });

  const countdown = options.snapshot ? interpolation.countdowns[options.snapshot.provider] : null;

  return {
    countdown,
    referenceNow: interpolation.referenceNow,
    triggerZeroVerification: interpolation.triggerZeroVerification,
  };
}

