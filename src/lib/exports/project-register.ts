import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  alerts,
  assets,
  auditEvents,
  complianceChecks,
  compliancePrecedents,
  decisions,
  documentVersions,
  documents,
  edges,
  evidence,
  evidenceClaimLinks,
  evidenceClaims,
  findings,
  gates,
  knowledgeChunks,
  projectMembers,
  projects,
  requirements,
  riskSignals,
  scheduleAssignments,
  scheduleDependencies,
  scheduleEvents,
  scheduleResources,
  scheduleRisks,
  scheduleTasks,
  scheduleVersions,
  shipments,
  siteAnalyses,
  siteAnalysisSnapshots,
  sourceRegions,
  systems,
  teachbackNotes,
  technologyPluginDrafts,
  turnoverPacks,
  cxChecklists,
  cxChecklistSteps,
  cxClauseCitations,
  cxStepResults,
  cxTestRecords,
} from "@/lib/db/schema";

export type ExportSection = {
  name: string;
  rows: Array<Record<string, unknown>>;
};
export type ProjectRegister = {
  project: Record<string, unknown>;
  generatedAt: string;
  sections: ExportSection[];
};

const rowsFor = async <T>(
  ids: string[],
  table: any,
  column: any,
): Promise<T[]> =>
  ids.length
    ? (db.select().from(table).where(inArray(column, ids)) as Promise<T[]>)
    : [];

