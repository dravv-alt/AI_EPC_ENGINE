import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documents, documentVersions, sourceRegions } from "@/lib/db/schema";
import { scoreCitationText } from "@/lib/knowledge/query";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const { query, documentType } = await request.json().catch(() => ({}));
  if (typeof query !== "string" || query.trim().length < 3) return NextResponse.json({ error: "A query of at least three characters is required." }, { status: 400 });
  try { await requireProjectPermission(projectId, "audit:view"); const rows = await db.select().from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)); const claims = rows.filter((row) => !documentType || row.documents.documentType === documentType).map((row) => ({ text: row.source_regions.extractedText, sourceRegionId: row.source_regions.id, documentVersionId: row.document_versions.id, contentHash: row.source_regions.contentHash, score: scoreCitationText(query, row.source_regions.extractedText) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8); return NextResponse.json({ answer: claims.length ? claims.map((claim) => claim.text).join("\n\n") : null, claims, noResults: claims.length === 0, scopedTo: { projectId, documentType: documentType ?? "all" } }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to query controlled knowledge" }, { status: error instanceof AccessError ? error.status : 500 }); }
}
