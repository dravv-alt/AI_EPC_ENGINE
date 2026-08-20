import Link from "next/link";
import { desc, eq } from "drizzle-orm";
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

  const versions = new Map<string, { id: string; title: string; revision: string; extractionStatus: string; regions: Array<{ id: string; page: string }> }>();
  for (const row of rows) {
    if (!versions.has(row.versionId)) versions.set(row.versionId, { id: row.versionId, title: row.title, revision: row.revision, extractionStatus: row.extractionStatus, regions: [] });
    if (row.regionId) versions.get(row.versionId)!.regions.push({ id: row.regionId, page: row.pageNumber ?? "—" });
  }

  return <FeatureShell projectName={data.project} projectId={projectId} eyebrow="Engineering · controlled inputs" title="Documents" description="Upload immutable document revisions and inspect every extracted citation region.">
    <article className="surface workflow-card">
      <div className="table-wrap"><table><thead><tr><th>Source</th><th>Revision</th><th>Status</th><th>Source regions</th></tr></thead><tbody>{[...versions.values()].map((source) => <tr key={source.id}><td>{source.regions[0] ? <Link className="source-table-link" href={`/sources/regions/${source.regions[0].id}`}><b>{source.title}</b><small>Open first extracted region</small></Link> : <b>{source.title}</b>}</td><td>{source.revision}</td><td><span className={`source-status ${source.extractionStatus === "completed" ? "processed" : "pending"}`}>{source.extractionStatus}</span></td><td><div className="source-region-links">{source.regions.map((region) => <Link key={region.id} href={`/sources/regions/${region.id}`}>Page {region.page}</Link>)}{!source.regions.length && <span>No extracted regions</span>}</div></td></tr>)}</tbody></table></div>
      <SourceUploadForm projectId={projectId} />
    </article>
  </FeatureShell>;
}
