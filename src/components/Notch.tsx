import React, { useState } from "react";
import { ProviderId, UsageSnapshot } from "../types";
import { snapshotToPopoverCard, snapshotToUsageRing } from "../models/ui";
import { UsageRing } from "./UsageRing";
import { PopoverCard } from "./PopoverCard";
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";

interface NotchProps {
  snapshots: Record<ProviderId, UsageSnapshot>;
  defaultExpanded?: boolean;
}

export const Notch: React.FC<NotchProps> = ({
  snapshots,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeProvider, setActiveProvider] = useState<ProviderId | null>(null);

  const providerList = Object.values(snapshots);
  const activeSnapshot = activeProvider ? snapshots[activeProvider] : null;
  const activeCard = activeSnapshot ? snapshotToPopoverCard(activeSnapshot) : null;

  return (
    <div className="fixed right-0 top-12 z-50 flex items-start select-none">
      {/* Popover Card (renders to the left of the notch when active) */}
      {activeCard && isExpanded && (
        <div className="mr-3 mt-2 shadow-2xl transition-all duration-200">
          <PopoverCard
            card={activeCard}
            onClose={() => setActiveProvider(null)}
          />
        </div>
      )}

      {/* Notch Dock */}
      <div className="flex items-center">
        {/* Curved Dock Notch Tab / Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="notch-glass -mr-1 flex items-center justify-center w-6 h-20 rounded-l-2xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-all duration-200 focus:outline-none cursor-pointer group"
          aria-label={isExpanded ? "Collapse Notch" : "Expand Notch"}
        >
          {isExpanded ? (
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          )}
        </button>

        {/* Notch Content Panel */}
        {isExpanded && (
          <div className="notch-glass rounded-l-3xl p-3 flex flex-col space-y-3 min-w-[76px] transition-all duration-300">
            {/* Header / Brand Icon */}
            <div className="flex items-center justify-center pb-1 border-b border-slate-700/40">
              <Activity className="w-4 h-4 text-sky-400" />
            </div>

            {/* Provider Usage Rings */}
            <div className="flex flex-col space-y-2">
              {providerList.map((snapshot) => {
                const ring = snapshotToUsageRing(snapshot);
                const isSelected = activeProvider === snapshot.provider;

                return (
                  <UsageRing
                    key={snapshot.provider}
                    ring={ring}
                    isActive={isSelected}
                    onClick={() =>
                      setActiveProvider((prev) =>
                        prev === snapshot.provider ? null : snapshot.provider
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
