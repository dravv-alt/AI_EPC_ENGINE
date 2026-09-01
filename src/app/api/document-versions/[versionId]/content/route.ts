import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documents, documentVersions } from "@/lib/db/schema";
import { requireProjectPermission } from "@/lib/projects/access";
import { storedObjectResponse } from "@/lib/storage/http";

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const [record] = await db.select({
    objectKey: documentVersions.objectKey,
    mediaType: documentVersions.mediaType,
    title: documents.title,
    revision: documentVersions.revision,
    projectId: documents.projectId
  }).from(documentVersions)
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!record) return NextResponse.json({ error: "Document revision not found." }, { status: 404 });
  await requireProjectPermission(record.projectId, "audit:view");

  try {
    return await storedObjectResponse(request, {
      objectKey: record.objectKey,
      mediaType: record.mediaType,
      fileName: `${record.title} - ${record.revision}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Document content is unavailable." }, { status: 503 });
  }
}
