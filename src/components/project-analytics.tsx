import Link from "next/link";
import { Activity, ArrowRight, BarChart3, FileCheck2, ShieldCheck } from "lucide-react";
import type React from "react";
import type { DashboardData } from "@/lib/dashboard-data";

const stateLabel: Record<string, string> = { ready: "Ready", review: "In review", blocked: "Blocked", unknown: "Not assessed" };

export function ProjectAnalytics({ data }: { data: DashboardData }) {
  const evidenceTotal = Math.max(1, data.insights.evidence.reduce((sum, item) => sum + item.value, 0));
  const activityMax = Math.max(1, ...data.insights.activity.map((item) => item.value));
  const activityPoints = data.insights.activity.map((item, index) => ({ ...item, x: 34 + index * 72, y: 146 - (item.value / activityMax) * 105 }));
  const linePath = activityPoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const areaPath = activityPoints.length ? `${linePath} L ${activityPoints.at(-1)!.x} 146 L ${activityPoints[0].x} 146 Z` : "";

  return <section className="pm-analytics" aria-label="Live project charts">
    <article className="pm-chart-card pm-gate-chart">
      <header><div><p className="eyebrow">Deterministic progression</p><h2><ShieldCheck size={17} /> Readiness by gate</h2></div><Link href="/readiness">Inspect <ArrowRight size={13} /></Link></header>
      <div className="pm-gate-bars">{data.insights.gateBars.map((gate, index) => <Link href={`/readiness?gate=${gate.id}`} className={`state-${gate.state}`} key={gate.id}><span><b>{gate.label}</b><small>{stateLabel[gate.state]} · {gate.evidence} proof</small></span><div><i style={{ "--bar-width": `${gate.percent}%`, "--bar-delay": `${index * 110}ms` } as React.CSSProperties} /></div><strong>{gate.percent}%</strong></Link>)}{!data.insights.gateBars.length && <p className="pm-empty">No gates are configured.</p>}</div>
    </article>

    <article className="pm-chart-card pm-evidence-chart">
      <header><div><p className="eyebrow">Proof quality</p><h2><FileCheck2 size={17} /> Evidence composition</h2></div><Link href="/evidence">Open register <ArrowRight size={13} /></Link></header>
      <div className="pm-evidence-total"><strong>{data.insights.evidence.reduce((sum, item) => sum + item.value, 0)}</strong><span>records</span></div>
      <div className="pm-stacked-bar">{data.insights.evidence.map((item, index) => <i className={`tone-${item.tone}`} title={`${item.label}: ${item.value}`} style={{ "--segment-width": `${(item.value / evidenceTotal) * 100}%`, "--segment-delay": `${250 + index * 130}ms` } as React.CSSProperties} key={item.label} />)}</div>
      <ul>{data.insights.evidence.map((item) => <li key={item.label}><i className={`tone-${item.tone}`} /><span>{item.label}</span><b>{item.value}</b><small>{Math.round(item.value / evidenceTotal * 100)}%</small></li>)}</ul>
    </article>

    <article className="pm-chart-card pm-activity-chart">
      <header><div><p className="eyebrow">Append-only audit stream</p><h2><Activity size={17} /> Seven-day activity</h2></div><span>{data.insights.activity.reduce((sum, item) => sum + item.value, 0)} events</span></header>
      <div className="pm-line-chart"><svg viewBox="0 0 500 180" role="img" aria-label={`Seven-day activity: ${data.insights.activity.map((item) => `${item.label} ${item.value}`).join(", ")}`}>
        <defs><linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-blue)" stopOpacity=".30" /><stop offset="100%" stopColor="var(--chart-blue)" stopOpacity="0" /></linearGradient></defs>
        <g className="pm-chart-grid">{[41, 76, 111, 146].map((y) => <line x1="34" x2="466" y1={y} y2={y} key={y} />)}</g>
        {areaPath && <path className="pm-activity-area" d={areaPath} />}{linePath && <path className="pm-activity-line-path" pathLength="1" d={linePath} />}
        {activityPoints.map((point, index) => <g className="pm-activity-point" style={{ "--point-delay": `${700 + index * 90}ms` } as React.CSSProperties} key={point.label}><circle cx={point.x} cy={point.y} r="4" /><text x={point.x} y={point.y - 11} textAnchor="middle">{point.value}</text><text className="pm-day-label" x={point.x} y="169" textAnchor="middle">{point.label}</text></g>)}
      </svg></div>
    </article>

    <article className="pm-chart-card pm-severity-chart">
      <header><div><p className="eyebrow">Open accountable work</p><h2><BarChart3 size={17} /> Issue severity</h2></div><Link href="/actions">View queue <ArrowRight size={13} /></Link></header>
      <div>{data.insights.actionSeverity.map((item, index) => { const max = Math.max(1, ...data.insights.actionSeverity.map((row) => row.value)); return <div className={`pm-severity-bar severity-${item.label}`} key={item.label}><span>{item.label}</span><div><i style={{ "--bar-width": `${item.value ? Math.max(7, item.value / max * 100) : 0}%`, "--bar-delay": `${350 + index * 100}ms` } as React.CSSProperties} /></div><b>{item.value}</b></div>; })}</div>
    </article>
  </section>;
}
