import { desc, eq } from "drizzle-orm";
import { DocumentLibrary } from "@/components/document-library";
import { FeatureShell } from "@/components/feature-shell";
import { SourceUploadForm } from "@/components/source-upload-form";
import { getActiveProjectId } from "@/lib/projects/current";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { documents, documentVersions, sourceRegions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const projectId = await getActiveProjectId();
  const [data, rows] = await Promise.all([
    getDashboardData(projectId),
    db.select({
      versionId: documentVersions.id,
      title: documents.title,
      revision: documentVersions.revision,
      mediaType: documentVersions.mediaType,
      status: documentVersions.status,
      extractionStatus: documentVersions.extractionStatus,
      regionId: sourceRegions.id,
      pageNumber: sourceRegions.pageNumber
    }).from(documentVersions)
      .innerJoin(documents, eq(documentVersions.documentId, documents.id))
      .leftJoin(sourceRegions, eq(sourceRegions.documentVersionId, documentVersions.id))
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documentVersions.createdAt))
  ]);
  if (!data) throw new Error("Project not found");

  const versions = new Map<string, { id: string; title: string; revision: string; mediaType: string; status: string; extractionStatus: string; regions: Array<{ id: string; page: string }> }>();
  for (const row of rows) {
    if (!versions.has(row.versionId)) versions.set(row.versionId, { id: row.versionId, title: row.title, revision: row.revision, mediaType: row.mediaType, status: row.status, extractionStatus: row.extractionStatus, regions: [] });
    if (row.regionId) versions.get(row.versionId)!.regions.push({ id: row.regionId, page: row.pageNumber ?? "—" });
  }

  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Engineering · controlled inputs" title="Documents" description="Upload immutable document revisions and inspect every extracted citation region.">
    <article className="surface document-library-surface">
      <DocumentLibrary items={[...versions.values()]} />
      <SourceUploadForm projectId={projectId} />
    </article>
  </FeatureShell>;
}
