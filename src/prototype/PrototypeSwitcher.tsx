import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sliders } from "lucide-react";
import { ProviderId, UsageSnapshot } from "../types";

export interface VariantOption {
  key: string;
  name: string;
  description?: string;
}

export type BackgroundMode = "fluid" | "wallpaper" | "editor" | "dark" | "transparent";

interface PrototypeSwitcherProps {
  variants: VariantOption[];
  current: string;
  onSelectVariant: (key: string) => void;
  snapshots?: Record<ProviderId, UsageSnapshot>;
  onUpdateSnapshot?: (provider: ProviderId, updates: Partial<UsageSnapshot>) => void;
  backgroundMode?: BackgroundMode;
  onChangeBackground?: (mode: BackgroundMode) => void;
}

export const PrototypeSwitcher: React.FC<PrototypeSwitcherProps> = ({
  variants,
  current,
  onSelectVariant,
  snapshots,
  onUpdateSnapshot,
  backgroundMode = "dark",
  onChangeBackground,
}) => {
  const [isOpenControls, setIsOpenControls] = useState(false);

  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.key.toLowerCase() === current.toLowerCase())
  );
  const currentVariant = variants[currentIndex] || variants[0];

  const goPrev = () => {
    const prevIndex = (currentIndex - 1 + variants.length) % variants.length;
    onSelectVariant(variants[prevIndex].key);
  };

  const goNext = () => {
    const nextIndex = (currentIndex + 1) % variants.length;
    onSelectVariant(variants[nextIndex].key);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, variants]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-auto">
      {/* Simulation Controls Drawer */}
      {isOpenControls && snapshots && onUpdateSnapshot && (
        <div className="w-[360px] max-w-[92vw] bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-slate-200 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-100">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Interactive Quota Simulator</span>
            </div>
            <span className="text-[10px] text-slate-400">Drag to test states</span>
          </div>

          {/* Background switcher */}
          {onChangeBackground && (
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">
                Preview Canvas Backdrop
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "fluid", label: "Fluid Streaks" },
                    { id: "dark", label: "Studio Dark" },
                    { id: "editor", label: "VS Code" },
                    { id: "wallpaper", label: "Windows 11" },
                    { id: "transparent", label: "Transparent" },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onChangeBackground(b.id)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      backgroundMode === b.id
                        ? "bg-sky-500 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider Quota Sliders */}
          <div className="space-y-3">
            {Object.keys(snapshots).map((providerId) => {
              const snap = snapshots[providerId];
              return (
                <div key={providerId} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium capitalize text-slate-300">
                      {providerId} Session
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        snap.sessionUsedPercent >= 95
                          ? "text-rose-400"
                          : snap.sessionUsedPercent >= 80
                          ? "text-amber-400"
                          : "text-sky-400"
                      }`}
                    >
                      {snap.sessionUsedPercent}% ({snap.status})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={snap.sessionUsedPercent}
                    onChange={(e) =>
                      onUpdateSnapshot(providerId, {
                        sessionUsedPercent: Number(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bottom Bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950/90 text-white rounded-full border border-slate-700/80 shadow-2xl backdrop-blur-md">
        {/* Prev Variant Button */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous variant"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Current Variant Pill */}
        <div className="flex items-center gap-2 px-2.5 py-0.5">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-slate-950 font-bold text-xs shadow-sm">
            {currentVariant.key}
          </span>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-100 tracking-tight leading-tight">
              {currentVariant.name}
            </span>
            {currentVariant.description && (
              <span className="text-[10px] text-slate-400 leading-none">
                {currentVariant.description}
              </span>
            )}
          </div>
        </div>

        {/* Next Variant Button */}
        <button
          type="button"
          onClick={goNext}
          aria-label="Next variant"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-slate-700 mx-0.5" />

        {/* Simulator Toggle Button */}
        {snapshots && onUpdateSnapshot && (
          <button
            type="button"
            onClick={() => setIsOpenControls(!isOpenControls)}
            aria-label="Toggle Simulator Controls"
            className={`p-1.5 rounded-full transition-colors ${
              isOpenControls
                ? "bg-sky-500 text-slate-950"
                : "hover:bg-slate-800 text-slate-300 hover:text-white"
            }`}
            title="Adjust mock session usage and backdrop"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
