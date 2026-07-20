import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const { projectId, alertId } = await params;

  try {
    // Requires write access to modify alerts
    await requireProjectPermission(projectId, "finding:manage");

    const body = await request.json().catch(() => ({}));
    if (body.status !== "cleared") {
      return NextResponse.json({ error: "Only status='cleared' is supported currently" }, { status: 400 });
    }

    const [updated] = await db
      .update(alerts)
      .set({
        status: "cleared"
      })
      .where(
        and(
          eq(alerts.id, alertId),
          eq(alerts.projectId, projectId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to patch alert:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update alert" },
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}
