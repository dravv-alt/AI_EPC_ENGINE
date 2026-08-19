import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { StatusPill } from "@/components/ui/status-pill";
import { AlertTriangle, ArrowRight } from "lucide-react";

export function ProjectState({ data }: { data: DashboardData }) {
  // Find current active/blocked gate item
  const currentGateItem = data.readiness.find(r => r.gateId === data.activeGateId) || data.readiness[0];
  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const primaryBlocker = [...data.actions].sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0))[0];

  return (
    <div 
      className="surface"
      style={{ 
        padding: "16px 20px", 
        marginBottom: "16px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
            Active Stage / Gate
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "22px", margin: 0, fontFamily: "var(--display)", fontWeight: 500 }}>
              {data.gate}
            </h2>
            <StatusPill status={currentGateItem ? currentGateItem.state : (data.status === "On track" ? "ready" : "review")} />
          </div>
        </div>

        {primaryBlocker && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8e3e5", border: "1px solid #f0b8bd", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", color: "#971a27" }}>
            <AlertTriangle size={14} style={{ shrink: 0 }} />
            <span><strong>Blocker:</strong> {primaryBlocker.title}</span>
            <Link href={`/actions?finding=${primaryBlocker.id}`} style={{ color: "#971a27", fontWeight: 700, textDecoration: "underline", marginLeft: "4px" }}>
              View &rarr;
            </Link>
          </div>
        )}
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--mono)" }}>Project</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{data.project}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--mono)" }}>Location</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{data.location}</div>
        </div>
      </div>
    </div>
  );
}
