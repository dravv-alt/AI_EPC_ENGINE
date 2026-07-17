import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { getCurrentSchedule } from "@/lib/schedule/read-model";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try { await requireProjectPermission(projectId, "audit:view"); const schedule = await getCurrentSchedule(projectId); if (!schedule) return NextResponse.json({ error: "No schedule baseline exists." }, { status: 404 }); return NextResponse.json({ schedule }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load current schedule." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
