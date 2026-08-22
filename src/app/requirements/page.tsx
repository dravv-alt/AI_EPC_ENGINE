import { asc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { RequirementsWorkbench } from "@/components/requirements-workbench";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { documents, documentVersions, requirements, sourceRegions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const projectId = await getActiveProjectId();
  const [data, items] = await Promise.all([
    getDashboardData(projectId),
    db.select({ requirement: requirements, region: sourceRegions, version: documentVersions, document: documents })
      .from(requirements)
      .innerJoin(sourceRegions, eq(requirements.sourceRegionId, sourceRegions.id))
      .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
      .innerJoin(documents, eq(documentVersions.documentId, documents.id))
      .where(eq(requirements.projectId, projectId))
      .orderBy(asc(documents.title), asc(documentVersions.revision), asc(sourceRegions.pageNumber), asc(requirements.createdAt))
  ]);
  if (!data) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Engineering · human authority" title="Requirements" description="Review concise, cited proposals by source document. Expand only when you need the complete controlled corpus.">
    <RequirementsWorkbench rows={items.map(({ requirement, region, version, document }) => ({
      id: requirement.id, statement: requirement.statement, displayTitle: requirement.displayTitle, displaySummary: requirement.displaySummary, presentationProvider: requirement.presentationProvider,
      modality: requirement.modality, comparisonModality: requirement.comparisonModality, numericValue: requirement.numericValue, unit: requirement.unit, tolerance: requirement.tolerance, confidence: requirement.confidence,
      reviewState: requirement.reviewState, reviewNote: requirement.reviewNote, regionId: region.id, documentTitle: document.title, revision: version.revision, pageNumber: region.pageNumber, contentHash: region.contentHash
    }))} />
  </FeatureShell>;
}
