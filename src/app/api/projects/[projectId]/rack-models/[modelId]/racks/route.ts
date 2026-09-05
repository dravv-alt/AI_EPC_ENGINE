import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { rackModelRacks, rackModels } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { loadRackModel } from "@/lib/rack-model/load";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  rowLabel: z.string().trim().min(1).max(40),
  totalUnits: z.number().int().min(12).max(60).default(48),
  maxPowerKw: z.number().positive().max(500).optional(),
  widthMm: z.number().int().min(300).max(2000).default(600),
  depthMm: z.number().int().min(500).max(3000).default(1200),
  heightMm: z.number().int().min(900).max(3500).default(2200),
  positionIndex: z.number().int().min(0).max(999).optional(),
  xMm: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  yMm: z.number().int().min(-1_000_000).max(1_000_000).optional(),
});

const updateSchema = schema
  .omit({ rowLabel: true, positionIndex: true, xMm: true, yMm: true })
  .extend({
    rackId: z.string().uuid(),
    displayName: z.string().trim().min(2).max(120),
    profileKey: z.string().trim().min(2).max(80),
    role: z.string().trim().min(2).max(160),
    enclosure: z.string().trim().min(2).max(80),
    powerFeed: z.string().trim().min(2).max(160),
    cooling: z.string().trim().min(2).max(160),
    cableManagement: z.string().trim().min(2).max(160),
    security: z.string().trim().min(2).max(160),
  });

const controlledTagKeys = [
  "displayName",
  "profile",
  "role",
  "enclosure",
  "powerFeed",
  "cooling",
  "cableManagement",
  "security",
];

function implementationTags(existing: unknown, values: z.infer<typeof updateSchema>) {
  const retained = Array.isArray(existing)
    ? existing.filter(
        (tag): tag is string =>
          typeof tag === "string" &&
          tag !== "implemented" &&
          !controlledTagKeys.some((key) => tag.startsWith(`${key}:`)),
      )
    : [];
  return [
    ...retained,
    "implemented",
    `displayName:${encodeURIComponent(values.displayName)}`,
    `profile:${encodeURIComponent(values.profileKey)}`,
    `role:${encodeURIComponent(values.role)}`,
    `enclosure:${encodeURIComponent(values.enclosure)}`,
    `powerFeed:${encodeURIComponent(values.powerFeed)}`,
    `cooling:${encodeURIComponent(values.cooling)}`,
    `cableManagement:${encodeURIComponent(values.cableManagement)}`,
    `security:${encodeURIComponent(values.security)}`,
  ];
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Custom rack details are invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const bundle = await loadRackModel(projectId, modelId);
    if (!bundle) throw new AccessError("Rack model not found.", 404);
    if (!["generated", "rejected"].includes(bundle.model.status)) throw new AccessError("Return this revision to draft before adding racks.", 409);
    if (bundle.model.sourceType === "imported") throw new AccessError("Imported visual models must be mapped before canonical racks can be added.", 409);
    if (bundle.racks.some((rack) => rack.name.toLowerCase() === parsed.data.name.toLowerCase())) return NextResponse.json({ error: "Rack names must be unique in a revision." }, { status: 409 });

    const rowRacks = bundle.racks.filter((rack) => rack.rowLabel.toLowerCase() === parsed.data.rowLabel.toLowerCase());
    const positionIndex = parsed.data.positionIndex ?? (rowRacks.length ? Math.max(...rowRacks.map((rack) => rack.positionIndex)) + 1 : 0);
    const previous = rowRacks.find((rack) => rack.positionIndex === positionIndex - 1) ?? rowRacks.at(-1);
    const aislePitch = Number((bundle.model.basis as { aislePitchMm?: number }).aislePitchMm ?? 2600);
    const rowIndex = [...new Set(bundle.racks.map((rack) => rack.rowLabel))].indexOf(parsed.data.rowLabel);
    const xMm = parsed.data.xMm ?? (previous ? previous.xMm + previous.widthMm + 250 : 0);
    const yMm = parsed.data.yMm ?? (rowIndex >= 0 ? rowIndex : new Set(bundle.racks.map((rack) => rack.rowLabel)).size) * aislePitch;
    const [rack] = await db.insert(rackModelRacks).values({ rackModelId: modelId, name: parsed.data.name, rowLabel: parsed.data.rowLabel, positionIndex, xMm, yMm, widthMm: parsed.data.widthMm, depthMm: parsed.data.depthMm, heightMm: parsed.data.heightMm, totalUnits: parsed.data.totalUnits, maxPowerKw: parsed.data.maxPowerKw === undefined ? null : String(parsed.data.maxPowerKw), tags: ["manual", "custom"] }).returning();
    const summary = { ...(bundle.model.summary as Record<string, unknown>), rackCount: bundle.racks.length + 1, lastManualRack: rack.name };
    const sourceHash = createHash("sha256").update(`${bundle.model.sourceHash}:rack:add:${rack.id}:${JSON.stringify(parsed.data)}`).digest("hex");
    await db.update(rackModels).set({ sourceHash, summary, updatedAt: new Date() }).where(eq(rackModels.id, modelId));
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.rack_added", entityType: "rack_model_rack", entityId: rack.id, after: { ...parsed.data, xMm, yMm, positionIndex } });
    return NextResponse.json(await loadRackModel(projectId, modelId), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add custom rack." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Rack implementation details are invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const bundle = await loadRackModel(projectId, modelId);
    if (!bundle) throw new AccessError("Rack model not found.", 404);
    if (!["generated", "rejected"].includes(bundle.model.status)) throw new AccessError("Return this revision to draft before editing racks.", 409);
    if (bundle.model.sourceType === "imported") throw new AccessError("Imported visual models must be mapped before canonical racks can be edited.", 409);
    const existing = bundle.racks.find((rack) => rack.id === parsed.data.rackId);
    if (!existing) throw new AccessError("Rack not found in this revision.", 404);
    if (bundle.racks.some((rack) => rack.id !== existing.id && rack.name.toLowerCase() === parsed.data.name.toLowerCase())) return NextResponse.json({ error: "Rack names must be unique in a revision." }, { status: 409 });
    const tags = implementationTags(existing.tags, parsed.data);
    const [rack] = await db.update(rackModelRacks).set({
      name: parsed.data.name,
      totalUnits: parsed.data.totalUnits,
      maxPowerKw: parsed.data.maxPowerKw === undefined ? null : String(parsed.data.maxPowerKw),
      widthMm: parsed.data.widthMm,
      depthMm: parsed.data.depthMm,
      heightMm: parsed.data.heightMm,
      tags,
      updatedAt: new Date(),
    }).where(eq(rackModelRacks.id, existing.id)).returning();
    const sourceHash = createHash("sha256").update(`${bundle.model.sourceHash}:rack:update:${rack.id}:${JSON.stringify(parsed.data)}`).digest("hex");
    await db.update(rackModels).set({ sourceHash, updatedAt: new Date() }).where(eq(rackModels.id, modelId));
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.rack_updated", entityType: "rack_model_rack", entityId: rack.id, before: existing, after: { ...rack, displayName: parsed.data.displayName, profileKey: parsed.data.profileKey } });
    return NextResponse.json(await loadRackModel(projectId, modelId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update rack.", }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
