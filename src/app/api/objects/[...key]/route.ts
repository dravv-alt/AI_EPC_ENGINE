import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { storageObjects } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { requireProjectPermission } from "@/lib/projects/access";
import { localStorage } from "@/lib/storage/service";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (env.OBJECT_STORAGE_DRIVER !== "local") return NextResponse.json({ error: "Local object serving is disabled." }, { status: 404 });
  const objectKey = (await params).key.join("/");
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const token = url.searchParams.get("token") ?? "";
  if (!Number.isInteger(expires) || !localStorage.verify(objectKey, expires, token)) return NextResponse.json({ error: "Object URL is invalid or expired." }, { status: 403 });
  const [, projectId] = objectKey.split("/");
  if (!projectId) return NextResponse.json({ error: "Object scope is invalid." }, { status: 403 });
  try {
    await requireProjectPermission(projectId, "audit:view");
    const object = await db.query.storageObjects.findFirst({ where: and(eq(storageObjects.objectKey, objectKey), eq(storageObjects.projectId, projectId)) });
    if (!object) return NextResponse.json({ error: "Object is not registered for this project." }, { status: 404 });
    const body = await localStorage.read(objectKey);
    const fileName = (objectKey.split("/").at(-1) ?? "artifact").replace(/["\\\r\n]/g, "_");
    return new NextResponse(body, { headers: { "content-type": object.mediaType, "x-content-type-options": "nosniff", "cache-control": "private, no-store", "content-disposition": `inline; filename="${fileName}"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read object." }, { status: 403 });
  }
}
