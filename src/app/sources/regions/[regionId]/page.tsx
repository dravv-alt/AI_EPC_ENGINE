import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { documents, documentVersions, sourceRegions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function SourceRegionPage({ params }: { params: Promise<{ regionId: string }> }) {
  const projectId = await getActiveProjectId();
  const { regionId } = await params;
  const [data, row] = await Promise.all([
    getProjectShellData(projectId),
    db.select({ region: sourceRegions, version: documentVersions, document: documents })
      .from(sourceRegions)
      .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
      .innerJoin(documents, eq(documentVersions.documentId, documents.id))
      .where(and(eq(sourceRegions.id, regionId), eq(documents.projectId, projectId)))
      .limit(1)
  ]);
  if (!data) throw new Error("Project not found");
  if (!row[0]) return <FeatureShell projectName={data.project} eyebrow="Controlled citation" title="Source region unavailable" description="The citation does not exist in the active project or your role cannot access it."><section className="surface empty-state"><h2>No source region</h2><p>Return to the review queue and select a project-scoped citation.</p><Link className="button button-secondary" href="/requirements">Back to requirements</Link></section></FeatureShell>;
  const { region, version, document } = row[0];
  const url = `/api/document-versions/${version.id}/content`;
  return <FeatureShell projectName={data.project} eyebrow="Controlled citation" title={document.title} description={`${version.revision} · page ${region.pageNumber} · immutable source ${version.sha256.slice(0, 16)}…`}>
    <div className="source-viewer-layout"><section className="surface source-excerpt"><p className="eyebrow">Exact extracted region</p><h2>Page {region.pageNumber}</h2><blockquote>{region.extractedText}</blockquote><dl><div><dt>Region hash</dt><dd>{region.contentHash}</dd></div><div><dt>Bounding box</dt><dd>{region.bbox ? JSON.stringify(region.bbox) : "Full-page text region"}</dd></div><div><dt>Version state</dt><dd>{version.status}</dd></div></dl><a className="button button-secondary" href={`${url}#page=${region.pageNumber}`} target="_blank" rel="noreferrer">Open source at page</a></section>{version.mediaType === "application/pdf" && <iframe className="surface source-frame" src={`${url}#page=${region.pageNumber}`} title={`${document.title}, page ${region.pageNumber}`} />}</div>
  </FeatureShell>;
}
