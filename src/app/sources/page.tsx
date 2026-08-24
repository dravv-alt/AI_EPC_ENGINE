import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { SourcesWorkbench } from "@/components/sources-workbench";
import { getActiveProjectId } from "@/lib/projects/current";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { documents, documentVersions, sourceRegions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const projectId = await getActiveProjectId();
  const [data, rows] = await Promise.all([
    getDashboardData(projectId),
    db.select({ versionId: documentVersions.id, title: documents.title, documentType: documents.documentType, revision: documentVersions.revision, extractionStatus: documentVersions.extractionStatus, regionId: sourceRegions.id, pageNumber: sourceRegions.pageNumber }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).leftJoin(sourceRegions, eq(sourceRegions.documentVersionId, documentVersions.id)).where(eq(documents.projectId, projectId)).orderBy(desc(documentVersions.createdAt))
  ]);
  if (!data) throw new Error("Project not found");

  const versions = new Map<string, { id: string; title: string; documentType: string; revision: string; extractionStatus: string; regionCount: number; regions: Array<{ id: string; page: string }> }>();
  for (const row of rows) {
    if (!versions.has(row.versionId)) versions.set(row.versionId, { id: row.versionId, title: row.title, documentType: row.documentType, revision: row.revision, extractionStatus: row.extractionStatus, regionCount: 0, regions: [] });
    if (row.regionId) { const version = versions.get(row.versionId)!; version.regionCount += 1; if (version.regions.length < 12) version.regions.push({ id: row.regionId, page: row.pageNumber ?? "-" }); }
  }

  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Engineering / controlled inputs" title="Documents" description="Upload immutable revisions, filter the controlled library, and inspect exact citation regions."><SourcesWorkbench projectId={projectId} sources={[...versions.values()]} /></FeatureShell>;
}
