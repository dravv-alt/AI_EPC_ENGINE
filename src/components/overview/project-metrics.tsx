"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowRight } from "lucide-react";

function AnimatedMetricValue({ value }: { value: string }) {
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? Number(match[1]) : 0;
  const suffix = match?.[2] ?? value;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!match) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / 750);
      setCurrent(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress >= 1) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [target, value]);

  return <>{match ? `${current}${suffix}` : value}</>;
}

export function ProjectMetrics({ data }: { data: DashboardData }) {
  const readinessValue = data.metrics.find(m => m.label === "Gate readiness")?.value || "0%";
  const evidenceValue = data.metrics.find(m => m.label === "Accepted evidence")?.value || "0 / 0";
  const actionsValue = data.metrics.find(m => m.label === "Open actions")?.value || "0";
  const actionsDetail = data.metrics.find(m => m.label === "Open actions")?.detail || "Open findings";
  const alertsValue = data.insights.operations.activeAlerts.toString();

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
    <div className="project-metrics-strip">
      <Link href="/readiness" className="project-metrics-item metric-primary">
        <div style={labelStyle}>Readiness</div>
        <div style={valueStyle}><AnimatedMetricValue value={readinessValue} /></div>
        <div style={detailStyle}>Deterministic &rarr;</div>
      </Link>
      
      <Link href="/evidence" className="project-metrics-item metric-secondary">
        <div style={labelStyle}>Evidence</div>
        <div style={valueStyle}><AnimatedMetricValue value={evidenceValue} /></div>
        <div style={detailStyle}>Accepted &rarr;</div>
      </Link>

      <Link href="/actions" className="project-metrics-item metric-tertiary">
        <div style={labelStyle}>Open Work</div>
        <div style={valueStyle}><AnimatedMetricValue value={actionsValue} /></div>
        <div style={detailStyle}>{actionsDetail} &rarr;</div>
      </Link>

      <Link href="/command-center" className="project-metrics-item metric-live">
        <div style={labelStyle}>Active Alerts</div>
        <div style={valueStyle}><AnimatedMetricValue value={alertsValue} /></div>
        <div style={detailStyle}>Command center &rarr;</div>
      </Link>
    </div>
  );
}
