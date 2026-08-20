import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowUpRight } from "lucide-react";

export function GateProgression({ data }: { data: DashboardData }) {
  if (!data.readiness || data.readiness.length === 0) {
    return (
      <article className="surface gate-path-card">
        <header className="section-heading">
          <div><p className="eyebrow">Delivery path</p><h2>Gate path</h2></div>
        </header>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>No gates configured.</div>
      </article>
    );
  }

  return (
    <article className="surface gate-path-card">
      <div className="section-heading">
        <div><p className="eyebrow">Delivery path</p><h2>Gate path</h2></div>
        <Link className="text-button" href="/readiness">Open board <ArrowUpRight size={14} /></Link>
      </div>
      <ol className="gate-path-list">
        {data.readiness.map((gate, index) => {
          const shortLabelMatch = gate.gate.match(/^(L\d+)/i);
          const shortLabel = shortLabelMatch ? shortLabelMatch[1] : `G${index + 1}`;
          const gateName = shortLabelMatch ? gate.gate.replace(/^(L\d+)[ -:]*/i, "") : gate.gate;
          return <li key={gate.gateId} className={`is-${gate.state}`}>
            <Link href={`/readiness?gate=${gate.gateId}`}>
              <span className="gate-step">{shortLabel}</span><span className="gate-path-copy"><b>{gateName}</b><small>{gate.detail}</small></span><span className="gate-path-state">{gate.state.replaceAll("_", " ")}</span>
            </Link>
          </li>;
        })}
      </ol>
    </article>
  );
}
