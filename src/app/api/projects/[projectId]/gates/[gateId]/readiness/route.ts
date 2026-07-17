import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { getGateReviewContext } from "@/lib/readiness/gate-context";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; gateId: string }> }) {
  const { projectId, gateId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const context = await getGateReviewContext(projectId, gateId);
    if (!context) return NextResponse.json({ error: "Gate not found." }, { status: 404 });
    return NextResponse.json(context);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate gate readiness." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
