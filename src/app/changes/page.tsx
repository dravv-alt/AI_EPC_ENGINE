import { desc, eq } from "drizzle-orm";
import { ChangeAssessmentList } from "@/components/change-assessment-list";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { documents, documentVersions } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function ChangesPage() {
  const projectId = await getActiveProjectId();
  const [data, rows] = await Promise.all([
    getDashboardData(projectId),
    db.select({ id: documentVersions.id, documentId: documents.id, title: documents.title, revision: documentVersions.revision, status: documentVersions.status, extractionStatus: documentVersions.extractionStatus, createdAt: documentVersions.createdAt }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)).orderBy(desc(documentVersions.createdAt))
  ]);
  if (!data) throw new Error("Project not found");
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.documentId, (counts.get(row.documentId) ?? 0) + 1));
  const seen = new Set<string>();
  const versions = rows.map((row) => {
    const latestForDocument = !seen.has(row.documentId);
    seen.add(row.documentId);
    return { ...row, latestForDocument, hasPrevious: (counts.get(row.documentId) ?? 0) > 1 };
  });
  return <FeatureShell projectName={data.project} eyebrow="Assurance · revision control" title="Change Control" description="Region-level diffs mark impacted proof stale, reopen approved gates for review, and preserve every prior decision."><ChangeAssessmentList versions={versions} /></FeatureShell>;
}
