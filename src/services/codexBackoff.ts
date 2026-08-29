/**
 * Exponential backoff steps for Codex rate limiting (HTTP 429).
 * Sequence: 30s -> 60s -> 120s -> 300s max
 */
export const CODEX_BACKOFF_STEPS_MS: readonly number[] = [
  30_000,
  60_000,
  120_000,
  300_000,
];

export const MAX_BACKOFF_MS = 300_000;

/**
 * Calculates backoff delay based on attempt count or Retry-After header.
 */
export function calculateBackoffDelay(
  attempt: number,
  retryAfter?: string | number | null
): number {
  if (retryAfter !== undefined && retryAfter !== null) {
    const parsedSeconds =
      typeof retryAfter === "number" ? retryAfter : parseFloat(retryAfter);
    if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
      return Math.round(parsedSeconds * 1000);
    }
  }

  const boundedIndex = Math.min(
    Math.max(0, attempt),
    CODEX_BACKOFF_STEPS_MS.length - 1
  );
  return CODEX_BACKOFF_STEPS_MS[boundedIndex];
}

/**
 * Stateful backoff manager tracking retry attempts and computing next delays.
 */
export class CodexBackoffManager {
  private attemptCount: number = 0;

  /**
   * Returns next backoff delay in ms and increments attempt count.
   */
  nextDelay(retryAfter?: string | number | null): number {
    const delay = calculateBackoffDelay(this.attemptCount, retryAfter);
    this.attemptCount++;
    return delay;
  }

  /**
   * Resets attempt count back to 0 on successful response.
   */
  reset(): void {
    this.attemptCount = 0;
  }

  getAttemptCount(): number {
    return this.attemptCount;
  }
}
