import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clearAlerts } from "@/lib/alerts/write-alert";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { scheduleRisks } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ action: z.enum(["acknowledge", "dismiss"]), expectedVersion: z.number().int().positive(), note: z.string().trim().min(10).max(5000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ riskId: string }> }) {
  const { riskId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Risk review is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  const existing = await db.query.scheduleRisks.findFirst({ where: eq(scheduleRisks.id, riskId) }); if (!existing) return NextResponse.json({ error: "Schedule risk not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(existing.projectId, "schedule:manage"); const dismissed = parsed.data.action === "dismiss";
    const [risk] = await db.update(scheduleRisks).set({ status: dismissed ? "dismissed" : existing.status, reviewState: dismissed ? "rejected" : "accepted", reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, mitigationDisposition: dismissed ? "dismissed" : "acknowledged_only", clearedAt: dismissed ? new Date() : existing.clearedAt, version: sql`${scheduleRisks.version} + 1`, updatedAt: new Date() }).where(and(eq(scheduleRisks.id, riskId), eq(scheduleRisks.version, parsed.data.expectedVersion))).returning();
    if (!risk) return NextResponse.json({ error: "This risk changed after you opened it. Reload before reviewing." }, { status: 409 });
    if (dismissed) await clearAlerts(existing.projectId, `risk:${existing.id}`);
    await writeAuditEvent({ projectId: existing.projectId, actorId: actor.userId, action: `schedule.risk.${parsed.data.action}`, entityType: "schedule_risk", entityId: existing.id, before: existing, after: { risk, mitigationApplied: false, scheduleDatesChanged: false } });
    return NextResponse.json({ risk, authority: "Review records awareness or dismissal only. No mitigation or schedule date was applied." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review schedule risk." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
