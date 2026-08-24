import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { rackModels } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { createRackModel } from "@/lib/rack-model/generation";
import { loadRackModel } from "@/lib/rack-model/load";

export const runtime = "nodejs";
const createSchema = z.object({
  name: z.string().trim().min(3).max(220).optional(),
  preferences: z
    .object({
      rackCount: z.number().int().min(1).max(500).optional(),
      racksPerRow: z.number().int().min(1).max(50).optional(),
      rackPowerKw: z.number().positive().max(500).optional(),
      totalUnits: z.number().int().min(12).max(60).optional(),
      rackWidthMm: z.number().int().min(400).max(1600).optional(),
      rackDepthMm: z.number().int().min(500).max(2400).optional(),
      rackHeightMm: z.number().int().min(1000).max(3200).optional(),
      rackGapMm: z.number().int().min(0).max(1000).optional(),
      aislePitchMm: z.number().int().min(1400).max(8000).optional(),
      platform: z.string().trim().max(160).optional(),
      coolingArchitecture: z.string().trim().max(160).optional(),
      equipmentProfile: z
        .array(
          z.object({
            name: z.string().trim().min(2).max(180),
            equipmentType: z.enum([
              "nodes",
              "network",
              "storage",
              "power",
              "cooling",
              "other",
            ]),
            countPerRack: z.number().int().min(1).max(20),
            unitHeight: z.number().int().min(1).max(48),
            powerKw: z.number().min(0).max(500).optional(),
            vendor: z.string().trim().max(180).optional(),
            modelReference: z.string().trim().max(180).optional(),
          }),
        )
        .max(30)
        .optional(),
      gpuClusters: z
        .array(
          z.object({
            name: z.string().trim().min(2).max(160),
            workload: z.string().trim().max(160).optional(),
            rackCount: z.number().int().min(1).max(500),
            vendor: z.string().trim().min(2).max(120),
            model: z.string().trim().min(2).max(160),
            architecture: z.string().trim().max(120).optional(),
            nodesPerRack: z.number().int().min(1).max(48),
            gpusPerNode: z.number().int().min(1).max(256),
            nodeUnitHeight: z.number().int().min(1).max(48),
            nodePowerKw: z.number().positive().max(500),
            nodeHeatKw: z.number().positive().max(500).optional(),
            coolingClass: z.string().trim().max(100).optional(),
            fabricType: z.string().trim().min(2).max(100),
            fabricPortsPerNode: z.number().int().min(1).max(16),
            portSpeedGbps: z.number().int().min(1).max(3200),
            topology: z
              .enum(["leaf_spine", "rail_optimized", "ring"])
              .optional(),
            color: z
              .string()
              .regex(/^#[0-9a-f]{6}$/i)
              .optional(),
          }),
        )
        .max(12)
        .optional(),
    })
    .optional(),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const models = await db
      .select()
      .from(rackModels)
      .where(eq(rackModels.projectId, projectId))
      .orderBy(desc(rackModels.revision));
    const selected = models[0]
      ? await loadRackModel(projectId, models[0].id)
      : null;
    return NextResponse.json({ models, selected });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load rack models.",
      },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Rack model request is invalid." },
      { status: 400 },
    );
  try {
    const actor = await requireProjectPermission(
      projectId,
      "configuration:manage",
    );
    const result = await createRackModel({
      projectId,
      actorId: actor.userId,
      name: parsed.data.name,
      preferences: parsed.data.preferences,
    });
    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "rack_model.generated",
      entityType: "rack_model",
      entityId: result.model.id,
      after: {
        revision: result.model.revision,
        sourceHash: result.model.sourceHash,
        status: result.model.status,
        summary: result.model.summary,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate rack model.",
      },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}
