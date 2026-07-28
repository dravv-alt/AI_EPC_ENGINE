"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  FileSearch,
  FileUp,
  FlaskConical,
  Route,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";

const toneColor: Record<string, string> = {
  ready: "#2d6b55",
  review: "#c0782b",
  blocked: "#b52b3b",
  unknown: "#8b938f",
  critical: "#a91f32",
  high: "#c84b3d",
  medium: "#c98431",
  low: "#668678"
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
  return <div className="dashboard-ring-wrap">
    <svg className="dashboard-ring" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}`}>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#e4e8e5" strokeWidth="12" />
      {rows.map((row) => {
        const length = row.value / total * 238.76;
        const circle = <circle key={row.label} cx="50" cy="50" r="38" fill="none" stroke={toneColor[row.tone] ?? toneColor.unknown} strokeWidth="12" strokeDasharray={`${length} ${238.76 - length}`} strokeDashoffset={-offset} pathLength="238.76" />;
        offset += length;
        return circle;
      })}
    </svg>
    <div><strong><AnimatedMetricValue value={String(rows.reduce((sum, item) => sum + item.value, 0))} /></strong><span>{label}</span></div>
  </div>;
}

export function DashboardInsights({ data }: { data: DashboardData }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const activityMax = useMemo(() => Math.max(1, ...data.insights.activity.map((item) => item.value)), [data.insights.activity]);
  const severityMax = useMemo(() => Math.max(1, ...data.insights.actionSeverity.map((item) => item.value)), [data.insights.actionSeverity]);
  const ops = data.insights.operations;

  return <section className={`dashboard-control-room ${entered ? "is-entered" : ""}`} aria-label="Project control dashboard">
    <div className="dashboard-metrics">
      {data.metrics.map((metric, index) => <Link href={index === 0 ? "/readiness" : index === 1 ? "/evidence" : "/actions"} className={`metric-card metric-${metric.tone}`} key={metric.label}>
        <span>{metric.label}</span>
        <strong><AnimatedMetricValue value={metric.value} /></strong>
        <small>{metric.detail}</small>
        <ArrowRight size={15} aria-hidden="true" />
      </Link>)}
      <Link href="/command-center" className="metric-card metric-live">
        <span>Active alerts</span>
        <strong><AnimatedMetricValue value={String(ops.activeAlerts)} /></strong>
        <small>{ops.activeAlerts ? "Open command center items" : "No active alerts"}</small>
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>

    <div className="dashboard-insight-grid">
      <article className="surface dashboard-chart dashboard-gates-chart">
        <header><div><p className="eyebrow">Deterministic readiness</p><h2>Gate progress</h2></div><Link href="/readiness">Open board <ArrowRight size={14} /></Link></header>
        <div className="dashboard-gate-bars">{data.insights.gateBars.map((gate) => <Link href={`/readiness?gate=${gate.id}`} className="dashboard-gate-bar" key={gate.id}>
          <div><b>{gate.label}</b><span>{gate.evidence} evidence · {gate.state}</span></div>
          <div className="dashboard-bar-track"><i className={`tone-${gate.state}`} style={{ width: entered ? `${gate.percent}%` : "0%" }} /></div>
          <strong>{gate.percent}%</strong>
        </Link>)}</div>
      </article>

      <article className="surface dashboard-chart dashboard-distribution">
        <header><div><p className="eyebrow">Controlled records</p><h2>Evidence & requirements</h2></div><FileSearch size={18} /></header>
        <div className="dashboard-rings">
          <div><RingChart rows={data.insights.evidence} label="evidence" /><ul>{data.insights.evidence.map((row) => <li key={row.label}><i style={{ background: toneColor[row.tone] }} />{row.label}<b>{row.value}</b></li>)}</ul></div>
          <div><RingChart rows={data.insights.requirements} label="requirements" /><ul>{data.insights.requirements.map((row) => <li key={row.label}><i style={{ background: toneColor[row.tone] }} />{row.label}<b>{row.value}</b></li>)}</ul></div>
        </div>
      </article>

      <article className="surface dashboard-chart dashboard-severity">
        <header><div><p className="eyebrow">Accountable work</p><h2>Open finding severity</h2></div><AlertTriangle size={18} /></header>
        <div>{data.insights.actionSeverity.map((row) => <div className="dashboard-severity-row" key={row.label}>
          <span>{row.label}</span>
          <div><i style={{ width: entered ? `${row.value / severityMax * 100}%` : "0%", background: toneColor[row.tone] }} /></div>
          <b>{row.value}</b>
        </div>)}</div>
        <Link className="dashboard-inline-link" href="/actions">Manage findings <ArrowRight size={14} /></Link>
      </article>

      <article className="surface dashboard-chart dashboard-operations">
        <header><div><p className="eyebrow">Live operations</p><h2>Delivery pulse</h2></div><BarChart3 size={18} /></header>
        <div className="dashboard-operation-stats">
          <Link href="/shipments"><Route size={18} /><span><b>{ops.delayedShipments}/{ops.shipments}</b> delayed shipments</span></Link>
          <Link href="/schedule"><BarChart3 size={18} /><span><b>{ops.acceptedTasks}</b> accepted tasks</span></Link>
          <Link href="/schedule"><ShieldCheck size={18} /><span><b>{ops.scheduleVersion ? `v${ops.scheduleVersion}` : "—"}</b> {ops.scheduleStatus.replaceAll("_", " ")}</span></Link>
        </div>
      </article>

      <article className="surface dashboard-chart dashboard-activity">
        <header><div><p className="eyebrow">Append-only authority</p><h2>7-day activity</h2></div><Link href="/graph">Audit timeline <ArrowRight size={14} /></Link></header>
        <div className="dashboard-spark-bars">{data.insights.activity.map((item) => <div key={item.label}><i style={{ height: entered ? `${Math.max(8, item.value / activityMax * 100)}%` : "0%" }} title={`${item.value} audit events`} /><b>{item.value}</b><span>{item.label}</span></div>)}</div>
      </article>

      <article className="surface dashboard-chart dashboard-recent">
        <header><div><p className="eyebrow">Latest persisted changes</p><h2>Recent authority trail</h2></div></header>
        <div>{data.insights.recentActivity.map((event) => <div className="dashboard-audit-row" key={event.id}><i /><div><b>{event.action}</b><span>{event.entityType} · {event.actor}</span></div><time>{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.at))}</time></div>)}</div>
        {!data.insights.recentActivity.length && <p className="empty-copy">No persisted project mutations yet.</p>}
      </article>
    </div>

    <article className="surface dashboard-quick-actions">
      <div><p className="eyebrow">Direct controls</p><h2>Start controlled work</h2></div>
      <nav aria-label="Dashboard quick actions">
        <a href="#source-upload"><FileUp size={17} /><span>Upload source</span></a>
        <Link href="/field-capture"><Camera size={17} /><span>Capture evidence</span></Link>
        <Link href="/cx"><FlaskConical size={17} /><span>Run Cx test</span></Link>
        <Link href="/shipments"><Route size={17} /><span>Monitor shipment</span></Link>
        <Link href="/knowledge"><FileSearch size={17} /><span>Search knowledge</span></Link>
        <Link href="/actions"><AlertTriangle size={17} /><span>Create finding</span></Link>
      </nav>
    </article>
  </section>;
}
