import { NextResponse } from "next/server";
import { expandGraphNode } from "@/lib/graph/entities";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; nodeId: string }> }) {
  const { projectId, nodeId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const expansion = await expandGraphNode(projectId, nodeId);
    if (!expansion) return NextResponse.json({ error: "That node is not part of this project graph." }, { status: 404 });
    return NextResponse.json(expansion);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to expand graph node." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
