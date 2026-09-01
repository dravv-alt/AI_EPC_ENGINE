import { FeatureShell } from "@/components/feature-shell";
import { LiveFeed } from "@/components/live-feed";
import { getActiveProjectId } from "@/lib/projects/current";
import { getProjectShellData, resolveAlertLinks, type AlertRow } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function humanAlertFacts(alert: AlertRow) {
  const payload = alert.payload && typeof alert.payload === "object" ? alert.payload as Record<string, unknown> : {};
  const facts: string[] = [];
  if (typeof payload.status === "string") facts.push(`Current status: ${payload.status}`);
  if (payload.estimate === true) facts.push("Status is an estimate");
  if (Array.isArray(payload.affectedTaskIds) && payload.affectedTaskIds.length) facts.push(`${payload.affectedTaskIds.length} schedule task${payload.affectedTaskIds.length === 1 ? "" : "s"} affected`);
  if (alert.eventType === "TEST_FAILED") facts.push("Engineer review is required before the gate can advance");
  if (alert.eventType === "SHIPMENT_DELAYED") facts.push("Review the shipment and downstream schedule impact");
  return facts;
}

export default async function CommandCenterPage() {
  const projectId = await getActiveProjectId();
  const [data, items] = await Promise.all([getProjectShellData(projectId), db.select().from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.createdAt))]);
  if (!data) throw new Error("Project not found");
  const resolved = await resolveAlertLinks(projectId, items);
  const active = resolved.filter(({ alert }) => alert.status === "active");
  const cleared = resolved.filter(({ alert }) => alert.status !== "active");
  const AlertCard = ({ alert, links }: typeof resolved[number]) => <article className="surface workflow-card alert-card" key={alert.id}><span className={`source-status ${alert.status === "active" ? "pending" : "processed"}`}>{alert.status}</span><h2>{alert.title}</h2><p>{alert.eventType.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(alert.createdAt)}</p>{links.length > 0 && <nav className="alert-links" aria-label="Related records">{links.map((link) => <a className="button button-secondary" href={link.href} key={link.href}>{link.label}</a>)}</nav>}<ul className="alert-facts">{humanAlertFacts(alert).map((fact) => <li key={fact}>{fact}</li>)}</ul></article>;
  return <FeatureShell projectName={data.project} eyebrow="Global tool · unified event view" title="Alert Center" description="Operational alerts route to the exact finding, gate, task, risk, or shipment context; alert review never changes authoritative dates or readiness."><div className="command-center-layout"><section className="workflow-stack"><header className="alert-summary"><div><p className="eyebrow">Attention required</p><h2>{active.length} active alert{active.length === 1 ? "" : "s"}</h2></div><p>Cleared alerts are retained below for traceability.</p></header>{active.length ? active.map(AlertCard) : <article className="surface empty-state"><h2>No active alerts</h2><p>There are no unresolved operational signals for this project.</p></article>}{cleared.length > 0 && <details className="surface history-panel alert-history"><summary>Cleared alerts ({cleared.length})</summary><div className="workflow-stack">{cleared.map(AlertCard)}</div></details>}</section><LiveFeed projectId={projectId} /></div></FeatureShell>;
}
