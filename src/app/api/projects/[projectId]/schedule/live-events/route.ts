import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { riskSignals, scheduleTasks } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const url = new URL(request.url); const signalType = url.searchParams.get("signalType"); const taskId = url.searchParams.get("taskId");
    const conditions = [eq(riskSignals.projectId, projectId)]; if (signalType) conditions.push(eq(riskSignals.signalType, signalType)); if (taskId) conditions.push(eq(riskSignals.taskId, taskId));
    const items = await db.select({ signal: riskSignals, taskName: scheduleTasks.name }).from(riskSignals).innerJoin(scheduleTasks, eq(riskSignals.taskId, scheduleTasks.id)).where(and(...conditions)).orderBy(desc(riskSignals.observedAt)).limit(500);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load live risk signals." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
