import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { scheduleResources } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({ action: z.enum(["accept", "edit", "reject"]), name: z.string().trim().min(2).max(200).optional(), capacity: z.number().int().positive().max(100000).optional(), unit: z.string().trim().min(1).max(60).optional(), resolveValidationIssues: z.boolean().default(false), note: z.string().trim().min(3).max(2000) });
export async function POST(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Resource review is invalid." }, { status: 400 });
  const resource = await db.query.scheduleResources.findFirst({ where: eq(scheduleResources.id, resourceId) }); if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(resource.projectId, "schedule:manage"); if (!["proposed", "edited"].includes(resource.reviewState)) return NextResponse.json({ error: "Only proposed or edited resources can be reviewed." }, { status: 409 });
    const issues = resource.validationIssues as string[]; if (parsed.data.action === "accept" && issues.length) return NextResponse.json({ error: "Resolve every flagged field through an explicit edit before accepting.", validationIssues: issues }, { status: 409 });
    const reviewState = parsed.data.action === "accept" ? "accepted" : parsed.data.action === "reject" ? "rejected" : "edited";
    const [updated] = await db.update(scheduleResources).set({ name: parsed.data.name ?? resource.name, capacity: parsed.data.capacity ?? resource.capacity, unit: parsed.data.unit ?? resource.unit, validationIssues: parsed.data.action === "edit" && parsed.data.resolveValidationIssues ? [] : issues, reviewState, reviewedBy: actor.userId, reviewedAt: new Date(), reviewNote: parsed.data.note, updatedAt: new Date() }).where(eq(scheduleResources.id, resource.id)).returning();
    await writeAuditEvent({ projectId: resource.projectId, actorId: actor.userId, action: `schedule.resource_${reviewState}`, entityType: "schedule_resource", entityId: resource.id, before: resource, after: updated }); return NextResponse.json({ resource: updated });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review resource." }, { status: error instanceof AccessError ? error.status : 500 }); }
}
