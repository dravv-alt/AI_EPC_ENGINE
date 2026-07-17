import { NextResponse } from "next/server";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { getDashboardData } from "@/lib/dashboard-data";

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const dashboard = await getDashboardData(projectId);
    if (!dashboard) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ data: dashboard, dataSource: "postgres" });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load project" }, { status });
  }
}
