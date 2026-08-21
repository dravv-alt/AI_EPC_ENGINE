import Link from "next/link";
import { ArrowRight, Boxes, ShieldAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { StatusPill } from "@/components/ui/status-pill";

export function SystemsAndRisks({ data }: { data: DashboardData }) {
  return <article className="surface source-card" style={{ height: "100%", display: "flex", flexDirection: "column", padding: 18 }}>
    <div className="section-heading" style={{ marginBottom: 12 }}><div><p className="eyebrow">Live controlled hierarchy</p><h2 style={{ fontSize: 18 }}>Systems & assets</h2></div><Link className="text-button" href="/systems">Open register <ArrowRight size={14} /></Link></div>
    <div style={{ display: "grid", gap: 8 }}>
      {data.systems.map((system) => <Link key={system.id} href="/systems" className="entity-row" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10, textDecoration: "none" }}><Boxes size={15} /><span><b>{system.name}</b><small>{system.type.replaceAll("_", " ")} · {system.assetCount} asset{system.assetCount === 1 ? "" : "s"} · {system.gateCount} gate{system.gateCount === 1 ? "" : "s"}</small></span><StatusPill status={system.state} compact /></Link>)}
      {!data.systems.length && <p className="workflow-hint">No systems are stored for this project.</p>}
    </div>
    <div style={{ borderTop: "1px solid var(--line)", marginTop: "auto", paddingTop: 12 }}><Link href="/command-center" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}><ShieldAlert size={15} /><span><b>{data.insights.operations.activeAlerts} active alert{data.insights.operations.activeAlerts === 1 ? "" : "s"}</b><small style={{ display: "block" }}>Loaded from the project alert register</small></span><ArrowRight size={14} /></Link></div>
  </article>;
}
