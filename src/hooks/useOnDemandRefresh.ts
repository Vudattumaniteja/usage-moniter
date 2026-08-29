import { useRef, useEffect, useCallback } from "react";
import { ProviderId } from "../types";
import { OnDemandRefreshDebouncer } from "../services/refreshDebouncer";

export interface UseOnDemandRefreshOptions {
  onRefresh?: (providerId: ProviderId) => Promise<void> | void;
  debounceWindowMs?: number;
}

export function useOnDemandRefresh(options: UseOnDemandRefreshOptions = {}) {
  const { onRefresh, debounceWindowMs = 5000 } = options;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const debouncerRef = useRef<OnDemandRefreshDebouncer | null>(null);

  if (!debouncerRef.current) {
    debouncerRef.current = new OnDemandRefreshDebouncer({
      onRefresh: (pId) => onRefreshRef.current?.(pId),
      debounceWindowMs,
    });
  }

  useEffect(() => {
    const debouncer = debouncerRef.current;
    return () => {
      debouncer?.cancelAll();
    };
  }, []);

  const triggerOnDemandRefresh = useCallback(
    async (providerId: ProviderId) => {
      if (debouncerRef.current) {
        await debouncerRef.current.trigger(providerId);
      }
    },
    []
  );

  return {
    triggerOnDemandRefresh,
  };
}
