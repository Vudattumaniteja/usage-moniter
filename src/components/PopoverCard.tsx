import React, { useMemo } from "react";
import { PopoverCard as PopoverCardType, ProviderId, UsageSnapshot } from "../types";
import { AlertTriangle, CheckCircle2, Clock, X, XCircle, Zap } from "lucide-react";
import { useProviderCountdown } from "../hooks/useCountdown";
import { snapshotToPopoverCard } from "../models/ui";

interface PopoverCardProps {
  card?: PopoverCardType;
  snapshot?: UsageSnapshot;
  onVerificationPoll?: (providerId: ProviderId) => void | Promise<void>;
  onClose?: () => void;
}

export const PopoverCard: React.FC<PopoverCardProps> = ({
  card: staticCard,
  snapshot,
  onVerificationPoll,
  onClose,
}) => {
  const { countdown, referenceNow } = useProviderCountdown({
    snapshot,
    onVerificationPoll,
  });

  const card = useMemo(() => {
    if (snapshot) {
      const derived = snapshotToPopoverCard(snapshot, referenceNow);
      if (countdown) {
        derived.sessionResetFormatted = countdown.sessionResetFormatted;
        if (countdown.modelResetFormatted !== null) {
          derived.modelResetFormatted = countdown.modelResetFormatted;
        }
      }
      return derived;
    }
    return staticCard!;
  }, [snapshot, staticCard, countdown, referenceNow]);
  const getStatusIcon = () => {
    switch (card.status) {
      case "ok":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case "exhausted":
      case "error":
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      case "unauthenticated":
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getStatusBadgeClass = () => {
    switch (card.status) {
      case "ok":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
      case "warning":
        return "bg-amber-500/10 text-amber-300 border-amber-500/20";
      case "exhausted":
      case "error":
        return "bg-rose-500/10 text-rose-300 border-rose-500/20";
      case "unauthenticated":
        return "bg-amber-500/10 text-amber-300 border-amber-500/20";
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`${card.title} Details`}
      className="popover-glass w-72 rounded-2xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150 relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm text-slate-100">{card.title}</span>
          {card.planType && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {card.planType}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadgeClass()}`}
          >
            {getStatusIcon()}
            <span className="capitalize">{card.status}</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded focus:outline-none"
              aria-label="Close popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Session Quota Bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400 font-medium">Session Quota</span>
          <span className="font-semibold text-slate-200">
            {card.sessionUsedPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              card.sessionUsedPercent >= 90
                ? "bg-rose-500"
                : card.sessionUsedPercent >= 75
                ? "bg-amber-500"
                : "bg-sky-400"
            }`}
            style={{ width: `${Math.min(100, card.sessionUsedPercent)}%` }}
          />
        </div>
        <div className="flex items-center text-[11px] text-slate-400 pt-0.5">
          <Clock className="w-3 h-3 mr-1 text-slate-500" />
          <span>Resets in: </span>
          <span className="ml-1 text-slate-200 font-medium">
            {card.sessionResetFormatted}
          </span>
        </div>
      </div>

      {/* Model Quota Bar (if applicable) */}
      {card.modelUsedPercent !== null && card.modelUsedPercent !== undefined && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Model Rolling Limit</span>
            <span className="font-semibold text-slate-200">
              {card.modelUsedPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                card.modelUsedPercent >= 90
                  ? "bg-rose-500"
                  : card.modelUsedPercent >= 75
                  ? "bg-amber-500"
                  : "bg-purple-400"
              }`}
              style={{ width: `${Math.min(100, card.modelUsedPercent)}%` }}
            />
          </div>
          {card.modelResetFormatted && (
            <div className="flex items-center text-[11px] text-slate-400 pt-0.5">
              <Clock className="w-3 h-3 mr-1 text-slate-500" />
              <span>Resets in: </span>
              <span className="ml-1 text-slate-200 font-medium">
                {card.modelResetFormatted}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status Message Footer */}
      {card.statusMessage && (
        <div className="text-[11px] text-slate-400 bg-slate-900/50 rounded-lg p-2 border border-slate-800 flex items-start space-x-1.5">
          <span className="text-slate-300 leading-tight">{card.statusMessage}</span>
        </div>
      )}
    </div>
  );
};
