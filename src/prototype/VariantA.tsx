import React, { useState } from "react";
import { Sparkles, Bot, Zap, Clock, ShieldCheck, AlertTriangle, AlertOctagon, RotateCw, X } from "lucide-react";
import { ProviderId, UsageSnapshot } from "../types";
import { PROVIDER_METADATA } from "./mockData";
import { generateRightEdgeNotchPath, generateNotchBorderPath } from "./notchMath";
import { formatResetCountdown } from "../models/normalizers";

interface VariantAProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
  onRefresh?: (provider: ProviderId) => void;
}

export const VariantA: React.FC<VariantAProps> = ({ snapshots, onRefresh }) => {
  const [activePopover, setActivePopover] = useState<ProviderId | null>(null);
  const [hoveredRing, setHoveredRing] = useState<ProviderId | null>(null);

  // Display popover if either explicitly active or hovered
  const currentPopoverProvider = activePopover || hoveredRing;
  const currentSnapshot = currentPopoverProvider ? snapshots[currentPopoverProvider] : null;
  const currentMeta = currentPopoverProvider ? PROVIDER_METADATA[currentPopoverProvider] : null;

  const totalWidth = 360;
  const totalHeight = 580;
  const notchWidth = 86;
  const notchHeight = 360;
  const notchTop = 70;

  const notchPath = generateRightEdgeNotchPath({
    totalWidth,
    totalHeight,
    notchWidth,
    notchHeight,
    notchTop,
    cornerRadius: 18,
    flareRadius: 30,
  });

  const borderPath = generateNotchBorderPath({
    totalWidth,
    totalHeight,
    notchWidth,
    notchHeight,
    notchTop,
    cornerRadius: 18,
    flareRadius: 30,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "exhausted":
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "antigravity":
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case "codex":
        return <Bot className="w-4 h-4 text-emerald-400" />;
      case "claude":
      default:
        return <Zap className="w-4 h-4 text-orange-400" />;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[580px] flex items-center justify-end select-none pointer-events-none">
      {/* Popover Card (Expands to the left of the notch) */}
      {currentSnapshot && currentMeta && (
        <div
          className="absolute right-[96px] top-[90px] w-[240px] bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl text-slate-100 z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          onMouseEnter={() => setHoveredRing(currentSnapshot.provider)}
          onMouseLeave={() => setHoveredRing(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800 border border-slate-700 shadow-inner"
                style={{ color: currentMeta.brandColor }}
              >
                {getProviderIcon(currentSnapshot.provider)}
              </div>
              <div>
                <h4 className="text-xs font-bold tracking-tight text-white leading-tight">
                  {currentMeta.name}
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  {currentSnapshot.planType || currentMeta.defaultPlan}
                </span>
              </div>
            </div>

            {activePopover && (
              <button
                type="button"
                onClick={() => setActivePopover(null)}
                className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Close popover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Session Quota Progress */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {currentMeta.sessionWindowLabel}
              </span>
              <span
                className="font-mono font-bold"
                style={{
                  color:
                    currentSnapshot.sessionUsedPercent >= 95
                      ? "#fb7185"
                      : currentSnapshot.sessionUsedPercent >= 80
                      ? "#fbbf24"
                      : currentMeta.brandColor,
                }}
              >
                {currentSnapshot.sessionUsedPercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${currentSnapshot.sessionUsedPercent}%`,
                  backgroundColor:
                    currentSnapshot.sessionUsedPercent >= 95
                      ? "#f43f5e"
                      : currentSnapshot.sessionUsedPercent >= 80
                      ? "#f59e0b"
                      : currentMeta.brandColor,
                }}
              />
            </div>

            {/* Reset countdown text */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Resets in:</span>
              <span className="font-medium text-slate-200">
                {formatResetCountdown(currentSnapshot.sessionResetTime)}
              </span>
            </div>
          </div>

          {/* Secondary Model / Weekly Quota (if available) */}
          {currentSnapshot.modelUsedPercent !== null &&
            currentSnapshot.modelUsedPercent !== undefined && (
              <div className="space-y-1.5 mb-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">
                    {currentMeta.modelWindowLabel}
                  </span>
                  <span className="font-mono font-bold text-indigo-300">
                    {currentSnapshot.modelUsedPercent}%
                  </span>
                </div>

                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${currentSnapshot.modelUsedPercent}%` }}
                  />
                </div>

                {currentSnapshot.modelResetTime && (
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Window resets:</span>
                    <span className="font-medium text-slate-200">
                      {formatResetCountdown(currentSnapshot.modelResetTime)}
                    </span>
                  </div>
                )}
              </div>
            )}

          {/* Status & Quick Actions Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px]">
            <div className="flex items-center gap-1 text-slate-300">
              {getStatusIcon(currentSnapshot.status)}
              <span className="capitalize font-medium">{currentSnapshot.status}</span>
            </div>

            <div className="flex items-center gap-1">
              {onRefresh && (
                <button
                  type="button"
                  onClick={() => onRefresh(currentSnapshot.provider)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors"
                  title="Poll quota immediately"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Right Edge SVG Curved Notch Body */}
      <div className="relative w-[360px] h-[580px] pointer-events-none flex items-center justify-end">
        <svg
          width={totalWidth}
          height={totalHeight}
          className="absolute inset-0 pointer-events-none"
        >
          <defs>
            {/* Notch Background Gradient */}
            <linearGradient id="notchBgGradient" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#090d16" stopOpacity="0.96" />
              <stop offset="80%" stopColor="#0f172a" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.88" />
            </linearGradient>

            {/* Border glow */}
            <linearGradient id="notchBorderGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="50%" stopColor="rgba(56,189,248,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>

            {/* Drop shadow filter */}
            <filter id="notchShadow" x="-30%" y="-10%" width="140%" height="120%">
              <feDropShadow dx="-6" dy="2" stdDeviation="12" floodColor="#000000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Notch Shape with Shadow & Gradient */}
          <path
            d={notchPath}
            fill="url(#notchBgGradient)"
            filter="url(#notchShadow)"
            className="pointer-events-auto backdrop-blur-2xl"
          />

          {/* Notch Border Stroke along exposed left edge */}
          <path
            d={borderPath}
            fill="none"
            stroke="url(#notchBorderGlow)"
            strokeWidth="1.25"
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </svg>

        {/* Content stacked inside Notch Body */}
        <div
          className="absolute right-0 flex flex-col items-center justify-center gap-3 pr-2.5 z-20 pointer-events-auto"
          style={{
            top: `${notchTop + 24}px`,
            width: `${notchWidth}px`,
          }}
        >
          {Object.keys(snapshots).map((providerId) => {
            const snap = snapshots[providerId];
            const meta = PROVIDER_METADATA[providerId] || {
              name: providerId,
              brandColor: "#38bdf8",
            };
            const isSelected = activePopover === providerId || hoveredRing === providerId;

            // Gauge SVG geometry
            const size = 52;
            const strokeWidth = 4.5;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (snap.sessionUsedPercent / 100) * circumference;

            return (
              <button
                key={providerId}
                type="button"
                onClick={() =>
                  setActivePopover(activePopover === providerId ? null : providerId)
                }
                onMouseEnter={() => setHoveredRing(providerId)}
                onMouseLeave={() => setHoveredRing(null)}
                aria-label={`${meta.name}: ${snap.sessionUsedPercent}%`}
                className={`group relative flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-200 focus:outline-none ${
                  isSelected
                    ? "scale-105 bg-slate-800/80 ring-1 ring-sky-400/40 shadow-lg"
                    : "hover:bg-slate-800/50"
                }`}
              >
                {/* Circular Gauge */}
                <div className="relative w-[52px] h-[52px] flex items-center justify-center">
                  <svg width={size} height={size} className="transform -rotate-90 origin-center">
                    {/* Background Track */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke="#1e293b"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />

                    {/* Active Progress Arc */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke={
                        snap.status === "exhausted"
                          ? "#f43f5e"
                          : snap.status === "warning"
                          ? "#f59e0b"
                          : meta.brandColor
                      }
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>

                  {/* Percentage in center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-bold text-slate-100 font-mono tracking-tighter">
                      {snap.sessionUsedPercent}%
                    </span>
                  </div>

                  {/* Status dot in bottom right corner */}
                  {snap.status !== "ok" && (
                    <div
                      className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                        snap.status === "exhausted" ? "bg-rose-500 animate-pulse" : "bg-amber-400"
                      }`}
                    />
                  )}
                </div>

                {/* Provider Label */}
                <span className="mt-0.5 text-[9px] font-semibold text-slate-300 tracking-tight truncate max-w-[62px]">
                  {meta.name.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
