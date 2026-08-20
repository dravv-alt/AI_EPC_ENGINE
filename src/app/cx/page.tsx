import { and, desc, eq, inArray } from "drizzle-orm";
import { CxWorkbench } from "@/components/cx-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, cxChecklistSteps, cxChecklists, cxClauseCitations, cxStepResults, cxTestRecords, documentVersions, documents, gates, sourceRegions, systems } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function CxPage() {
  const projectId = await getActiveProjectId();
  const [data, checklists, systemRows, gateRows, assetRows, standardRows] = await Promise.all([
    getDashboardData(projectId),
    db.select().from(cxChecklists).where(eq(cxChecklists.projectId, projectId)).orderBy(desc(cxChecklists.createdAt)),
    db.select().from(systems).where(eq(systems.projectId, projectId)),
    db.select().from(gates).where(eq(gates.projectId, projectId)),
    db.select().from(assets).where(eq(assets.projectId, projectId)),
    db.select({ document: documents, version: documentVersions }).from(documents).innerJoin(documentVersions, eq(documentVersions.documentId, documents.id)).where(and(eq(documents.projectId, projectId), inArray(documents.documentType, ["standard", "procedure"]))).orderBy(desc(documentVersions.createdAt))
  ]);
  if (!data) throw new Error("Project not found");
  const checklistIds = checklists.map((item) => item.id);
  const versionIds = standardRows.map((row) => row.version.id);
  const [steps, citations, records, standardRegions] = await Promise.all([
    checklistIds.length ? db.select().from(cxChecklistSteps).where(inArray(cxChecklistSteps.checklistId, checklistIds)) : [],
    checklistIds.length ? db.select().from(cxClauseCitations).where(inArray(cxClauseCitations.checklistId, checklistIds)) : [],
    checklistIds.length ? db.select().from(cxTestRecords).where(eq(cxTestRecords.projectId, projectId)) : [],
    versionIds.length ? db.select({ id: sourceRegions.id, documentVersionId: sourceRegions.documentVersionId }).from(sourceRegions).where(inArray(sourceRegions.documentVersionId, versionIds)) : []
  ]);
  const results = records.length ? await db.select().from(cxStepResults).where(inArray(cxStepResults.testRecordId, records.map((record) => record.id))) : [];
  return <FeatureShell projectName={data.project} eyebrow="Delivery · commissioning QA" title="Commissioning Tests" description="Ingest controlled standards, generate citation-verified advisory checklists, execute deterministic proposed checks, and approve an editable report into immutable evidence.">
    <CxWorkbench
      projectId={projectId}
      systems={systemRows.map((row) => ({ id: row.id, name: row.name }))}
      gates={gateRows.map((row) => ({ id: row.id, systemId: row.systemId, name: row.name }))}
      assets={assetRows.map((row) => ({ id: row.id, systemId: row.systemId, tag: row.tag, assetType: row.assetType }))}
      standards={standardRows.map((row) => ({ id: row.version.id, title: row.document.title, standardSet: row.document.standardSet ?? "Unclassified set", documentType: row.document.documentType, revision: row.version.revision, extractionStatus: row.version.extractionStatus, extractionError: row.version.extractionError, regionCount: standardRegions.filter((region) => region.documentVersionId === row.version.id).length }))}
      checklists={checklists}
      steps={steps}
      citations={citations}
      records={records}
      results={results}
    />
  </FeatureShell>;
}
