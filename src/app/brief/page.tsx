import Link from "next/link";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const projectId = await getActiveProjectId();
  const data = await getDashboardData(projectId);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Controlled project brief" title={data.project} description={`Current commissioning focus: ${data.gate}.`}>
    <section className="metric-grid" aria-label="Project brief metrics">{data.metrics.map((metric) => <article className={`metric-card metric-${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</section>
    <div className="two-column">
      <article className="surface workflow-card"><h2>Readiness focus</h2>{data.readiness.map((gate) => <Link className="entity-row" href={`/readiness?gate=${gate.gateId}`} key={gate.gateId}><div><b>{gate.gate}</b><span>{gate.system}</span></div><small>{gate.state.replaceAll("_", " ")}<br />{gate.detail}</small></Link>)}</article>
      <article className="surface workflow-card"><h2>Immediate actions</h2>{data.actions.map((action) => <Link className="entity-row" href={`/actions?finding=${action.id}`} key={action.id}><div><b>{action.title}</b><span>{action.owner}</span></div><small>{action.severity}<br />Due {action.due}</small></Link>)}{!data.actions.length && <p className="workflow-hint">No active findings.</p>}</article>
    </div>
  </FeatureShell>;
}
