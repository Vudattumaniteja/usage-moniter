import React, { useEffect } from "react";
import { Notch } from "./components/Notch";
import { DEFAULT_PROTOTYPE_SNAPSHOTS } from "./prototype/mockData";
import { ProviderId, UsageSnapshot } from "./types";
import { useSnapshotCache } from "./hooks/useSnapshotCache";
import { antigravityAdapter } from "./services/antigravityAdapter";
import { codexAdapter } from "./services/codexAdapter";
import { dockOverlayWindow } from "./services/windowDocking";
import { defaultNetworkMonitor } from "./services/networkMonitor";

export const App: React.FC = () => {
  const {
    snapshots,
    syncStates,
    onLivePollSuccess,
  } = useSnapshotCache({
    initialSnapshots: DEFAULT_PROTOTYPE_SNAPSHOTS,
  });

  // Dock overlay window to right edge of primary display on startup & resize
  useEffect(() => {
    dockOverlayWindow({ edge: "right", alignment: "center" });

    const handleResize = () => {
      dockOverlayWindow({ edge: "right", alignment: "center" });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Subscribe to live Antigravity Connect-RPC, Codex polling, and network online/offline events
  useEffect(() => {
    defaultNetworkMonitor.startMonitoring();

    const unsubAntigravity = antigravityAdapter.subscribe((snapshot) => {
      if (snapshot.status !== "error" || snapshot.sessionUsedPercent > 0) {
        onLivePollSuccess(snapshot);
      }
    });

    const unsubCodex = codexAdapter.subscribe((snapshot) => {
      if (snapshot.status !== "error" || snapshot.sessionUsedPercent > 0) {
        onLivePollSuccess(snapshot);
      }
    });

    const unsubNetwork = defaultNetworkMonitor.subscribe((online) => {
      codexAdapter.handleNetworkStatusChange(online);
    });

    antigravityAdapter.startPolling();
    codexAdapter.startPolling();

    return () => {
      unsubAntigravity();
      unsubCodex();
      unsubNetwork();
      antigravityAdapter.stopPolling();
      codexAdapter.stopPolling();
      defaultNetworkMonitor.stopMonitoring();
    };
  }, [onLivePollSuccess]);

  const handleOnDemandRefresh = async (providerId: ProviderId) => {
    if (providerId === "antigravity") {
      const refreshed = await antigravityAdapter.refreshNow();
      if (refreshed.status !== "error" || refreshed.sessionUsedPercent > 0) {
        onLivePollSuccess(refreshed);
      }
    } else if (providerId === "codex") {
      const refreshed = await codexAdapter.refreshNow();
      if (refreshed.status !== "error" || refreshed.sessionUsedPercent > 0) {
        onLivePollSuccess(refreshed);
      }
    }
  };

  const handleVerificationPoll = async (providerId: ProviderId) => {
    if (providerId === "antigravity") {
      const refreshed = await antigravityAdapter.refreshNow();
      if (refreshed.status !== "error" || refreshed.sessionUsedPercent > 0) {
        onLivePollSuccess(refreshed);
        return;
      }
    } else if (providerId === "codex") {
      const refreshed = await codexAdapter.refreshNow();
      if (refreshed.status !== "error" || refreshed.sessionUsedPercent > 0) {
        onLivePollSuccess(refreshed);
        return;
      }
    }

    const current = snapshots[providerId];
    if (current) {
      const refreshed: UsageSnapshot = {
        ...current,
        sessionUsedPercent: current.sessionUsedPercent >= 100 ? 0 : current.sessionUsedPercent,
        status: current.status === "exhausted" ? "ok" : current.status,
        sessionResetTime: null,
      };
      onLivePollSuccess(refreshed);
    }
  };

  const isTauri =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden ${
        isTauri ? "bg-transparent" : "bg-[#0c0d12]"
      } pointer-events-none flex items-center justify-end`}
    >
      <main className="w-full h-full flex items-center justify-end">
        <Notch
          snapshots={snapshots}
          syncStates={syncStates}
          onRefresh={handleOnDemandRefresh}
          onVerificationPoll={handleVerificationPoll}
        />
      </main>
    </div>
  );
};

