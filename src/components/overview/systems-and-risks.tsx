import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowRight, Zap, Wind, Flame, Droplets, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";

export function SystemsAndRisks({ data }: { data: DashboardData }) {
  const systemsList = [
    { name: "Chilled Water", icon: Droplets, type: "Cooling", count: "3 assets", status: "review" },
    { name: "Electrical Distribution", icon: Zap, type: "Electrical", count: "4 assets", status: "ready" },
    { name: "Fire Suppression", icon: Flame, type: "Safety", count: "1 asset", status: "blocked" },
    { name: "HVAC & Precision Cooling", icon: Wind, type: "HVAC", count: "2 assets", status: "ready" },
  ];

  const activeAlertsCount = data.insights.operations.activeAlerts;

  return (
    <article className="surface source-card" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "18px" }}>
      <div className="section-heading" style={{ marginBottom: "12px" }}>
        <div>
          <p className="eyebrow">Infrastructure baseline</p>
          <h2 style={{ fontSize: "18px" }}>Systems & Risk Landscape</h2>
        </div>
        <Link className="text-button" href="/systems">
          View systems <ArrowRight size={14} />
        </Link>
      </div>

      {/* Systems Status 2x2 Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        {systemsList.map((sys) => {
          const Icon = sys.icon;
          return (
            <Link
              key={sys.name}
              href="/systems"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                background: "#f9f9f5",
                textDecoration: "none",
                color: "inherit"
              }}
            >
              <Icon size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: "11px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sys.name}</b>
                <span style={{ fontSize: "9px", color: "var(--muted)" }}>{sys.count}</span>
              </div>
              <StatusPill status={sys.status} compact />
            </Link>
          );
        })}
      </div>

      {/* Equipment Baseline Telemetry Summary Tuples */}
      <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: "5px", background: "#f3f5f3", border: "1px solid #e2e8e4", fontSize: "11px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={13} style={{ color: "var(--primary)" }} />
            <span><b>10 Controlled Assets</b> &middot; Telemetry Mapped</span>
          </div>
          <span style={{ fontSize: "9px", fontFamily: "var(--mono)", color: "var(--primary)", fontWeight: 700 }}>100% COVERAGE</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: "5px", background: "#fbf6ed", border: "1px solid #f5e4cd", fontSize: "11px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={13} style={{ color: "#c0782b" }} />
            <span><b>Pending Verifications:</b> CHWP-03 & FM200-01</span>
          </div>
          <span style={{ fontSize: "9px", fontFamily: "var(--mono)", color: "#c0782b", fontWeight: 700 }}>2 BLOCKERS</span>
        </div>
      </div>

      {/* Predictive Risk Signals Section */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Risk Signals
          </span>
          <span style={{ fontSize: "10px", color: activeAlertsCount > 0 ? "var(--danger)" : "var(--primary)", fontWeight: 700 }}>
            {activeAlertsCount} active alert{activeAlertsCount === 1 ? "" : "s"}
          </span>
        </div>

        <div style={{ display: "grid", gap: "6px" }}>
          <Link
            href="/command-center"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "6px",
              background: "#fdf3f4",
              border: "1px solid #f8c8cc",
              textDecoration: "none",
              color: "#971a27"
            }}
          >
            <ShieldAlert size={15} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: "11px", display: "block" }}>Procurement & Delivery Delay Risk</b>
              <span style={{ fontSize: "10px", opacity: 0.85 }}>72% probability &middot; 3-day ETA drift on CHWP-03</span>
            </div>
            <span style={{ fontSize: "10px", fontWeight: 700 }}>Review &rarr;</span>
          </Link>

          <Link
            href="/shipments"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 10px",
              borderRadius: "6px",
              background: "#fef8f3",
              border: "1px solid #f6e2d0",
              textDecoration: "none",
              color: "#b5651d"
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: "11px", display: "block" }}>Customs & Transit Inspection Delay</b>
              <span style={{ fontSize: "10px", opacity: 0.85 }}>45% probability &middot; 2-day impact on MCC-01 delivery</span>
            </div>
            <span style={{ fontSize: "10px", fontWeight: 700 }}>Track &rarr;</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
