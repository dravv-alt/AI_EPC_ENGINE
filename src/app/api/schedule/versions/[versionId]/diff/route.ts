import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { diffScheduleVersions } from "@/lib/schedule/read-model";

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params; const diff = await diffScheduleVersions(versionId, new URL(request.url).searchParams.get("against") ?? undefined); if (!diff) return NextResponse.json({ error: "Schedule version not found." }, { status: 404 });
  try { await requireProjectPermission(diff.current.projectId, "audit:view"); return NextResponse.json({ diff }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to compare schedule versions." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
