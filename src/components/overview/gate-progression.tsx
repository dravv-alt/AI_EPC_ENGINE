import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { StatusPill } from "@/components/ui/status-pill";
import { ArrowUpRight } from "lucide-react";

export function GateProgression({ data }: { data: DashboardData }) {
  if (!data.readiness || data.readiness.length === 0) {
    return (
      <article className="surface" style={{ padding: "18px", height: "100%" }}>
        <header className="section-heading" style={{ marginBottom: "12px" }}>
          <div><p className="eyebrow">Progression</p><h2 style={{ fontSize: "18px" }}>Gate Progression</h2></div>
        </header>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>No gates configured.</div>
      </article>
    );
  }

  return (
    <article className="surface" style={{ padding: "18px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div><p className="eyebrow">Progression</p><h2 style={{ fontSize: "18px" }}>Gate Progression</h2></div>
        <Link className="text-button" href="/readiness">Open board <ArrowUpRight size={14} /></Link>
      </div>
      
      {/* Visual Connected Timeline */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", marginBottom: "20px", padding: "0 8px" }}>
        <div style={{ position: "absolute", top: "10px", left: "20px", right: "20px", height: "2px", background: "var(--line)", zIndex: 0 }} />
        
        {data.readiness.map((item, i) => {
          const isBlocked = item.state === "blocked";
          const isReady = item.state === "ready";
          const isReview = item.state === "review";
          
          let dotColor = "#98a19d";
          let dotBorder = "#e5e9e6";
          if (isReady) { dotColor = "#2d6b55"; dotBorder = "#e3eee7"; }
          if (isReview) { dotColor = "#c0782b"; dotBorder = "#f8eadb"; }
          if (isBlocked) { dotColor = "#b52b3b"; dotBorder = "#f8e3e5"; }

          const shortLabelMatch = item.gate.match(/^(L\d+)/i);
          const shortLabel = shortLabelMatch ? shortLabelMatch[1] : `G${i + 1}`;
          const gateName = shortLabelMatch ? item.gate.replace(/^(L\d+)[ -:]*/i, "") : item.gate;

          return (
            <Link 
              key={item.gateId} 
              href={`/readiness?gate=${item.gateId}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, textAlign: "center", textDecoration: "none", color: "inherit", position: "relative", zIndex: 1 }}
            >
              <div style={{ fontSize: "9px", fontFamily: "var(--mono)", color: "var(--muted)", marginBottom: "4px" }}>{shortLabel}</div>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: `2.5px solid ${dotBorder}`, background: dotColor, marginBottom: "8px" }} />
              <StatusPill status={item.state} compact />
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", lineHeight: 1.2, maxWidth: "100px", marginTop: "6px" }}>
                {gateName}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Gate Breakdown List (Fills white space with rich details) */}
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "auto" }}>
        <div style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
          Gate Breakdown Details
        </div>
        <div style={{ display: "grid", gap: "6px" }}>
          {data.readiness.map((gate) => (
            <Link 
              key={gate.gateId} 
              href={`/readiness?gate=${gate.gateId}`}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                padding: "6px 10px", 
                borderRadius: "5px", 
                background: gate.gateId === data.activeGateId ? "#edf2ef" : "transparent",
                border: gate.gateId === data.activeGateId ? "1px solid #c7d1cb" : "1px solid transparent",
                textDecoration: "none",
                color: "inherit"
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", display: "block" }}>{gate.gate}</span>
                <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>{gate.detail}</span>
              </div>
              <StatusPill status={gate.state} compact />
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
