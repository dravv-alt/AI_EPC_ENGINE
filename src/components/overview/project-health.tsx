import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowRight, BarChart3, ShieldCheck, Route } from "lucide-react";

export function ProjectHealth({ data }: { data: DashboardData }) {
  const { evidence, requirements, actionSeverity, operations } = data.insights;

  const getEvidence = (label: string) => evidence.find(e => e.label === label)?.value || 0;
  const getRequirement = (label: string) => requirements.find(r => r.label === label)?.value || 0;
  const getAction = (label: string) => actionSeverity.find(a => a.label === label)?.value || 0;

  const totalEvidence = getEvidence("Accepted") + getEvidence("Pending") + getEvidence("Stale / failed");
  const acceptedEvidence = getEvidence("Accepted");
  
  const criticalFindings = getAction("critical");
  const highFindings = getAction("high");
  const mediumFindings = getAction("medium");
  const lowFindings = getAction("low");
  const maxFindings = Math.max(criticalFindings, highFindings, mediumFindings, lowFindings, 1);

  return (
    <div className="dashboard-insight-grid" style={{ marginBottom: "16px" }}>
      {/* 5A. EVIDENCE / REQUIREMENTS HEALTH */}
      <article className="surface dashboard-chart" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "12px" }}>
          <div><p className="eyebrow">Controlled records</p><h2 style={{ fontSize: "18px" }}>Evidence Health</h2></div>
        </header>
        
        <div style={{ marginBottom: "12px", fontSize: "22px", fontFamily: "var(--display)", fontWeight: 500 }}>
          {acceptedEvidence} <span style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 400, fontFamily: "var(--body)" }}>/ {totalEvidence} accepted</span>
        </div>
        
        <div style={{ display: "flex", height: "7px", background: "#e5e9e6", borderRadius: "99px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ background: "#2d6b55", height: "100%", width: `${totalEvidence ? (acceptedEvidence / totalEvidence) * 100 : 0}%` }} />
          <div style={{ background: "#c0782b", height: "100%", width: `${totalEvidence ? (getEvidence("Pending") / totalEvidence) * 100 : 0}%` }} />
          <div style={{ background: "#b52b3b", height: "100%", width: `${totalEvidence ? (getEvidence("Stale / failed") / totalEvidence) * 100 : 0}%` }} />
        </div>
        
        <div style={{ display: "grid", gap: "6px", fontSize: "11px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#2d6b55" }} />Accepted</span><b>{acceptedEvidence}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#c0782b" }} />Pending</span><b>{getEvidence("Pending")}</b></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#b52b3b" }} />Stale / failed</span><b>{getEvidence("Stale / failed")}</b></div>
        </div>
        
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "auto" }}>
          <div style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", marginBottom: "6px" }}>Requirements</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", fontSize: "11px" }}>
            <div><b style={{ display: "block", fontSize: "13px" }}>{getRequirement("Accepted")}</b><span style={{ color: "var(--muted)", fontSize: "10px" }}>accepted</span></div>
            <div><b style={{ display: "block", fontSize: "13px" }}>{getRequirement("Proposed")}</b><span style={{ color: "var(--muted)", fontSize: "10px" }}>proposed</span></div>
            <div><b style={{ display: "block", fontSize: "13px" }}>{getRequirement("Edited / rejected")}</b><span style={{ color: "var(--muted)", fontSize: "10px" }}>edited</span></div>
          </div>
        </div>
      </article>

      {/* 5B. FINDING HEALTH */}
      <article className="surface dashboard-chart dashboard-severity" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "12px" }}>
          <div><p className="eyebrow">Accountable work</p><h2 style={{ fontSize: "18px" }}>Finding Health</h2></div>
        </header>
        <div>
          <div className="dashboard-severity-row" style={{ marginBottom: "10px" }}>
            <span>Critical</span>
            <div><i style={{ width: `${(criticalFindings / maxFindings) * 100}%`, background: "#a91f32" }} /></div>
            <b>{criticalFindings}</b>
          </div>
          <div className="dashboard-severity-row" style={{ marginBottom: "10px" }}>
            <span>High</span>
            <div><i style={{ width: `${(highFindings / maxFindings) * 100}%`, background: "#c84b3d" }} /></div>
            <b>{highFindings}</b>
          </div>
          <div className="dashboard-severity-row" style={{ marginBottom: "10px" }}>
            <span>Medium</span>
            <div><i style={{ width: `${(mediumFindings / maxFindings) * 100}%`, background: "#c98431" }} /></div>
            <b>{mediumFindings}</b>
          </div>
          <div className="dashboard-severity-row" style={{ marginBottom: "10px" }}>
            <span>Low</span>
            <div><i style={{ width: `${(lowFindings / maxFindings) * 100}%`, background: "#668678" }} /></div>
            <b>{lowFindings}</b>
          </div>
        </div>
        <Link className="dashboard-inline-link" href="/actions" style={{ marginTop: "12px" }}>Manage findings <ArrowRight size={14} /></Link>
      </article>

      {/* 5C. DELIVERY PULSE */}
      <article className="surface dashboard-chart dashboard-operations" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "12px" }}>
          <div><p className="eyebrow">Live operations</p><h2 style={{ fontSize: "18px" }}>Delivery pulse</h2></div>
        </header>
        <div className="dashboard-operation-stats">
          <Link href="/shipments">
            <Route size={16} />
            <span><b style={{ color: operations.delayedShipments > 0 ? "var(--danger)" : "inherit" }}>{operations.delayedShipments}/{operations.shipments}</b> delayed shipments</span>
          </Link>
          <Link href="/schedule">
            <BarChart3 size={16} />
            <span><b>{operations.acceptedTasks}</b> accepted tasks</span>
          </Link>
          <Link href="/schedule">
            <ShieldCheck size={16} />
            <span><b>{operations.scheduleVersion ? `v${operations.scheduleVersion}` : "-"}</b> {operations.scheduleStatus.replaceAll("_", " ")}</span>
          </Link>
        </div>
      </article>
    </div>
  );
}
