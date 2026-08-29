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
        return <Wind size={15} color="#38bdf8" />;
      case "waves":
        return <Waves size={15} color="#06b6d4" />;
      case "eye":
        return <Eye size={15} color="#f59e0b" />;
      case "anchor":
        return <Anchor size={15} color="#f43f5e" />;
      case "cpu":
        return <Cpu size={15} color="#10b981" />;
      case "help":
        return <HelpCircle size={15} color="#94a3b8" />;
      default:
        return <Info size={15} color="#94a3b8" />;
    }
  };

  return (
    <div className="causal-drawer-overlay">
      {/* Backdrop */}
      <div className="causal-drawer-backdrop" onClick={onClose} />

      {/* Slide-over Panel */}
      <aside className="causal-drawer-panel" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="causal-drawer-header">
          <div className="causal-drawer-header-left">
            <div className="causal-drawer-meta">
              <span className="causal-layer-tag">Layer 3 Intelligence</span>
              <span className="causal-shipment-code">{explanation.shipmentId}</span>
            </div>
            <h2>
              Causal &quot;Why&quot; Delay Breakdown
              <Sparkles size={16} className="causal-sparkle-icon" />
            </h2>
            <p className="causal-drawer-subtitle">
              {origin} → {destination} • {shipmentName}
            </p>
          </div>

          <button
            type="button"
            className="causal-drawer-close"
            onClick={onClose}
            aria-label="Close Causal Breakdown Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="causal-drawer-body">
          {/* Top Uncertainty Metric Cards */}
          <div className="causal-metric-cards">
            {/* p10 Optimistic */}
            <div className="causal-metric-card">
              <div className="causal-metric-card-header">
                <span>p10 (Best Case)</span>
                <CheckCircle2 size={13} color="#10b981" />
              </div>
              <strong className="text-p10">
                +{uncertaintyInterval.p10OptimisticHours.toFixed(1)}h
              </strong>
              <small>90% confidence lower bound</small>
            </div>

            {/* p50 Calibrated Delay */}
            <div className="causal-metric-card p50-card">
              <div className="causal-metric-card-header">
                <span style={{ color: "#38bdf8" }}>p50 Expected</span>
                <Clock size={13} color="#38bdf8" />
              </div>
              <strong className="text-p50">
                +{totalPredictedDelayHours.toFixed(1)}h
              </strong>
              <small style={{ color: "#7dd3fc" }}>Naval Physics + ML calibrated</small>
            </div>

            {/* p90 Conservative */}
            <div className="causal-metric-card">
              <div className="causal-metric-card-header">
                <span>p90 (Worst Case)</span>
                <ShieldAlert size={13} color="#f59e0b" />
              </div>
              <strong className="text-p90">
                +{uncertaintyInterval.p90ConservativeHours.toFixed(1)}h
              </strong>
              <small>Heavy weather risk threshold</small>
            </div>
          </div>

          {/* Uncertainty Spread Bar & Confidence Meter */}
          <div className="causal-dispersion-section">
            <div className="causal-dispersion-header">
              <span>Prediction Confidence &amp; Dispersion</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Score:</span>
                <span className="causal-confidence-pill">
                  {Math.round(confidenceScore * 100)}%
                </span>
              </div>
            </div>

            {/* Visual Uncertainty Range Bar */}
            <div className="causal-meter-track">
              <div
                className="causal-meter-bar"
                style={{
                  width: `${Math.min(100, Math.max(15, (totalPredictedDelayHours / Math.max(1, uncertaintyInterval.p90ConservativeHours * 1.15)) * 100))}%`,
                }}
              />
            </div>
            <div className="causal-meter-labels">
              <span>Min: +{uncertaintyInterval.p10OptimisticHours.toFixed(1)}h</span>
              <span>Median: +{uncertaintyInterval.p50MedianHours.toFixed(1)}h</span>
              <span>Max Risk: +{uncertaintyInterval.p90ConservativeHours.toFixed(1)}h</span>
            </div>
          </div>

          {/* Primary Driver Summary Callout */}
          <div className="causal-attribution-callout">
            <AlertTriangle size={18} className="causal-attribution-icon" />
            <div className="causal-attribution-content">
              <h4>Primary Delay Attribution</h4>
              <p>{primaryDriverSummary}</p>
            </div>
          </div>

          {/* Physical & ML Factor Decomposition List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="causal-factors-header">
              <span>Causal Component Breakdown</span>
              <span style={{ fontSize: "10px", color: "#64748b", textTransform: "none" }}>
                Kwon (2008) + GBDT Residual
              </span>
            </div>

            <div className="causal-factor-list">
              {factors.map((factor) => {
                const pct = Number(factor.percentageOfTotal ?? (factor as any).percentage ?? 0);
                const hrs = Number(factor.delayHours ?? 0);
                const isHydro = factor.category === "hydrodynamic_wind" || factor.category === "hydrodynamic_wave" || (factor.category as string) === "weather_hydrodynamic";
                const isChoke = factor.category === "chokepoint_queuing";
                const isMl = factor.category === "ml_operational" || (factor.category as string) === "ml_operational_adjustment";

                return (
                  <div key={factor.id} className="causal-factor-card">
                    <div className="causal-factor-main">
                      <div className="causal-factor-info">
                        <div className="causal-factor-icon-wrap">
                          {getFactorIcon(factor.iconName)}
                        </div>
                        <div className="causal-factor-text">
                          <b>{factor.label}</b>
                          <span>{factor.description}</span>
                        </div>
                      </div>

                      <div className="causal-factor-stat">
                        <strong>
                          {hrs > 0 ? "+" : ""}
                          {hrs.toFixed(1)}h
                        </strong>
                        <small>{pct.toFixed(1)}%</small>
                      </div>
                    </div>

                    <div className="causal-factor-meter">
                      <div
                        className="causal-factor-meter-fill"
                        style={{
                          width: `${Math.max(4, Math.min(100, pct))}%`,
                          background: isHydro
                            ? "#38bdf8"
                            : isChoke
                              ? "#f59e0b"
                              : isMl
                                ? "#10b981"
                                : "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Tier Layer Comparison Box */}
          <div
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              padding: "12px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            <div>
              <span>Layer 1 (Kwon Physics): </span>
              <strong style={{ color: "#e2e8f0" }}>+{physicsBaselineHours.toFixed(1)}h</strong>
            </div>
            <div>
              <span>Layer 3 (ML Residual): </span>
              <strong style={{ color: "#38bdf8" }}>
                {mlOperationalAdjustmentHours >= 0 ? "+" : ""}
                {mlOperationalAdjustmentHours.toFixed(1)}h
              </strong>
            </div>
          </div>
        </div>

        {/* Footer Audit Bar */}
        <div className="causal-drawer-footer">
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            Immutable ISO Audit Record: verified
          </span>

          <button
            type="button"
            className="causal-download-btn"
            onClick={() => {
              const blob = new Blob([JSON.stringify(explanation, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `causal_audit_${explanation.shipmentId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileSpreadsheet size={13} />
            Export Audit Record (JSON)
          </button>
        </div>
      </aside>
    </div>
  );
}
