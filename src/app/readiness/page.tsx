import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { EvidenceEntropyPanel } from "@/components/evidence-entropy-panel";
import { GateDecisionForm } from "@/components/gate-decision-form";
import { can } from "@/lib/auth/roles";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { gates } from "@/lib/db/schema";
import { requireProjectPermission } from "@/lib/projects/access";
import { getActiveProjectId } from "@/lib/projects/current";
import { getGateReviewContext } from "@/lib/readiness/gate-context";

export const dynamic = "force-dynamic";

const labels = { accepted: "Accepted proof", missing: "Missing proof", stale: "Stale proof", failed: "Failed proof", unapproved: "Pending review" } as const;

export default async function ReadinessPage() {
  const projectId = await getActiveProjectId();
  const actor = await requireProjectPermission(projectId, "audit:view");
  const [data, gateRows] = await Promise.all([getDashboardData(projectId), db.select().from(gates).where(eq(gates.projectId, projectId)).orderBy(asc(gates.sequenceNumber))]);
  if (!data) throw new Error("Project not found");
  const contexts = (await Promise.all(gateRows.map((gate) => getGateReviewContext(projectId, gate.id)))).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return <FeatureShell projectName={data.project} eyebrow="Deterministic rules" title="Readiness & decisions" description="Inspect every proof category, prerequisite and blocker behind a gate state. Schedule status is cross-linked but never changes readiness.">
    <div className="workflow-stack">
      <EvidenceEntropyPanel projectId={projectId} />
      {contexts.map((context) => {
      const readiness = context.readiness;
      const tone = readiness?.state === "in_review" ? "review" : readiness?.state ?? "unknown";
      return <article className="surface readiness-detail-card" key={context.gate.id}>
        <header><div><span className={`status-pill ${tone}`}>{context.gate.status === "approved" ? "approved" : readiness?.state.replaceAll("_", " ") ?? "unknown"}</span><h2>{context.gate.name}</h2><p>{context.systemName} · Gate {context.gate.sequenceNumber}</p></div><div className="rule-stamp"><span>Rule</span><b>{readiness?.ruleVersion}</b><small>{readiness?.evaluatedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(readiness.evaluatedAt) : "Not evaluated"}</small></div></header>
        {!readiness || readiness.acceptedRequirements === 0 ? <section className="readiness-guidance"><h3>UNKNOWN — configuration incomplete</h3><p>Map at least one accepted, cited requirement to this gate. No evidence or empty state is treated as success.</p><Link className="button button-secondary" href="/graph">Map requirements</Link></section> : <div className="proof-grid">{(["accepted", "missing", "unapproved", "stale", "failed"] as const).map((state) => <section className={`proof-column proof-${state}`} key={state}><h3>{labels[state]} <span>{readiness.proofDetails.filter((item) => item.state === state).length}</span></h3>{readiness.proofDetails.filter((item) => item.state === state).map((item) => <article key={item.requirementId}><b>{item.statement}</b><small>{item.evidenceIds.length ? `${item.evidenceIds.length} linked evidence record(s)` : "No linked evidence"}</small></article>)}</section>)}</div>}
        <div className="readiness-secondary-grid"><section><h3>Blocking findings ({readiness?.blockingFindingDetails.length ?? 0})</h3>{readiness?.blockingFindingDetails.map((finding) => <Link className="entity-row" href="/actions" key={finding.id}><div>{finding.isOverdue && <span className="status-pill blocked">overdue</span>}<b>{finding.title}</b><span>{finding.severity} · {finding.dueAt ? `due ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(finding.dueAt)}` : "unscheduled"} · {finding.reasons.includes("severity") && finding.reasons.includes("overdue") ? "severity + overdue" : finding.reasons.includes("overdue") ? "overdue, any severity" : "severity"}</span></div></Link>)}{!readiness?.blockingFindingDetails.length && <p className="workflow-hint">No open high/critical or overdue finding blocks this gate.</p>}</section><section><h3>Prerequisites ({readiness?.unmetPrerequisites ?? 0})</h3>{readiness?.prerequisiteDetails.map((gate) => <div className="entity-row" key={gate.id}><div><b>{gate.name}</b><span>{gate.status.replaceAll("_", " ")}</span></div></div>)}{!readiness?.unmetPrerequisites && <p className="workflow-hint">All preceding gates are approved or this is the first gate.</p>}</section><section><h3>Schedule status — informational only</h3>{context.schedule.tasks.map((task) => <Link className="entity-row" href={`/schedule?task=${task.id}`} key={task.id}><div><b>{task.name}</b><span>{task.assignment ? `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(task.assignment.startAt)} → ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(task.assignment.endAt)}` : "Not assigned in current version"}</span></div><small>{task.assignment?.isCritical ? "Critical path" : "Linked task"}</small></Link>)}{!context.schedule.tasks.length && <p className="workflow-hint">No schedule tasks are linked to this gate.</p>}</section></div>
        <div className="decision-layout"><section><h3>Decision history</h3>{context.decisions.map((decision) => <article className="decision-history" key={decision.id}><span className="source-status processed">{decision.decision}</span><b>{decision.actorName}</b><p>{decision.reason}</p><small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(decision.decidedAt)} · Baseline {decision.evidenceBaselineHash.slice(0, 12)}…</small></article>)}{!context.decisions.length && <p className="workflow-hint">No controlled decision has been recorded.</p>}</section><section>{can(actor.role, "gate:approve") ? context.gate.status === "approved" ? <div className="access-state"><h3>Immutable approval recorded</h3><p>A revision or invalid proof will reopen this gate without deleting its history.</p></div> : <><h3>Record authorized decision</h3><GateDecisionForm gateId={context.gate.id} readinessState={readiness?.state ?? "unknown"} affectingTasks={context.affectingTasks} /></> : <div className="access-state"><h3>Approver authority required</h3><p>Your role can inspect the baseline but cannot sign a gate decision.</p></div>}</section></div>
      </article>;
    })}{!contexts.length && <section className="surface empty-state"><h2>No gates configured</h2><p>Create a system and gate before readiness can be evaluated.</p><Link className="button button-primary" href="/systems">Configure gates</Link></section>}</div>
  </FeatureShell>;
}