export async function getProjectRegister(
  projectId: string,
): Promise<ProjectRegister> {
  const [project, direct] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
    Promise.all([
      db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, projectId)),
      db.select().from(documents).where(eq(documents.projectId, projectId)),
      db.select().from(systems).where(eq(systems.projectId, projectId)),
      db.select().from(assets).where(eq(assets.projectId, projectId)),
      db.select().from(gates).where(eq(gates.projectId, projectId)),
      db
        .select()
        .from(requirements)
        .where(eq(requirements.projectId, projectId)),
      db.select().from(evidence).where(eq(evidence.projectId, projectId)),
      db
        .select()
        .from(evidenceClaims)
        .where(eq(evidenceClaims.projectId, projectId)),
      db.select().from(findings).where(eq(findings.projectId, projectId)),
      db.select().from(decisions).where(eq(decisions.projectId, projectId)),
      db.select().from(edges).where(eq(edges.projectId, projectId)),
      db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.projectId, projectId))
        .orderBy(desc(auditEvents.createdAt)),
      db
        .select()
        .from(cxChecklists)
        .where(eq(cxChecklists.projectId, projectId)),
      db
        .select()
        .from(cxTestRecords)
        .where(eq(cxTestRecords.projectId, projectId)),
      db
        .select()
        .from(compliancePrecedents)
        .where(eq(compliancePrecedents.projectId, projectId)),
      db
        .select()
        .from(complianceChecks)
        .where(eq(complianceChecks.projectId, projectId)),
      db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.projectId, projectId)),
      db.select().from(shipments).where(eq(shipments.projectId, projectId)),
      db.select().from(alerts).where(eq(alerts.projectId, projectId)),
      db
        .select()
        .from(scheduleEvents)
        .where(eq(scheduleEvents.projectId, projectId)),
      db
        .select()
        .from(turnoverPacks)
        .where(eq(turnoverPacks.projectId, projectId)),
      db
        .select()
        .from(scheduleTasks)
        .where(eq(scheduleTasks.projectId, projectId)),
      db
        .select()
        .from(scheduleResources)
        .where(eq(scheduleResources.projectId, projectId)),
      db
        .select()
        .from(scheduleDependencies)
        .where(eq(scheduleDependencies.projectId, projectId)),
      db
        .select()
        .from(scheduleVersions)
        .where(eq(scheduleVersions.projectId, projectId)),
      db.select().from(riskSignals).where(eq(riskSignals.projectId, projectId)),
      db
        .select()
        .from(scheduleRisks)
        .where(eq(scheduleRisks.projectId, projectId)),
      db
        .select()
        .from(teachbackNotes)
        .where(eq(teachbackNotes.projectId, projectId)),
      db
        .select()
        .from(technologyPluginDrafts)
        .where(eq(technologyPluginDrafts.projectId, projectId)),
      db.query.siteAnalyses.findFirst({
        where: eq(siteAnalyses.projectId, projectId),
      }),
      db
        .select()
        .from(siteAnalysisSnapshots)
        .where(eq(siteAnalysisSnapshots.projectId, projectId))
        .orderBy(desc(siteAnalysisSnapshots.version)),
    ]),
  ]);
  if (!project) throw new Error("Project not found.");
  const [
    members,
    projectDocuments,
    projectSystems,
    projectAssets,
    projectGates,
    projectRequirements,
    projectEvidence,
    projectClaims,
    projectFindings,
    projectDecisions,
    projectEdges,
    projectAudit,
    checklists,
    testRecords,
    precedents,
    checks,
    chunks,
    projectShipments,
    projectAlerts,
    events,
    packs,
    tasks,
    resources,
    dependencies,
    versions,
    signals,
    risks,
    teachback,
    drafts,
    siteAnalysis,
    siteAnalysisSnapshotsRows,
  ] = direct;
  const [
    versionsForDocuments,
    regions,
    claimLinks,
    checklistSteps,
    clauseCitations,
    stepResults,
    assignments,
  ] = await Promise.all([
    rowsFor(
      projectDocuments.map((item) => item.id),
      documentVersions,
      documentVersions.documentId,
    ),
    rowsFor(
      projectDocuments.map((item) => item.id),
      sourceRegions,
      sourceRegions.documentVersionId,
    ),
    rowsFor(
      projectClaims.map((item) => item.id),
      evidenceClaimLinks,
      evidenceClaimLinks.claimId,
    ),
    rowsFor(
      checklists.map((item) => item.id),
      cxChecklistSteps,
      cxChecklistSteps.checklistId,
    ),
    rowsFor(
      checklists.map((item) => item.id),
      cxClauseCitations,
      cxClauseCitations.checklistId,
    ),
    rowsFor(
      testRecords.map((item) => item.id),
      cxStepResults,
      cxStepResults.testRecordId,
    ),
    rowsFor(
      versions.map((item) => item.id),
      scheduleAssignments,
      scheduleAssignments.versionId,
    ),
  ]);
  // Source regions are children of document versions, not documents. Keep the
  // first parallel probe inexpensive, then fetch the authoritative version set.
  const projectRegionRows = await rowsFor(
    (versionsForDocuments as Array<{ id: string }>).map((item) => item.id),
    sourceRegions,
    sourceRegions.documentVersionId,
  );
  return {
    project: project as unknown as Record<string, unknown>,
    generatedAt: new Date().toISOString(),
    sections: [
      ["Project members", members],
      ["Documents", projectDocuments],
      ["Document versions", versionsForDocuments],
      ["Source regions", projectRegionRows],
      ["Systems", projectSystems],
      ["Assets", projectAssets],
      ["Gates", projectGates],
      ["Requirements", projectRequirements],
      ["Evidence", projectEvidence],
      ["Evidence claims", projectClaims],
      ["Claim to evidence links", claimLinks],
      ["Findings", projectFindings],
      ["Gate decisions", projectDecisions],
      ["Traceability edges", projectEdges],
      ["Site analysis", siteAnalysis ? [siteAnalysis] : []],
      ["Site analysis insight snapshots", siteAnalysisSnapshotsRows],
      ["Commissioning checklists", checklists],
      ["Commissioning steps", checklistSteps],
      ["Commissioning citations", clauseCitations],
      ["Commissioning test records", testRecords],
      ["Commissioning step results", stepResults],
      ["Compliance precedents", precedents],
      ["Compliance checks", checks],
      ["Knowledge chunks", chunks],
      ["Shipments", projectShipments],
      ["Alerts", projectAlerts],
      ["Schedule events", events],
      ["Schedule tasks", tasks],
      ["Schedule resources", resources],
      ["Schedule dependencies", dependencies],
      ["Schedule versions", versions],
      ["Schedule assignments", assignments],
      ["Risk signals", signals],
      ["Schedule risks", risks],
      ["Technology drafts", drafts],
      ["Turnover packs", packs],
      ["Teachback notes", teachback],
      ["Audit trail", projectAudit],
    ].map(([name, rows]) => ({
      name: name as string,
      rows: rows as Array<Record<string, unknown>>,
    })),
  };
}

export function plainValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
