"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowRight, BarChart3, ShieldCheck, Route, FileSearch, AlertTriangle } from "lucide-react";

const toneColor: Record<string, string> = {
  ready: "#2d6b55",
  review: "#c0782b",
  blocked: "#b52b3b",
  unknown: "#8b938f"
};

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

function RingChart({ rows, label }: { rows: Array<{ label: string; value: number; tone: string }>; label: string }) {
  const total = Math.max(1, rows.reduce((sum, item) => sum + item.value, 0));
  let offset = 0;

  return (
    <div className="dashboard-ring-wrap">
      <svg className="dashboard-ring" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}`}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#e4e8e5" strokeWidth="12" />
        {rows.map((row) => {
          const length = (row.value / total) * 238.76;
          const circle = (
            <circle
              key={row.label}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={toneColor[row.tone] ?? toneColor.unknown}
              strokeWidth="12"
              strokeDasharray={`${length} ${238.76 - length}`}
              strokeDashoffset={-offset}
              pathLength="238.76"
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <div>
        <strong><AnimatedMetricValue value={String(rows.reduce((sum, item) => sum + item.value, 0))} /></strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ProjectHealth({ data }: { data: DashboardData }) {
  const { evidence, requirements, actionSeverity, operations } = data.insights;
  const severityMax = Math.max(1, ...actionSeverity.map((item) => item.value));

  return (
    <div className="dashboard-insight-grid" style={{ marginBottom: "16px" }}>
      {/* 5A. SVG RING DONUT CHARTS (EVIDENCE & REQUIREMENTS) */}
      <article className="surface dashboard-chart dashboard-distribution" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">Controlled records</p>
            <h2 style={{ fontSize: "18px" }}>Evidence & requirements</h2>
          </div>
          <FileSearch size={18} style={{ color: "var(--muted)" }} />
        </header>

        <div className="dashboard-rings">
          <div>
            <RingChart rows={evidence} label="evidence" />
            <ul>
              {evidence.map((row) => (
                <li key={row.label}>
                  <i style={{ background: toneColor[row.tone] }} />
                  {row.label}
                  <b>{row.value}</b>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <RingChart rows={requirements} label="requirements" />
            <ul>
              {requirements.map((row) => (
                <li key={row.label}>
                  <i style={{ background: toneColor[row.tone] }} />
                  {row.label}
                  <b>{row.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {/* 5B. OPEN FINDING SEVERITY */}
      <article className="surface dashboard-chart dashboard-severity" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">Accountable work</p>
            <h2 style={{ fontSize: "18px" }}>Open finding severity</h2>
          </div>
          <AlertTriangle size={18} style={{ color: "var(--muted)" }} />
        </header>
        <div>
          {actionSeverity.map((row) => (
            <div className="dashboard-severity-row" key={row.label} style={{ marginBottom: "8px" }}>
              <span>{row.label}</span>
              <div>
                <i style={{ width: `${(row.value / severityMax) * 100}%`, background: toneColor[row.tone] }} />
              </div>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
        <Link className="dashboard-inline-link" href="/actions" style={{ marginTop: "14px" }}>
          Manage findings <ArrowRight size={14} />
        </Link>
      </article>

      {/* 5C. DELIVERY PULSE */}
      <article className="surface dashboard-chart dashboard-operations" style={{ padding: "18px" }}>
        <header style={{ marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">Live operations</p>
            <h2 style={{ fontSize: "18px" }}>Delivery pulse</h2>
          </div>
          <BarChart3 size={18} style={{ color: "var(--muted)" }} />
        </header>
        <div className="dashboard-operation-stats">
          <Link href="/shipments">
            <Route size={16} />
            <span>
              <b style={{ color: operations.delayedShipments > 0 ? "var(--danger)" : "inherit" }}>
                {operations.delayedShipments}/{operations.shipments}
              </b> delayed shipments
            </span>
          </Link>
          <Link href="/schedule">
            <BarChart3 size={16} />
            <span><b>{operations.acceptedTasks}</b> accepted tasks</span>
          </Link>
          <Link href="/schedule">
            <ShieldCheck size={16} />
            <span>
              <b>{operations.scheduleVersion ? `v${operations.scheduleVersion}` : "-"}</b> {operations.scheduleStatus.replaceAll("_", " ")}
            </span>
          </Link>
        </div>
      </article>
    </div>
  );
}
