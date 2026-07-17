import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { objectStorage } from "@/lib/storage/service";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; objectId: string }> }) {
  const { projectId, objectId } = await params;
  try { await requireProjectPermission(projectId, "audit:view"); const object = await db.query.storageObjects.findFirst({ where: and(eq(storageObjects.id, objectId), eq(storageObjects.projectId, projectId)) }); if (!object) return NextResponse.json({ error: "Object not found." }, { status: 404 }); return NextResponse.json({ url: await objectStorage.signedReadUrl(object.objectKey, 300), expiresInSeconds: 300, mediaType: object.mediaType, sha256: object.sha256 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign object URL." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
