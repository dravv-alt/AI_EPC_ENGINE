import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { rackModelEquipment, rackModelRacks, rackModels } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { loadRackModel } from "@/lib/rack-model/load";

const equipmentSchema = z.object({
  rackId: z.string().uuid(),
  name: z.string().trim().min(2).max(220),
  equipmentType: z.enum(["nodes", "network", "storage", "power", "cooling", "other"]),
  modelReference: z.string().trim().max(180).optional(),
  vendor: z.string().trim().max(180).optional(),
  startUnit: z.number().int().min(1).max(60),
  unitHeight: z.number().int().min(1).max(60),
  powerKw: z.number().min(0).max(500).optional(),
});

async function assertEditable(projectId: string, modelId: string) {
  const bundle = await loadRackModel(projectId, modelId);
  if (!bundle) throw new AccessError("Rack model not found.", 404);
  if (!['generated', 'rejected'].includes(bundle.model.status)) throw new AccessError("Return this revision to a draft state before changing its rack population.", 409);
  if (bundle.model.sourceType === "imported") throw new AccessError("Imported visual models must be mapped before canonical rack equipment can be edited.", 409);
  return bundle;
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const parsed = equipmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Equipment details are invalid." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const bundle = await assertEditable(projectId, modelId);
    const rack = bundle.racks.find((item) => item.id === parsed.data.rackId);
    if (!rack) return NextResponse.json({ error: "Rack not found in this revision." }, { status: 404 });
    const endUnit = parsed.data.startUnit + parsed.data.unitHeight - 1;
    if (endUnit > rack.totalUnits) return NextResponse.json({ error: `Equipment extends beyond ${rack.totalUnits}U.` }, { status: 409 });
    const conflict = bundle.equipment.find((item) => item.rackId === rack.id && parsed.data.startUnit <= item.startUnit + item.unitHeight - 1 && endUnit >= item.startUnit);
    if (conflict) return NextResponse.json({ error: `U${parsed.data.startUnit}-U${endUnit} overlaps ${conflict.name}.` }, { status: 409 });
    const [equipment] = await db.insert(rackModelEquipment).values({
      rackModelId: modelId,
      rackId: rack.id,
      name: parsed.data.name,
      equipmentType: parsed.data.equipmentType,
      modelReference: parsed.data.modelReference || null,
      vendor: parsed.data.vendor || null,
      startUnit: parsed.data.startUnit,
      unitHeight: parsed.data.unitHeight,
      powerKw: parsed.data.powerKw === undefined ? null : String(parsed.data.powerKw),
      heatKw: parsed.data.powerKw === undefined ? null : String(parsed.data.powerKw),
      provenance: { kind: "manual_rack_authoring", actorId: actor.userId, approved: false },
      metadata: {},
    }).returning();
    const sourceHash = createHash("sha256").update(`${bundle.model.sourceHash}:add:${equipment.id}:${JSON.stringify(parsed.data)}`).digest("hex");
    await db.update(rackModels).set({ sourceHash, updatedAt: new Date() }).where(eq(rackModels.id, modelId));
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.equipment_added", entityType: "rack_model_equipment", entityId: equipment.id, after: parsed.data });
    return NextResponse.json(await loadRackModel(projectId, modelId), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add equipment." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Equipment id is required." }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const bundle = await assertEditable(projectId, modelId);
    const existing = bundle.equipment.find((item) => item.id === id);
    if (!existing) return NextResponse.json({ error: "Equipment not found." }, { status: 404 });
    await db.delete(rackModelEquipment).where(and(eq(rackModelEquipment.id, id), eq(rackModelEquipment.rackModelId, modelId)));
    const sourceHash = createHash("sha256").update(`${bundle.model.sourceHash}:delete:${id}`).digest("hex");
    await db.update(rackModels).set({ sourceHash, updatedAt: new Date() }).where(eq(rackModels.id, modelId));
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.equipment_removed", entityType: "rack_model_equipment", entityId: id, before: existing });
    return NextResponse.json(await loadRackModel(projectId, modelId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove equipment." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
