import { and, desc, eq } from "drizzle-orm";
import { ComplianceWorkbench } from "@/components/compliance-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { complianceChecks, documents, documentVersions, requirements, sourceRegions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function CompliancePage() {
  const projectId = await getActiveProjectId();
  const [data, checks, acceptedRows, regionRows] = await Promise.all([
    getDashboardData(projectId),
    db.select().from(complianceChecks).where(eq(complianceChecks.projectId, projectId)).orderBy(desc(complianceChecks.createdAt)),
    db.select({ id: requirements.id, statement: requirements.statement }).from(requirements).where(and(eq(requirements.projectId, projectId), eq(requirements.reviewState, "accepted"))),
    db.select({ id: sourceRegions.id, text: sourceRegions.extractedText }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Clause versus line" title="Compliance" description="Deterministic comparisons may propose a flag; qualitative or ungrounded comparisons require engineering judgment."><ComplianceWorkbench projectId={projectId} requirements={acceptedRows} regions={regionRows} /><div className="workflow-stack">{checks.length ? checks.map((check) => <article className="surface workflow-card" key={check.id}><span className="source-status pending">{check.verdict.replaceAll("_", " ")}</span><h2>{check.reason}</h2><p>Review state: {check.reviewState} · Confidence: {check.confidence}</p><small>Requirement {check.requirementId} · Target region {check.targetSourceRegionId}</small></article>) : <article className="surface workflow-card"><h2>No compliance checks yet</h2><p>Select an accepted requirement and controlled target line above.</p></article>}</div></FeatureShell>;
}
