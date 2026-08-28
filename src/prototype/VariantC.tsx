import React, { useState } from "react";
import { Terminal, Radio, Code2 } from "lucide-react";
import { ProviderId, UsageSnapshot } from "../types";
import { PROVIDER_METADATA } from "./mockData";
import { formatResetCountdown } from "../models/normalizers";

interface VariantCProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
}

export const VariantC: React.FC<VariantCProps> = ({ snapshots }) => {
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("antigravity");

  return (
    <div className="relative w-full h-full min-h-[580px] flex items-center justify-end select-none pointer-events-none p-2">
      {/* Raw JSON Inspector Drawer */}
      {showJsonInspector && (
        <div className="absolute right-[110px] top-[40px] w-[290px] bg-black/95 border border-cyan-500/40 rounded-lg p-3 shadow-[0_0_30px_rgba(6,182,212,0.25)] font-mono text-[11px] text-cyan-300 z-30 pointer-events-auto animate-in slide-in-from-right-4 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-900/80 text-cyan-400">
            <div className="flex items-center gap-1.5 font-bold tracking-wider">
              <Terminal className="w-3.5 h-3.5" />
              <span>RAW RPC SNAPSHOT</span>
            </div>
            <button
              type="button"
              onClick={() => setShowJsonInspector(false)}
              className="text-cyan-500 hover:text-cyan-200"
            >
              [ESC]
            </button>
          </div>

          <div className="text-[10px] text-slate-400 mb-1">
            SCHEMA: {selectedProvider === "antigravity" ? "exa.language_server_pb" : "wham/usage"}
          </div>

          <pre className="p-2 bg-slate-950/80 rounded border border-cyan-950 overflow-x-auto max-h-[260px] text-[10px] text-emerald-400 leading-tight">
            {JSON.stringify(snapshots[selectedProvider], null, 2)}
          </pre>
        </div>
      )}

      {/* Angular Cyber Blade */}
      <div
        className="relative w-[96px] bg-slate-950/95 border-l-2 border-cyan-500/80 p-2.5 shadow-2xl backdrop-blur-2xl pointer-events-auto flex flex-col items-center gap-3"
        style={{
          clipPath: "polygon(0 40px, 20px 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 40px))",
          minHeight: "420px",
        }}
      >
        {/* Blade Top Telemetry Header */}
        <div className="flex flex-col items-center text-center mt-2 border-b border-cyan-900/50 pb-2 w-full">
          <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            <Radio className="w-2.5 h-2.5 text-cyan-400 animate-pulse" />
            <span>TELEMETRY BLADE</span>
          </div>
          <span className="text-[8px] font-mono text-slate-500 truncate">127.0.0.1:RPC</span>
        </div>

        {/* Provider Segmented Gauges */}
        <div className="flex flex-col gap-3 w-full items-center">
          {Object.keys(snapshots).map((pId) => {
            const snap = snapshots[pId];
            const meta = PROVIDER_METADATA[pId] || { name: pId, shortName: pId.slice(0, 3) };
            const isSelected = selectedProvider === pId;

            return (
              <button
                key={pId}
                type="button"
                onClick={() => setSelectedProvider(pId)}
                className={`w-full flex flex-col items-center p-1.5 rounded transition-all font-mono ${
                  isSelected
                    ? "bg-cyan-950/60 border border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "hover:bg-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between w-full text-[9px] font-bold text-slate-300">
                  <span className="text-cyan-300">[{meta.shortName}]</span>
                  <span
                    className={
                      snap.sessionUsedPercent >= 90
                        ? "text-rose-400"
                        : snap.sessionUsedPercent >= 75
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {snap.sessionUsedPercent}%
                  </span>
                </div>

                {/* Cyber Segmented Bar Gauge */}
                <div className="w-full grid grid-cols-10 gap-0.5 mt-1">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const threshold = (i + 1) * 10;
                    const filled = snap.sessionUsedPercent >= threshold;
                    return (
                      <div
                        key={i}
                        className={`h-2 rounded-none transition-colors ${
                          filled
                            ? snap.sessionUsedPercent >= 90
                              ? "bg-rose-500"
                              : snap.sessionUsedPercent >= 75
                              ? "bg-amber-400"
                              : "bg-cyan-400"
                            : "bg-slate-800/80"
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Reset Clock */}
                <span className="text-[8px] text-slate-400 mt-1">
                  ⏱ {formatResetCountdown(snap.sessionResetTime)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action button to open diagnostic inspector */}
        <button
          type="button"
          onClick={() => setShowJsonInspector(!showJsonInspector)}
          aria-label="Inspect Raw RPC"
          className="mt-auto mb-2 px-2 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 rounded text-[9px] font-mono text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <Code2 className="w-3 h-3 text-cyan-400" />
          <span>INSPECT</span>
        </button>
      </div>
    </div>
  );
};
