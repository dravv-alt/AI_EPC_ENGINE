import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { FeatureShell } from "@/components/feature-shell";
import { IssueDetailWorkbench } from "@/components/issue-detail-workbench";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { auditEvents, findings, gates, projectMembers, users } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({ params }: { params: Promise<{ findingId: string }> }) {
  const projectId = await getActiveProjectId();
  const { findingId } = await params;
  const [data, issueRows, members, events] = await Promise.all([
    getProjectShellData(projectId),
    db.select({ id: findings.id, title: findings.title, description: findings.description, status: findings.status, severity: findings.severity, ownerId: findings.ownerId, ownerName: users.displayName, gateId: findings.gateId, gateName: gates.name, dueAt: findings.dueAt, resolutionNote: findings.resolutionNote, resolvedAt: findings.resolvedAt, version: findings.version, createdAt: findings.createdAt, updatedAt: findings.updatedAt })
      .from(findings).leftJoin(users, eq(findings.ownerId, users.id)).leftJoin(gates, eq(findings.gateId, gates.id)).where(and(eq(findings.id, findingId), eq(findings.projectId, projectId))).limit(1),
    db.select({ id: users.id, name: users.displayName }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId)),
    db.select({ id: auditEvents.id, action: auditEvents.action, actor: users.displayName, at: auditEvents.createdAt }).from(auditEvents).leftJoin(users, eq(auditEvents.actorId, users.id)).where(and(eq(auditEvents.projectId, projectId), eq(auditEvents.entityId, findingId))).orderBy(desc(auditEvents.createdAt)),
  ]);
  const row = issueRows[0];
  if (!data || !row) notFound();
  const issue = { ...row, dueAt: row.dueAt?.toISOString() ?? null, resolvedAt: row.resolvedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  const activity = events.map((event) => ({ id: event.id, action: event.action.replaceAll(".", " ").replaceAll("_", " "), actor: event.actor ?? "System", at: event.at.toISOString() }));
  return <FeatureShell projectName={data.project} eyebrow={`Issues / ${row.id.slice(0, 6).toUpperCase()}`} title={row.title} description={`${row.status.replaceAll("_", " ")} · ${row.severity} priority · accountable commissioning work`}>
    <IssueDetailWorkbench issue={issue} members={members} activity={activity} />
  </FeatureShell>;
}
