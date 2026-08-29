import React, { useState } from "react";
import { VariantA } from "./prototype/VariantA";
import { VariantB } from "./prototype/VariantB";
import { VariantC } from "./prototype/VariantC";
import {
  PrototypeSwitcher,
  VariantOption,
  BackgroundMode,
} from "./prototype/PrototypeSwitcher";
import {
  DEFAULT_PROTOTYPE_SNAPSHOTS,
} from "./prototype/mockData";
import { ProviderId, UsageSnapshot } from "./types";
import { useSnapshotCache } from "./hooks/useSnapshotCache";

/**
 * Three variants of the Windows right-edge curved notch overlay,
 * switchable via `?variant=A|B|C` or the floating bottom switcher.
 */
const VARIANTS: VariantOption[] = [
  {
    key: "A",
    name: "Organic Curve Notch",
    description: "Smooth Bezier edge dock with dual-ring gauges and flyout popovers",
  },
  {
    key: "B",
    name: "Floating Pill Tab",
    description: "Ultra-compact edge peek bar with expandable multi-provider HUD",
  },
  {
    key: "C",
    name: "Cyber Chamfer Blade",
    description: "Angular telemetry rail with live status inspector & diagnostics",
  },
];

export const App: React.FC = () => {
  const {
    snapshots,
    syncStates,
    onLivePollSuccess,
  } = useSnapshotCache({
    initialSnapshots: DEFAULT_PROTOTYPE_SNAPSHOTS,
  });

  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("fluid");

  // Read initial variant from URL query param ?variant=
  const [currentVariant, setCurrentVariant] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("variant");
      if (v && ["A", "B", "C"].includes(v.toUpperCase())) {
        return v.toUpperCase();
      }
    }
    return "A";
  });

  const handleSelectVariant = (key: string) => {
    const upperKey = key.toUpperCase();
    setCurrentVariant(upperKey);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("variant", upperKey);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleUpdateSnapshot = (
    provider: ProviderId,
    updates: Partial<UsageSnapshot>
  ) => {
    const current = snapshots[provider] || {
      provider,
      sessionUsedPercent: 0,
      status: "ok",
    };
    const merged: UsageSnapshot = {
      ...current,
      ...updates,
      provider,
    };
    // Save to disk and update state
    onLivePollSuccess(merged);
  };

  const getBackgroundStyles = () => {
    switch (backgroundMode) {
      case "transparent":
        return "bg-transparent";
      case "fluid":
        return "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-400/80 via-[#d97706]/70 to-[#0c4a6e]";
      case "editor":
        return "bg-[#181824] bg-[radial-gradient(#2d3748_1px,transparent_1px)] [background-size:16px_16px]";
      case "wallpaper":
        return "bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950";
      case "dark":
      default:
        return "bg-slate-950/90";
    }
  };

  const handleVerificationPoll = (providerId: ProviderId) => {
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

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden transition-colors duration-300 flex items-center justify-end ${getBackgroundStyles()}`}
    >
      {/* Visual Canvas context watermark for simulated desktop environments */}
      {backgroundMode !== "transparent" && (
        <div className="absolute top-4 left-6 text-slate-500/60 pointer-events-none select-none">
          <div className="text-xs font-mono font-bold tracking-wider uppercase">
            Windows Desktop Overlay Simulator
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            Right Edge Screen Boundary &middot; Tauri Frameless Window
          </div>
        </div>
      )}

      {/* Render active prototype variant */}
      <main className="w-full h-full flex items-center justify-end">
        {currentVariant === "A" && (
          <VariantA
            snapshots={snapshots}
            syncStates={syncStates}
            onVerificationPoll={handleVerificationPoll}
          />
        )}
        {currentVariant === "B" && (
          <VariantB
            snapshots={snapshots}
            onVerificationPoll={handleVerificationPoll}
          />
        )}
        {currentVariant === "C" && (
          <VariantC
            snapshots={snapshots}
            onVerificationPoll={handleVerificationPoll}
          />
        )}
      </main>

      {/* Floating Prototype Switcher & State Controls */}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={currentVariant}
        onSelectVariant={handleSelectVariant}
        snapshots={snapshots}
        onUpdateSnapshot={handleUpdateSnapshot}
        backgroundMode={backgroundMode}
        onChangeBackground={setBackgroundMode}
      />
    </div>
  );
};
