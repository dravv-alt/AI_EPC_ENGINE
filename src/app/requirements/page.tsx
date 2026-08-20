import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { RequirementReviewActions } from "@/components/requirement-review-actions";
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
      .orderBy(desc(requirements.createdAt))
  ]);
  if (!data) throw new Error("Project not found");
  const accepted = items.filter(({ requirement }) => requirement.reviewState === "accepted").map(({ requirement }) => ({ id: requirement.id, statement: requirement.statement }));
  return <FeatureShell projectName={data.project} eyebrow="Engineering · human authority" title="Requirements" description="Review every cited proposal, normalize values and units, retain rejected/duplicate history, and allow only accepted records into readiness.">
    <div className="workflow-stack">{items.map(({ requirement, region, version, document }) => <article className="surface workflow-card" key={requirement.id}>
      <span className={`source-status ${requirement.reviewState === "accepted" ? "processed" : "pending"}`}>{requirement.reviewState}</span>
      <h2>{requirement.statement}</h2>
      <p>Modality: {requirement.modality} · Confidence: {requirement.confidence ?? "not scored"}{requirement.numericValue ? ` · ${requirement.numericValue} ${requirement.unit ?? "unit missing"}${requirement.tolerance ? ` ± ${requirement.tolerance}` : ""}` : ""}</p>
      <Link className="citation-link" href={`/sources/regions/${region.id}`}><span className="clause">Exact citation</span>{document.title} · {version.revision} · page {region.pageNumber} · SHA {region.contentHash.slice(0, 12)}…</Link>
      {requirement.reviewNote && <p className="review-note">Reviewer rationale: {requirement.reviewNote}</p>}
      {["proposed", "edited"].includes(requirement.reviewState) && <RequirementReviewActions requirement={requirement} acceptedTargets={accepted.filter((target) => target.id !== requirement.id)} />}
    </article>)}</div>
  </FeatureShell>;
}
