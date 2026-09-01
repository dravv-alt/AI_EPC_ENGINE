import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { storedObjectResponse } from "@/lib/storage/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; objectId: string }> },
) {
  const { projectId, objectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const object = await db.query.storageObjects.findFirst({
      where: and(
        eq(storageObjects.id, objectId),
        eq(storageObjects.projectId, projectId),
      ),
    });
    if (!object) return NextResponse.json({ error: "Object not found." }, { status: 404 });
    const extension = object.objectKey.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "");
    const fileName = object.mediaType === "application/pdf"
      ? "controlled-project-artifact.pdf"
      : `controlled-project-artifact${extension ? `.${extension}` : ""}`;
    return await storedObjectResponse(request, {
      objectKey: object.objectKey,
      mediaType: object.mediaType,
      fileName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Artifact content is unavailable." },
      { status: error instanceof AccessError ? error.status : 503 },
    );
  }
}
