import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxClauseCitations, cxStepResults, cxTestRecords, documentVersions, documents, sourceRegions } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const { checklistId } = await params;
  const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) });
  if (!checklist) return NextResponse.json({ error: "Checklist not found." }, { status: 404 });
  try {
    await requireProjectPermission(checklist.projectId, "audit:view");
    const [steps, citationRows, records] = await Promise.all([
      db.select().from(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklistId)),
      db.select({ citation: cxClauseCitations, region: sourceRegions, revision: documentVersions.revision, documentTitle: documents.title, documentVersionId: documentVersions.id }).from(cxClauseCitations).leftJoin(sourceRegions, eq(cxClauseCitations.sourceRegionId, sourceRegions.id)).leftJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).leftJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(cxClauseCitations.checklistId, checklistId)),
      db.select().from(cxTestRecords).where(eq(cxTestRecords.checklistId, checklistId))
    ]);
    const results = records.length ? await db.select().from(cxStepResults).where(inArray(cxStepResults.testRecordId, records.map((record) => record.id))) : [];
    return NextResponse.json({ checklist, steps, citations: citationRows.map((row) => ({ ...row.citation, source: row.region ? { regionId: row.region.id, pageNumber: row.region.pageNumber, contentHash: row.region.contentHash, excerpt: row.region.extractedText, documentVersionId: row.documentVersionId, revision: row.revision, documentTitle: row.documentTitle } : null })), records, results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load checklist." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
