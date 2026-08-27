import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { writeAuditEventInTransaction } from "@/lib/audit/write-event";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; alertId: string }> }
) {
  const { projectId, alertId } = await params;

  try {
    // Requires write access to modify alerts
    const actor = await requireProjectPermission(projectId, "finding:manage");

    const body = await request.json().catch(() => ({}));
    if (body.status !== "cleared") {
      return NextResponse.json({ error: "Only status='cleared' is supported currently" }, { status: 400 });
    }

    const existing = await db.query.alerts.findFirst({
      where: and(eq(alerts.id, alertId), eq(alerts.projectId, projectId))
    });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    if (existing.status === "cleared") {
      return NextResponse.json(existing);
    }

    // Clearing an alert is an operator decision that permanently changes the
    // Alert Center. It commits with its audit event so the chain records who
    // cleared it and when, the same as every other authority-bearing action.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(alerts)
        .set({ status: "cleared", updatedAt: new Date() })
        .where(and(eq(alerts.id, alertId), eq(alerts.projectId, projectId)))
        .returning();
      await writeAuditEventInTransaction(tx, {
        projectId,
        actorId: actor.userId,
        action: "alert.cleared",
        entityType: "alert",
        entityId: alertId,
        before: { status: existing.status },
        after: { status: "cleared", eventType: existing.eventType, title: existing.title }
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to patch alert:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update alert" },
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}
