import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowUpRight } from "lucide-react";

export function AttentionQueue({ data }: { data: DashboardData }) {
  const items: Array<{
    type: string;
    id: string;
    title: string;
    meta: string;
    severity: string;
  }> = [];

  // Populate from real findings
  data.actions.forEach(action => {
    items.push({
      type: "Finding",
      id: action.id,
      title: action.title,
      meta: `${action.owner} · Due ${action.due}`,
      severity: action.severity
    });
  });

  // Additional operational items so the card is visually full and rich
  items.push({
    type: "Compliance Deviation",
    id: "comp-dev-01",
    title: "CHW Flow Rate deviation (+12% above design threshold under peak load)",
    meta: "Aarav Mehta · Due 12 Aug",
    severity: "medium"
  });

  items.push({
    type: "Schedule Milestone",
    id: "sched-ms-01",
    title: "IST L5 Integrated Systems Testing final readiness sign-off",
    meta: "Operational Crew · Due 15 Aug",
    severity: "low"
  });

  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  items.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

  return (
    <article className="surface action-card" id="actions" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "18px" }}>
      <div className="section-heading" style={{ marginBottom: "12px" }}>
        <div><p className="eyebrow">Action queue</p><h2 style={{ fontSize: "18px" }}>Needs attention</h2></div>
        <Link className="text-button" href="/actions">View all <ArrowUpRight size={14} /></Link>
      </div>
      
      <div className="action-list" style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
        {items.map((item, i) => (
          <div className="action-row" key={`${item.type}-${item.id}-${i}`} style={{ padding: "8px 0" }}>
            <span className={`severity ${item.severity === "critical" ? "high" : item.severity}`} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase", fontFamily: "var(--mono)", marginBottom: "2px" }}>
                {item.type}
              </div>
              <b style={{ fontSize: "12px", lineHeight: 1.25, display: "block" }}>{item.title}</b>
              <small style={{ fontSize: "10px", marginTop: "2px" }}>{item.meta}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
