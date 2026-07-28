import { FeatureShell } from "@/components/feature-shell";
import { LiveFeed } from "@/components/live-feed";
import { getActiveProjectId } from "@/lib/projects/current";
import { getDashboardData, resolveAlertLinks, type AlertRow } from "@/lib/dashboard-data";
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
  const [data, items] = await Promise.all([getDashboardData(projectId), db.select().from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.createdAt))]);
  if (!data) throw new Error("Project not found");
  const resolved = await resolveAlertLinks(projectId, items);
  return <FeatureShell projectName={data.project} eyebrow="Unified event view" title="Command center" description="Operational alerts route to the exact finding, gate, task, risk, or shipment context; alert review never changes authoritative dates or readiness."><div className="command-center-layout"><div className="workflow-stack">{resolved.map(({ alert, links }) => <article className="surface workflow-card" key={alert.id}><span className={`source-status ${alert.status === "active" ? "pending" : "processed"}`}>{alert.status}</span><h2>{alert.title}</h2><p>{alert.eventType.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(alert.createdAt)}</p>{links.length > 0 && <nav className="alert-links" aria-label="Related records">{links.map((link) => <a className="button button-secondary" href={link.href} key={link.href}>{link.label}</a>)}</nav>}<ul className="alert-facts">{humanAlertFacts(alert).map((fact) => <li key={fact}>{fact}</li>)}</ul></article>)}</div><LiveFeed projectId={projectId} /></div></FeatureShell>;
}
