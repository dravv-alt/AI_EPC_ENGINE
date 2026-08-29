"use client";

import {
  Wind,
  Waves,
  Eye,
  Anchor,
  Cpu,
  HelpCircle,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Clock,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import { ComprehensiveCausalExplanation } from "@/lib/maritime/causal-explainability";

interface CausalExplainabilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: ComprehensiveCausalExplanation | null;
  shipmentName?: string;
  origin?: string;
  destination?: string;
}

export function CausalExplainabilityDrawer({
  isOpen,
  onClose,
  explanation,
  shipmentName = "Active Shipment",
  origin = "Origin Port",
  destination = "Destination Port",
}: CausalExplainabilityDrawerProps) {
  if (!isOpen || !explanation) return null;

  const totalPredictedDelayHours = explanation?.totalPredictedDelayHours ?? 0;
  const physicsBaselineHours = explanation?.physicsBaselineHours ?? 0;
  const mlOperationalAdjustmentHours = explanation?.mlOperationalAdjustmentHours ?? 0;
  const uncertaintyInterval = explanation?.uncertaintyInterval ?? {
    p10OptimisticHours: 0,
    p50MedianHours: 0,
    p90ConservativeHours: 0,
    spreadHours: 0,
  };
  const confidenceScore = explanation?.confidenceScore ?? 0.85;
  const factors = explanation?.factors ?? [];
  const primaryDriverSummary = explanation?.primaryDriverSummary ?? "Transit operates under nominal schedule parameters.";
  const recommendation = explanation?.recommendation ?? "Route operates within nominal parameters.";

  const getFactorIcon = (iconName: string) => {
    switch (iconName) {
      case "wind":
        return <Wind className="w-4 h-4 text-sky-400" />;
      case "waves":
        return <Waves className="w-4 h-4 text-cyan-400" />;
      case "eye":
        return <Eye className="w-4 h-4 text-amber-400" />;
      case "anchor":
        return <Anchor className="w-4 h-4 text-rose-400" />;
      case "cpu":
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      case "help":
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-rose-950/70 text-rose-300 border-rose-700/60";
      case "high":
        return "bg-amber-950/70 text-amber-300 border-amber-700/60";
      case "medium":
        return "bg-yellow-950/70 text-yellow-300 border-yellow-700/60";
      default:
        return "bg-emerald-950/70 text-emerald-300 border-emerald-700/60";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-md transition-all duration-300">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="relative w-full max-w-2xl h-full bg-[#0B0F19] border-l border-slate-800 text-slate-100 shadow-2xl overflow-y-auto flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/80 px-6 py-5 flex items-center justify-between z-20">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-sky-950/80 text-sky-400 border border-sky-800/50">
                Layer 3 Intelligence
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {explanation.shipmentId}
              </span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-white mt-1 flex items-center gap-2">
              Causal &quot;Why&quot; Delay Breakdown
              <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {origin} → {destination} • {shipmentName}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Top Uncertainty Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* p10 Optimistic */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase tracking-wider">
                <span>p10 (Best Case)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono text-emerald-400">
                +{uncertaintyInterval.p10OptimisticHours.toFixed(1)}h
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                90% confidence lower bound
              </p>
            </div>

            {/* p50 Calibrated Delay */}
            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/50 shadow-inner">
              <div className="flex items-center justify-between text-sky-400 text-[11px] font-mono uppercase tracking-wider">
                <span>p50 Expected</span>
                <Clock className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono text-white">
                +{totalPredictedDelayHours.toFixed(1)}h
              </div>
              <p className="text-[10px] text-sky-300/70 mt-1">
                Naval Physics + ML calibrated
              </p>
            </div>

            {/* p90 Conservative */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono uppercase tracking-wider">
                <span>p90 (Worst Case)</span>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-1.5 text-xl font-bold font-mono text-amber-400">
                +{uncertaintyInterval.p90ConservativeHours.toFixed(1)}h
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Heavy weather risk threshold
              </p>
            </div>
          </div>

          {/* Uncertainty Spread Bar & Confidence Meter */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Prediction Confidence &amp; Dispersion
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Confidence Score:
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800/60">
                  {Math.round(confidenceScore * 100)}%
                </span>
              </div>
            </div>

            {/* Visual Uncertainty Range Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 rounded-full bg-slate-950 overflow-hidden relative border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 rounded-full"
                  style={{
                    width: `${Math.min(100, (totalPredictedDelayHours / Math.max(1, uncertaintyInterval.p90ConservativeHours * 1.2)) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Min: +{uncertaintyInterval.p10OptimisticHours.toFixed(1)}h</span>
                <span>Median: +{uncertaintyInterval.p50MedianHours.toFixed(1)}h</span>
                <span>Max Risk: +{uncertaintyInterval.p90ConservativeHours.toFixed(1)}h</span>
              </div>
            </div>
          </div>

          {/* Primary Driver Summary Callout */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-200">
                Primary Delay Attribution
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {primaryDriverSummary}
              </p>
            </div>
          </div>

          {/* Physical & ML Factor Decomposition List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Causal Component Breakdown
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">
                Kwon (2008) + GBDT Residual
              </span>
            </div>

            <div className="space-y-2.5">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                        {getFactorIcon(factor.iconName)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          {factor.label}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {factor.description}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-white">
                        {factor.delayHours > 0 ? "+" : ""}
                        {factor.delayHours.toFixed(1)}h
                      </div>
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider border ${getSeverityBadgeClass(factor.severity)}`}
                      >
                        {factor.percentageOfTotal}% impact
                      </span>
                    </div>
                  </div>

                  {/* Relative contribution progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        factor.category === "unclassified"
                          ? "bg-slate-500"
                          : factor.category === "ml_operational"
                          ? "bg-emerald-500"
                          : factor.severity === "critical"
                          ? "bg-rose-500"
                          : factor.severity === "high"
                          ? "bg-amber-500"
                          : "bg-sky-500"
                      }`}
                      style={{
                        width: `${Math.min(100, factor.percentageOfTotal)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mathematical Anchor Reference Block */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <span>Physics Baseline (Layer 1):</span>
              <span className="font-semibold text-slate-200">
                +{physicsBaselineHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
              <span>ML Operational Adjustment (Layer 3):</span>
              <span className="font-semibold text-emerald-400">
                {mlOperationalAdjustmentHours >= 0 ? "+" : ""}
                {mlOperationalAdjustmentHours.toFixed(2)}h
              </span>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-300 font-mono text-[11px]">
              <span className="font-bold">Total Calibrated Prediction:</span>
              <span className="font-bold text-sky-400 text-sm">
                +{totalPredictedDelayHours.toFixed(1)}h
              </span>
            </div>
          </div>

          {/* EPC Operational Recommendation */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1.5">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              EPC Operational Recommendation
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {recommendation}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-800 px-6 py-4 flex items-center justify-between z-20">
          <button
            onClick={() => {
              const dataStr =
                "data:text/json;charset=utf-8," +
                encodeURIComponent(JSON.stringify(explanation, null, 2));
              const downloadAnchor = document.createElement("a");
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute(
                "download",
                `audit_${explanation.shipmentId}.json`
              );
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
            className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            Export Calculation Audit (JSON)
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-sky-950/50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
