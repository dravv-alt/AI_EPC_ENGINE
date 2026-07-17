import { FeatureShell } from "@/components/feature-shell";
import { getActiveProjectId } from "@/lib/projects/current";
import { getDashboardData } from "@/lib/dashboard-data";
import { GateDecisionForm } from "@/components/gate-decision-form";
export const dynamic = "force-dynamic";
export default async function ReadinessPage() { const data = await getDashboardData(await getActiveProjectId()); if (!data) throw new Error("Project not found"); return <FeatureShell projectName={data.project} eyebrow="Deterministic rules" title="Readiness" description="Gate status is calculated from accepted requirements, evidence validity, and unresolved blockers."><section className="workflow-grid">{data.readiness.map((gate) => <article className="surface workflow-card" key={gate.gate}><span className={`status-pill ${gate.state}`}>{gate.state === "review" ? "In review" : gate.state}</span><h2>{gate.gate}</h2><p>{gate.system}</p><small>{gate.detail}</small>{gate.state === "ready" && <GateDecisionForm gateId={gate.gateId} />}</article>)}</section></FeatureShell>; }
