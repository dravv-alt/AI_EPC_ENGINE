import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const readiness = await persistProjectGateReadiness(projectId);
    return NextResponse.json({ readiness });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to recompute readiness" }, { status });
  }
}
