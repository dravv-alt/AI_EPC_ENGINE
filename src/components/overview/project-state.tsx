import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { StatusPill } from "@/components/ui/status-pill";
import { AlertTriangle } from "lucide-react";

export function ProjectState({ data }: { data: DashboardData }) {
  // Find current active/blocked gate item from readiness
  const currentGateItem = data.readiness.find(r => r.state === "blocked" || r.state === "review") || data.readiness[data.readiness.length - 1];
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const primaryBlocker = [...data.actions].sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0))[0];

  return (
    <article className="surface control-hero">
      <div className="control-hero-main">
        <p className="eyebrow">Current decision</p>
        <div className="control-hero-title"><h2>{data.gate}</h2><StatusPill status={currentGateItem ? currentGateItem.state : "review"} /></div>
        {primaryBlocker ? (
          <div className="control-blocker">
            <AlertTriangle size={18} /><div><span>Primary blocker</span><strong>{primaryBlocker.title}</strong></div>
            <Link href={`/actions?finding=${primaryBlocker.id}`}>Open blocker →</Link>
          </div>
        ) : <p className="control-clear">No active blocker is preventing this gate from proceeding.</p>}
      </div>
      <dl className="control-context">
        <div><dt>Project</dt><dd>{data.project}</dd></div>
        <div><dt>Location</dt><dd>Mumbai</dd></div>
      </dl>
    </article>
  );
}
