import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { edges, requirements, evidence, scheduleTasks, sourceRegions, documentVersions, documents, cxTestRecords } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> }
) {
  const { projectId, nodeId } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  
  try {
    await requireProjectPermission(projectId, "audit:view");
    
    // Find all edges connected to this node
    const connectedEdges = await db
      .select()
      .from(edges)
      .where(
        or(
          eq(edges.fromId, nodeId),
          eq(edges.toId, nodeId)
        )
      );
      
    let relatedDocument = null;
    let sourceRegionId = null;

    if (type === "requirement") {
      const req = await db.select({ sourceRegionId: requirements.sourceRegionId }).from(requirements).where(eq(requirements.id, nodeId)).limit(1);
      sourceRegionId = req[0]?.sourceRegionId;
    } else if (type === "evidence") {
      const ev = await db.select({ sourceRegionId: evidence.sourceRegionId }).from(evidence).where(eq(evidence.id, nodeId)).limit(1);
      sourceRegionId = ev[0]?.sourceRegionId;
    } else if (type === "schedule_task") {
      const task = await db.select({ sourceRegionId: scheduleTasks.sourceRegionId }).from(scheduleTasks).where(eq(scheduleTasks.id, nodeId)).limit(1);
      sourceRegionId = task[0]?.sourceRegionId;
    }

    if (sourceRegionId) {
      const regionData = await db
        .select({
          pageNumber: sourceRegions.pageNumber,
          extractedText: sourceRegions.extractedText,
          revision: documentVersions.revision,
          documentId: documents.id,
          title: documents.title,
          documentType: documents.documentType
        })
        .from(sourceRegions)
        .leftJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
        .leftJoin(documents, eq(documentVersions.documentId, documents.id))
        .where(eq(sourceRegions.id, sourceRegionId))
        .limit(1);

      if (regionData.length > 0 && regionData[0].documentId) {
        relatedDocument = {
          documentId: regionData[0].documentId,
          title: regionData[0].title,
          documentType: regionData[0].documentType,
          revision: regionData[0].revision,
          pageNumber: regionData[0].pageNumber,
          extractedText: regionData[0].extractedText
        };
      }
    }

    return NextResponse.json({
      nodeId,
      edges: connectedEdges,
      details: {
        expandedAt: new Date().toISOString(),
        metadata: "Node expanded successfully via API",
        relatedDocument
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to expand node" },
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}
