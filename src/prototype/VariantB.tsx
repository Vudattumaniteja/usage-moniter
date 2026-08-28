import React, { useState } from "react";
import { Clock, Maximize2, Minimize2 } from "lucide-react";
import { ProviderId, UsageSnapshot } from "../types";
import { PROVIDER_METADATA } from "./mockData";
import { formatResetCountdown } from "../models/normalizers";

interface VariantBProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
}

export const VariantB: React.FC<VariantBProps> = ({ snapshots }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("antigravity");

  const activeSnapshots = Object.values(snapshots);
  const selectedSnap = snapshots[selectedProvider] || activeSnapshots[0];
  const selectedMeta = PROVIDER_METADATA[selectedProvider] || {
    name: selectedProvider,
    brandColor: "#38bdf8",
    sessionWindowLabel: "Session",
    modelWindowLabel: "Model limit",
    defaultPlan: "Pro",
  };

  return (
    <div className="relative w-full h-full min-h-[580px] flex items-center justify-end select-none pointer-events-none p-4">
      {/* Expanded Multi-Provider HUD Modal / Drawer */}
      {isExpanded ? (
        <div className="w-[340px] bg-slate-950/95 border border-slate-700/90 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-slate-100 z-30 pointer-events-auto animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Usage HUD Control
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                Active Providers ({activeSnapshots.length})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Collapse HUD"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Provider Segmented Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl mb-3 border border-slate-800">
            {Object.keys(snapshots).map((pId) => {
              const snap = snapshots[pId];
              const meta = PROVIDER_METADATA[pId] || { name: pId, shortName: pId.slice(0, 3) };
              const isCurrent = selectedProvider === pId;

              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => setSelectedProvider(pId)}
                  className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                    isCurrent
                      ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                  }`}
                >
                  <span className="tracking-tight">{meta.shortName}</span>
                  <span
                    className={`font-mono text-[9px] ${
                      snap.sessionUsedPercent >= 90
                        ? "text-rose-400"
                        : snap.sessionUsedPercent >= 75
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {snap.sessionUsedPercent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Provider Detail Card */}
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-tight">
                {selectedMeta.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {selectedSnap.planType || selectedMeta.defaultPlan}
              </span>
            </div>

            {/* Session Quota Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">
                  {selectedMeta.sessionWindowLabel}
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {selectedSnap.sessionUsedPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${selectedSnap.sessionUsedPercent}%`,
                    backgroundColor:
                      selectedSnap.status === "exhausted"
                        ? "#f43f5e"
                        : selectedSnap.status === "warning"
                        ? "#f59e0b"
                        : selectedMeta.brandColor,
                  }}
                />
              </div>
            </div>

            {/* Reset Time */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Next Reset
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {formatResetCountdown(selectedSnap.sessionResetTime)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Pill Tab */
        <div className="bg-slate-950/90 border border-slate-700/80 rounded-2xl p-2 shadow-2xl backdrop-blur-xl pointer-events-auto flex flex-col items-center gap-2 mr-1">
          {/* Header Expand Affordance */}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand HUD"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Expand into full HUD"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          </button>

          <div className="w-full h-px bg-slate-800" />

          {/* Provider Micro Bars */}
          {Object.keys(snapshots).map((pId) => {
            const snap = snapshots[pId];
            const meta = PROVIDER_METADATA[pId] || { name: pId, shortName: pId.slice(0, 3) };

            return (
              <button
                key={pId}
                type="button"
                onClick={() => {
                  setSelectedProvider(pId);
                  setIsExpanded(true);
                }}
                className="flex flex-col items-center gap-1 p-1 rounded-xl hover:bg-slate-800/60 transition-all group"
                title={`${meta.name}: ${snap.sessionUsedPercent}%`}
              >
                <span className="text-[9px] font-bold text-slate-300 font-mono tracking-tighter">
                  {meta.shortName}
                </span>

                {/* Vertical Pill Meter */}
                <div className="w-2 h-10 bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-slate-700">
                  <div
                    className="w-full rounded-full transition-all duration-300"
                    style={{
                      height: `${snap.sessionUsedPercent}%`,
                      backgroundColor:
                        snap.status === "exhausted"
                          ? "#f43f5e"
                          : snap.status === "warning"
                          ? "#f59e0b"
                          : meta.brandColor,
                    }}
                  />
                </div>

                <span className="text-[8px] font-mono text-slate-400">
                  {snap.sessionUsedPercent}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
