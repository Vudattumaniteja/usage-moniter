import React, { useState } from "react";
import { Clock, Maximize2, Minimize2 } from "lucide-react";
import { ProviderId, UsageSnapshot } from "../types";
import { PROVIDER_METADATA } from "./mockData";
import { ClaudeLogo, OpenAILogo, AntigravityLogo, GeminiLogo } from "./icons";
import { formatResetCountdown } from "../models/normalizers";
import { useCountdownInterpolation } from "../hooks/useCountdown";

export interface VariantBProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
  onVerificationPoll?: (providerId: ProviderId) => void | Promise<void>;
}

export const VariantB: React.FC<VariantBProps> = ({ snapshots, onVerificationPoll }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("claude");

  const { countdowns, referenceNow } = useCountdownInterpolation({
    snapshots,
    onVerificationPoll,
  });

  const activeSnapshots = Object.values(snapshots);
  const selectedSnap = snapshots[selectedProvider] || activeSnapshots[0];
  const selectedCountdown = countdowns[selectedProvider];
  const selectedMeta = PROVIDER_METADATA[selectedProvider] || {
    name: selectedProvider,
    brandColor: "#38bdf8",
    sessionWindowLabel: "Current session",
    modelWindowLabel: "All models",
    defaultPlan: "Pro",
  };

  const getBrandLogo = (provider: string, className = "w-4 h-4") => {
    switch (provider) {
      case "claude":
        return <ClaudeLogo className={className} />;
      case "codex":
        return <OpenAILogo className={className} />;
      case "antigravity":
        return <AntigravityLogo className={className} />;
      default:
        return <GeminiLogo className={className} />;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[580px] flex items-center justify-end select-none pointer-events-none p-4">
      {isExpanded ? (
        <div className="w-[340px] bg-[#0c0d10] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-white z-30 pointer-events-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
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
                  className={`flex flex-col items-center py-2 px-2 rounded-lg text-[10px] font-bold transition-all ${
                    isCurrent
                      ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="mb-1" style={{ color: isCurrent ? meta.brandColor : undefined }}>
                    {getBrandLogo(pId, "w-4 h-4")}
                  </div>
                  <span className="tracking-tight">{meta.shortName}</span>
                  <span className="font-mono text-[10px] text-white font-semibold">
                    {snap.sessionUsedPercent}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-tight">
                {selectedMeta.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {selectedSnap.planType || selectedMeta.defaultPlan}
              </span>
            </div>

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
                    backgroundColor: selectedMeta.brandColor,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Next Reset
              </span>
              <span className="font-mono font-semibold text-slate-200">
                {selectedCountdown?.sessionResetFormatted ?? formatResetCountdown(selectedSnap.sessionResetTime, referenceNow)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#050505] border border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl pointer-events-auto flex flex-col items-center gap-3 mr-0.5">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand HUD"
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Expand HUD"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          </button>

          <div className="w-full h-px bg-slate-800" />

          {["claude", "codex", "antigravity"].map((pId) => {
            const snap = snapshots[pId] || { sessionUsedPercent: 50 };
            const meta = PROVIDER_METADATA[pId] || { name: pId, shortName: pId.slice(0, 3), brandColor: "#38bdf8" };

            return (
              <button
                key={pId}
                type="button"
                onClick={() => {
                  setSelectedProvider(pId);
                  setIsExpanded(true);
                }}
                className="flex flex-col items-center gap-1.5 p-1 rounded-xl hover:bg-slate-800/60 transition-all group"
                title={`${meta.name}: ${snap.sessionUsedPercent}%`}
              >
                <div className="w-7 h-7 rounded-full bg-[#1c1c1e] flex items-center justify-center text-white shadow-sm" style={{ color: meta.brandColor }}>
                  {getBrandLogo(pId, "w-4 h-4")}
                </div>

                <div className="w-1.5 h-8 bg-slate-800 rounded-full overflow-hidden flex flex-col justify-end">
                  <div
                    className="w-full rounded-full transition-all duration-300"
                    style={{
                      height: `${snap.sessionUsedPercent}%`,
                      backgroundColor: meta.brandColor,
                    }}
                  />
                </div>

                <span className="text-[10px] font-bold text-white font-sans">
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
