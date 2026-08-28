import React from "react";
import { UsageRing as UsageRingType } from "../types";

interface UsageRingProps {
  ring: UsageRingType;
  isActive?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const UsageRing: React.FC<UsageRingProps> = ({
  ring,
  isActive = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const size = 52;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const sessionOffset =
    circumference - (ring.sessionUsedPercent / 100) * circumference;

  // Inner ring for secondary/model quota if available
  const innerRadius = radius - 6;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const modelOffset =
    ring.modelUsedPercent !== null && ring.modelUsedPercent !== undefined
      ? innerCircumference - (ring.modelUsedPercent / 100) * innerCircumference
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 focus:outline-none ${
        isActive
          ? "bg-slate-700/60 ring-1 ring-white/20 shadow-md scale-105"
          : "hover:bg-slate-800/50"
      }`}
      aria-label={`${ring.label}: ${ring.sessionUsedPercent}% used`}
    >
      <div className="relative w-[52px] h-[52px] flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 origin-center"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Primary session progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ring.accentColor || "#38bdf8"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={sessionOffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />

          {/* Secondary model progress ring (if present) */}
          {modelOffset !== null && (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={innerRadius}
                stroke="#0f172a"
                strokeWidth={3}
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={innerRadius}
                stroke="#a855f7"
                strokeWidth={3}
                strokeDasharray={innerCircumference}
                strokeDashoffset={modelOffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500 ease-out opacity-80"
              />
            </>
          )}
        </svg>

        {/* Center percentage readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-bold text-slate-100 tracking-tight leading-none">
            {ring.sessionUsedPercent}%
          </span>
        </div>
      </div>

      {/* Provider name label */}
      <span className="mt-1 text-[10px] font-medium text-slate-300 tracking-tight truncate max-w-[64px]">
        {ring.label}
      </span>
    </button>
  );
};
