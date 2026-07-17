import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { getScheduleVersion } from "@/lib/schedule/read-model";

export async function GET(_: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params; const version = await getScheduleVersion(versionId); if (!version) return NextResponse.json({ error: "Schedule version not found." }, { status: 404 });
  try { await requireProjectPermission(version.projectId, "audit:view"); return NextResponse.json({ version }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load schedule version." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
