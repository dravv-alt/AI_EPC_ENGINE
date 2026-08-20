import { and, desc, eq } from "drizzle-orm";
import { ComplianceWorkbench } from "@/components/compliance-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { complianceChecks, compliancePrecedents, documents, documentVersions, requirements, sourceRegions, users } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const projectId = await getActiveProjectId();
  const [data, checkRows, acceptedRows, regionRows, precedentRows] = await Promise.all([
    getDashboardData(projectId),
    db.select({ check: complianceChecks, reviewerName: users.displayName }).from(complianceChecks).leftJoin(users, eq(complianceChecks.reviewedBy, users.id)).where(eq(complianceChecks.projectId, projectId)).orderBy(desc(complianceChecks.createdAt)),
    db.select({ id: requirements.id, statement: requirements.statement, sourceRegionId: requirements.sourceRegionId, numericValue: requirements.numericValue, unit: requirements.unit, tolerance: requirements.tolerance }).from(requirements).where(and(eq(requirements.projectId, projectId), eq(requirements.reviewState, "accepted"))),
    db.select({ id: sourceRegions.id, text: sourceRegions.extractedText, pageNumber: sourceRegions.pageNumber, contentHash: sourceRegions.contentHash, documentTitle: documents.title, documentType: documents.documentType, revision: documentVersions.revision }).from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
    db.select({ precedent: compliancePrecedents, reviewerName: users.displayName }).from(compliancePrecedents).leftJoin(users, eq(compliancePrecedents.reviewedBy, users.id)).where(eq(compliancePrecedents.projectId, projectId)).orderBy(desc(compliancePrecedents.createdAt))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Assurance · clause versus controlled line" title="Compliance" description="Structured deviations are deterministic proposals. Qualitative equivalence is valid only after an engineer approves a project-scoped, exactly cited precedent.">
    <ComplianceWorkbench projectId={projectId} requirements={acceptedRows} regions={regionRows} checks={checkRows.map((row) => ({ ...row.check, reviewerName: row.reviewerName }))} precedents={precedentRows.map((row) => ({ ...row.precedent, reviewerName: row.reviewerName }))} />
  </FeatureShell>;
}
