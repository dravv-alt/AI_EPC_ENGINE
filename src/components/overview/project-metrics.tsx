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

function MetricVisual({ kind }: { kind: "readiness" | "evidence" | "work" | "alerts" }) {
  if (kind === "readiness") {
    return <div className="metric-visual metric-visual-readiness" aria-hidden="true"><i /><span /><span /><span /><span /><b /></div>;
  }
  if (kind === "evidence") {
    return <div className="metric-visual metric-visual-evidence" aria-hidden="true"><i /><i /><i /><b>✓</b></div>;
  }
  if (kind === "work") {
    return <div className="metric-visual metric-visual-work" aria-hidden="true"><i><b /></i><i><b /></i><i><b /></i></div>;
  }
  return <div className="metric-visual metric-visual-alerts" aria-hidden="true"><i /><i /><i /><b /></div>;
}

export function ProjectMetrics({ data }: { data: DashboardData }) {
  const readinessValue = data.metrics.find(m => m.label === "Gate readiness")?.value || "0%";
  const evidenceValue = data.metrics.find(m => m.label === "Accepted evidence")?.value || "0 / 0";
  const actionsValue = data.metrics.find(m => m.label === "Open actions")?.value || "0";
  const actionsDetail = data.metrics.find(m => m.label === "Open actions")?.detail || "Open findings";
  const alertsValue = data.insights.operations.activeAlerts.toString();

  return (
    <div className="project-metrics-strip">
      <Link href="/readiness" className="project-metrics-item metric-primary">
        <MetricVisual kind="readiness" />
        <div className="metric-label">Readiness</div>
        <div className="metric-value"><AnimatedMetricValue value={readinessValue} /></div>
        <div className="metric-detail">Deterministic <span aria-hidden="true">→</span></div>
      </Link>
      
      <Link href="/evidence" className="project-metrics-item metric-secondary">
        <MetricVisual kind="evidence" />
        <div className="metric-label">Evidence</div>
        <div className="metric-value"><AnimatedMetricValue value={evidenceValue} /></div>
        <div className="metric-detail">Accepted <span aria-hidden="true">→</span></div>
      </Link>

      <Link href="/actions" className="project-metrics-item metric-tertiary">
        <MetricVisual kind="work" />
        <div className="metric-label">Open Work</div>
        <div className="metric-value"><AnimatedMetricValue value={actionsValue} /></div>
        <div className="metric-detail">{actionsDetail} <span aria-hidden="true">→</span></div>
      </Link>

      <Link href="/command-center" className="project-metrics-item metric-live">
        <MetricVisual kind="alerts" />
        <div className="metric-label">Active Alerts</div>
        <div className="metric-value"><AnimatedMetricValue value={alertsValue} /></div>
        <div className="metric-detail">Alert Center <span aria-hidden="true">→</span></div>
      </Link>
    </div>
  );
}
