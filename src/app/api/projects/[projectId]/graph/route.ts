import { NextResponse } from "next/server";
import { getProjectGraph } from "@/lib/graph/entities";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    return NextResponse.json(await getProjectGraph(projectId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load project graph." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
