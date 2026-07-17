import { NextResponse } from "next/server";
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
    const body = await localStorage.read(objectKey);
    return new NextResponse(body, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store", "content-disposition": `inline; filename="${objectKey.split("/").at(-1)}"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read object." }, { status: 403 });
  }
}
