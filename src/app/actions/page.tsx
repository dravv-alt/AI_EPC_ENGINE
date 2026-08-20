import { and, desc, eq, inArray } from "drizzle-orm";
import { ActionsWorkbench } from "@/components/actions-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { findings, gates, projectMembers, users } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ finding?: string }> }) {
  const projectId = await getActiveProjectId();
  const { finding } = await searchParams;
  const [data, findingRows, gateRows, memberRows] = await Promise.all([
    getDashboardData(projectId),
    db.select({
      id: findings.id,
      gateId: findings.gateId,
      title: findings.title,
      description: findings.description,
      severity: findings.severity,
      status: findings.status,
      ownerId: findings.ownerId,
      ownerName: users.displayName,
      dueAt: findings.dueAt,
      resolutionNote: findings.resolutionNote,
      resolvedAt: findings.resolvedAt,
      version: findings.version,
      updatedAt: findings.updatedAt
    }).from(findings).leftJoin(users, eq(findings.ownerId, users.id)).where(and(eq(findings.projectId, projectId), inArray(findings.status, ["open", "in_progress", "closed"]))).orderBy(desc(findings.createdAt)),
    db.select({ id: gates.id, name: gates.name }).from(gates).where(eq(gates.projectId, projectId)),
    db.select({ id: users.id, name: users.displayName }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Owned work" title="Issues & Actions" description="Create accountable blockers, assign due dates, resolve them with evidence-backed notes, and immediately recompute deterministic readiness.">
    <ActionsWorkbench projectId={projectId} findings={findingRows} gates={gateRows} members={memberRows} initialFindingId={finding} />
  </FeatureShell>;
}
