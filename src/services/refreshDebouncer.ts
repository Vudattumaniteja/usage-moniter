import { ProviderId } from "../types";

export interface RefreshDebouncerOptions {
  onRefresh: (providerId: ProviderId) => Promise<void> | void;
  debounceWindowMs?: number;
}

interface ProviderDebounceState {
  lastExecutedTime: number;
  timer: NodeJS.Timeout | number | null;
  hasPendingTrailing: boolean;
}

/**
 * On-demand refresh debouncer with immediate leading-edge execution and coalesced trailing edge.
 * Enforces a 5-second debounce window on hover or click of any usage ring.
 */
export class OnDemandRefreshDebouncer {
  private onRefresh: (providerId: ProviderId) => Promise<void> | void;
  private debounceWindowMs: number;
  private states: Map<ProviderId, ProviderDebounceState> = new Map();

  constructor(options: RefreshDebouncerOptions) {
    this.onRefresh = options.onRefresh;
    this.debounceWindowMs = options.debounceWindowMs ?? 5000;
  }

  private getState(providerId: ProviderId): ProviderDebounceState {
    let state = this.states.get(providerId);
    if (!state) {
      state = {
        lastExecutedTime: 0,
        timer: null,
        hasPendingTrailing: false,
      };
      this.states.set(providerId, state);
    }
    return state;
  }

  async trigger(providerId: ProviderId): Promise<void> {
    const now = Date.now();
    const state = this.getState(providerId);
    const timeSinceLast = now - state.lastExecutedTime;

    // Case 1: Outside debounce window -> Immediate execution
    if (timeSinceLast >= this.debounceWindowMs && !state.timer) {
      state.lastExecutedTime = now;
      state.hasPendingTrailing = false;
      await this.onRefresh(providerId);
      return;
    }

    // Case 2: Inside debounce window -> Coalesce into trailing execution
    state.hasPendingTrailing = true;

    if (!state.timer) {
      const remainingTime = Math.max(0, this.debounceWindowMs - timeSinceLast);
      state.timer = setTimeout(async () => {
        state.timer = null;
        if (state.hasPendingTrailing) {
          state.hasPendingTrailing = false;
          state.lastExecutedTime = Date.now();
          await this.onRefresh(providerId);
        }
      }, remainingTime);
    }
  }

  isPending(providerId: ProviderId): boolean {
    const state = this.states.get(providerId);
    return Boolean(state?.hasPendingTrailing || state?.timer);
  }

  getLastExecutedTime(providerId: ProviderId): number | undefined {
    return this.states.get(providerId)?.lastExecutedTime;
  }

  cancel(providerId: ProviderId): void {
    const state = this.states.get(providerId);
    if (state) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      state.hasPendingTrailing = false;
    }
  }

  cancelAll(): void {
    for (const [providerId] of this.states) {
      this.cancel(providerId);
    }
    this.states.clear();
  }
}
