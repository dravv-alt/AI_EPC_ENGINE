import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { rackModels } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { loadRackModel } from "@/lib/rack-model/load";

const statusSchema = z.object({ status: z.enum(["generated", "under_review", "approved", "superseded", "rejected"]) });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const bundle = await loadRackModel(projectId, modelId);
    if (!bundle) return NextResponse.json({ error: "Rack model not found." }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load rack model." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Rack model status is invalid." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, parsed.data.status === "approved" ? "gate:approve" : "configuration:manage");
    const current = await loadRackModel(projectId, modelId);
    if (!current) return NextResponse.json({ error: "Rack model not found." }, { status: 404 });
    const transitions: Record<string, string[]> = {
      generated: ["under_review", "rejected"],
      under_review: ["approved", "rejected"],
      approved: ["superseded"],
      rejected: ["under_review"],
      superseded: [],
    };
    if (!(transitions[current.model.status] ?? []).includes(parsed.data.status)) {
      return NextResponse.json({ error: `A ${current.model.status.replaceAll("_", " ")} model cannot move directly to ${parsed.data.status.replaceAll("_", " ")}.` }, { status: 409 });
    }
    const approved = parsed.data.status === "approved";
    const [model] = await db.update(rackModels).set({ status: parsed.data.status, approvedBy: approved ? actor.userId : null, approvedAt: approved ? new Date() : null, updatedAt: new Date() }).where(eq(rackModels.id, modelId)).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.status_changed", entityType: "rack_model", entityId: modelId, before: { status: current.model.status }, after: { status: model.status, approvedBy: model.approvedBy } });
    return NextResponse.json({ model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update rack model." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
