import React, { useState } from "react";
import { ProviderId, UsageSnapshot } from "../types";
import { generateRightEdgeNotchPath } from "../prototype/notchMath";
import { AntigravityLogo, OpenAILogo } from "../prototype/icons";
import { formatResetCountdown } from "../models/normalizers";

interface NotchProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
}

const PROVIDER_METADATA: Record<string, { name: string; brandColor: string; sessionLabel: string; modelLabel: string }> = {
  antigravity: {
    name: "Antigravity Usage",
    brandColor: "#38bdf8",
    sessionLabel: "Current session (5h)",
    modelLabel: "Weekly quota",
  },
  codex: {
    name: "Codex / ChatGPT",
    brandColor: "#10b981",
    sessionLabel: "Current session (3h)",
    modelLabel: "All models",
  },
};

export const Notch: React.FC<NotchProps> = ({ snapshots }) => {
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);
  const [hoveredRing, setHoveredRing] = useState<ProviderId | null>(null);

  const currentProvider = hoveredRing || activeProvider;
  const currentSnapshot = currentProvider ? snapshots[currentProvider] : null;
  const currentMeta = currentProvider ? PROVIDER_METADATA[currentProvider] : null;

  const totalWidth = 360;
  const totalHeight = 580;
  const notchWidth = 76;
  const notchHeight = 250;
  const notchTop = 150;

  const notchPath = generateRightEdgeNotchPath({
    totalWidth,
    totalHeight,
    notchWidth,
    notchHeight,
    notchTop,
    cornerRadius: 20,
    flareRadius: 28,
  });

  const getBrandLogo = (provider: string, className = "w-5 h-5") => {
    switch (provider) {
      case "codex":
        return <OpenAILogo className={className} />;
      case "antigravity":
      default:
        return <AntigravityLogo className={className} />;
    }
  };

  const orderedProviderIds: ProviderId[] = ["antigravity", "codex"];
  const activeIndex = currentProvider ? Math.max(0, orderedProviderIds.indexOf(currentProvider)) : 0;
  const popoverYOffset = notchTop + 16 + activeIndex * 92 - 34;

  return (
    <div className="relative w-full h-full min-h-[580px] flex items-center justify-end select-none pointer-events-none pr-0">
      {/* Speech-Bubble Popover Card */}
      {currentSnapshot && currentMeta && (
        <div
          role="dialog"
          aria-label={`${currentMeta.name} Details`}
          className="absolute right-[90px] w-[260px] bg-[#0c0d10] border border-white/10 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-3xl text-white z-30 pointer-events-auto transition-all duration-200"
          style={{ top: `${popoverYOffset}px` }}
          onMouseEnter={() => setHoveredRing(currentSnapshot.provider)}
          onMouseLeave={() => setHoveredRing(null)}
        >
          {/* Caret Arrow */}
          <div
            className="absolute -right-2 top-[46px] w-0 h-0 border-y-[9px] border-y-transparent border-l-[10px] border-l-[#0c0d10]"
            style={{
              filter: "drop-shadow(2px 0 1px rgba(255,255,255,0.06))",
            }}
          />

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3.5">
            <div
              className="w-5 h-5 flex items-center justify-center text-white"
              style={{ color: currentMeta.brandColor }}
            >
              {getBrandLogo(currentSnapshot.provider, "w-4.5 h-4.5")}
            </div>
            <h4 className="text-sm font-semibold tracking-tight text-white leading-none">
              {currentMeta.name.split(" ")[0]} Usage
            </h4>
          </div>

          {/* Session Quota Bar */}
          <div className="space-y-1.5 mb-3.5">
            <span className="text-[11px] text-[#8e8e93] font-medium block">
              {currentMeta.sessionLabel}
            </span>
            <div className="w-full h-2 bg-[#1c1c1e] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{
                  width: `${currentSnapshot.sessionUsedPercent}%`,
                  backgroundColor:
                    currentSnapshot.sessionUsedPercent >= 95
                      ? "#ff453a"
                      : currentSnapshot.sessionUsedPercent >= 80
                      ? "#ff9f0a"
                      : currentMeta.brandColor,
                  boxShadow: `0 0 8px ${currentMeta.brandColor}40`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span className="font-semibold text-white">
                {currentSnapshot.sessionUsedPercent}% Used
              </span>
              <span className="text-[#8e8e93] text-[10px]">
                Resets in {formatResetCountdown(currentSnapshot.sessionResetTime)}
              </span>
            </div>
          </div>

          {/* Model / Weekly Quota Bar */}
          {currentSnapshot.modelUsedPercent !== null &&
            currentSnapshot.modelUsedPercent !== undefined && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-[#8e8e93] font-medium block">
                  {currentMeta.modelLabel}
                </span>
                <div className="w-full h-2 bg-[#1c1c1e] rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-[#30d158] rounded-full transition-all duration-500 shadow-sm"
                    style={{
                      width: `${currentSnapshot.modelUsedPercent}%`,
                      boxShadow: "0 0 8px rgba(48,209,88,0.4)",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="font-semibold text-white">
                    {currentSnapshot.modelUsedPercent}% Used
                  </span>
                  <span className="text-[#8e8e93] text-[10px]">
                    Resets {currentSnapshot.modelResetTime ? formatResetCountdown(currentSnapshot.modelResetTime) : "Weekly"}
                  </span>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Right Edge Black Curved Notch Body */}
      <div className="relative w-[360px] h-[580px] pointer-events-none flex items-center justify-end">
        <svg
          width={totalWidth}
          height={totalHeight}
          className="absolute inset-0 pointer-events-none"
        >
          <defs>
            <filter id="mainNotchBlurShadow" x="-20%" y="-10%" width="130%" height="120%">
              <feDropShadow dx="-4" dy="0" stdDeviation="16" floodColor="#000000" floodOpacity="0.75" />
            </filter>
          </defs>

          <path
            d={notchPath}
            fill="#050505"
            filter="url(#mainNotchBlurShadow)"
            className="pointer-events-auto"
          />
        </svg>

        {/* Notch Gauges Stack */}
        <div
          className="absolute right-0 flex flex-col items-center justify-center gap-5 pr-3.5 z-20 pointer-events-auto"
          style={{
            top: `${notchTop + 24}px`,
            width: `${notchWidth}px`,
          }}
        >
          {orderedProviderIds.map((pId) => {
            const snap = snapshots[pId] || {
              provider: pId,
              sessionUsedPercent: 50,
              status: "ok",
            };
            const meta = PROVIDER_METADATA[pId] || {
              name: pId,
              brandColor: "#38bdf8",
            };
            const isSelected = currentProvider === pId;

            const size = 48;
            const strokeWidth = 3.5;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (snap.sessionUsedPercent / 100) * circumference;

            return (
              <button
                key={pId}
                type="button"
                onClick={() =>
                  setActiveProvider((prev) => (prev === pId ? null : pId))
                }
                onMouseEnter={() => setHoveredRing(pId)}
                onMouseLeave={() => setHoveredRing(null)}
                aria-label={`${meta.name}: ${snap.sessionUsedPercent}%`}
                className={`group flex flex-col items-center justify-center transition-transform duration-150 focus:outline-none ${
                  isSelected ? "scale-105" : "hover:scale-102 opacity-95 hover:opacity-100"
                }`}
              >
                {/* Circular Gauge */}
                <div className="relative w-[48px] h-[48px] flex items-center justify-center">
                  <div className="absolute inset-[3px] rounded-full bg-[#1c1c1e] flex items-center justify-center shadow-inner">
                    <div className="text-white opacity-95 group-hover:opacity-100 transition-opacity">
                      {getBrandLogo(pId, "w-5 h-5")}
                    </div>
                  </div>

                  <svg width={size} height={size} className="transform -rotate-90 origin-center absolute inset-0">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke="#2c2c2e"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke={meta.brandColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                </div>

                <span className="mt-1 text-[13px] font-bold text-white tracking-tight font-sans">
                  {snap.sessionUsedPercent}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
