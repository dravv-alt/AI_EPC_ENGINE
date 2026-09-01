import { and, asc, eq } from "drizzle-orm";
import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, edges, evidence, requirements, systems, users } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const projectId = await getActiveProjectId();
  const [data, evidenceRows, systemRows, assetRows, requirementRows, userRows, edgeRows] = await Promise.all([
    getProjectShellData(projectId),
    db.select().from(evidence).where(eq(evidence.projectId, projectId)).orderBy(asc(evidence.capturedAt)),
    db.select().from(systems).where(eq(systems.projectId, projectId)).orderBy(asc(systems.name)),
    db.select().from(assets).where(eq(assets.projectId, projectId)).orderBy(asc(assets.tag)),
    db.select({ id: requirements.id, statement: requirements.statement }).from(requirements).where(and(eq(requirements.projectId, projectId), eq(requirements.reviewState, "accepted"))).orderBy(asc(requirements.createdAt)),
    db.select({ id: users.id, name: users.displayName }).from(users),
    db.select().from(edges).where(eq(edges.projectId, projectId))
  ]);
  if (!data) throw new Error("Project not found");
  const systemById = new Map(systemRows.map((row) => [row.id, row.name]));
  const assetById = new Map(assetRows.map((row) => [row.id, row.tag]));
  const userById = new Map(userRows.map((row) => [row.id, row.name]));
  const linkedByEvidence = new Map<string, string[]>();
  edgeRows.filter((edge) => edge.fromType === "evidence" && edge.relationshipType === "PROVES" && edge.toType === "requirement").forEach((edge) => linkedByEvidence.set(edge.fromId, [...(linkedByEvidence.get(edge.fromId) ?? []), edge.toId]));

  return <FeatureShell projectName={data.project} eyebrow="Engineering · controlled proof" title="Evidence" description="Every row below is loaded from the active project. Capture is pending until a reviewer explicitly links it to accepted requirements.">
    <EvidenceWorkbench
      projectId={projectId}
      systems={systemRows.map(({ id, name }) => ({ id, name }))}
      assets={assetRows.map(({ id, systemId, tag, assetType }) => ({ id, systemId, tag, assetType }))}
      requirements={requirementRows}
      records={evidenceRows.map((record) => ({ id: record.id, systemId: record.systemId, systemName: systemById.get(record.systemId) ?? "System record unavailable", assetId: record.assetId, assetTag: record.assetId ? assetById.get(record.assetId) ?? "Asset record unavailable" : null, evidenceType: record.evidenceType, validityState: record.validityState, contentHash: record.contentHash, capturedAt: record.capturedAt.toISOString(), capturedBy: record.capturedBy ? userById.get(record.capturedBy) ?? "Project user" : "System", linkedRequirementIds: linkedByEvidence.get(record.id) ?? [], aiDescription: record.aiDescription, classificationProvider: record.classificationProvider }))}
    />
  </FeatureShell>;
}
