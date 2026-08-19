import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";

export function ProjectMetrics({ data }: { data: DashboardData }) {
  const readinessValue = data.metrics.find(m => m.label === "Gate readiness")?.value || "0%";
  const evidenceValue = data.metrics.find(m => m.label === "Accepted evidence")?.value || "0 / 0";
  const actionsValue = data.metrics.find(m => m.label === "Open actions")?.value || "0";
  const actionsDetail = data.metrics.find(m => m.label === "Open actions")?.detail || "Open findings";
  const alertsValue = data.insights.operations.activeAlerts.toString();

  const stripStyle: React.CSSProperties = {
    display: "flex",
    background: "var(--paper)",
    border: "1px solid var(--line)",
    borderRadius: "8px",
    marginBottom: "16px",
    overflow: "hidden"
  };

  const itemStyle: React.CSSProperties = {
    flex: 1,
    padding: "12px 18px",
    textDecoration: "none",
    color: "inherit",
    borderRight: "1px solid var(--line)"
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "9px",
    fontFamily: "var(--mono)",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "4px"
  };

  const valueStyle: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: 500,
    fontFamily: "var(--display)",
    marginBottom: "2px"
  };

  const detailStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "var(--primary)"
  };

  return (
    <div style={stripStyle}>
      <Link href="/readiness" style={itemStyle}>
        <div style={labelStyle}>Readiness</div>
        <div style={valueStyle}>{readinessValue}</div>
        <div style={detailStyle}>Deterministic &rarr;</div>
      </Link>
      
      <Link href="/evidence" style={itemStyle}>
        <div style={labelStyle}>Evidence</div>
        <div style={valueStyle}>{evidenceValue}</div>
        <div style={detailStyle}>Accepted &rarr;</div>
      </Link>

      <Link href="/actions" style={itemStyle}>
        <div style={labelStyle}>Open Work</div>
        <div style={valueStyle}>{actionsValue}</div>
        <div style={detailStyle}>{actionsDetail} &rarr;</div>
      </Link>

      <Link href="/command-center" style={{ ...itemStyle, borderRight: "none" }}>
        <div style={labelStyle}>Active Alerts</div>
        <div style={valueStyle}>{alertsValue}</div>
        <div style={detailStyle}>Command center &rarr;</div>
      </Link>
    </div>
  );
}
