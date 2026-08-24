import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { projects, rackModelArtifacts, storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { createGlb, createObj, createRackDbYaml, createRackModelPdf } from "@/lib/rack-model/exports";
import { loadRackModel } from "@/lib/rack-model/load";
import { objectStorage } from "@/lib/storage/service";

export const runtime = "nodejs";
const requestSchema = z.object({ format: z.enum(["rackdb_yaml", "glb", "obj", "pdf"]) });
const formats = {
  rackdb_yaml: { extension: "yml", mediaType: "application/yaml" },
  glb: { extension: "glb", mediaType: "model/gltf-binary" },
  obj: { extension: "obj", mediaType: "model/obj" },
  pdf: { extension: "pdf", mediaType: "application/pdf" },
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string; modelId: string }> }) {
  const { projectId, modelId } = await params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Export format is invalid." }, { status: 400 });
  let storedKey: string | null = null;
  let committed = false;
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const [project, bundle] = await Promise.all([db.query.projects.findFirst({ where: eq(projects.id, projectId) }), loadRackModel(projectId, modelId)]);
    if (!project || !bundle) return NextResponse.json({ error: "Rack model not found." }, { status: 404 });
    let bytes: Buffer;
    if (bundle.model.sourceType === "imported" && parsed.data.format !== "pdf") {
      if (parsed.data.format !== bundle.model.sourceFormat || !bundle.model.sourceObjectId) {
        return NextResponse.json({ error: "Imported geometry can be downloaded in its original format. Map it to canonical racks before exporting RackDB or converting geometry." }, { status: 409 });
      }
      const sourceObject = await db.query.storageObjects.findFirst({ where: eq(storageObjects.id, bundle.model.sourceObjectId) });
      if (!sourceObject || sourceObject.projectId !== projectId) return NextResponse.json({ error: "Imported source object is unavailable." }, { status: 404 });
      bytes = Buffer.from(await objectStorage.read(sourceObject.objectKey));
    } else {
      bytes = parsed.data.format === "rackdb_yaml" ? createRackDbYaml(bundle) : parsed.data.format === "obj" ? createObj(bundle) : parsed.data.format === "glb" ? createGlb(bundle) : await createRackModelPdf(bundle);
    }
    const config = formats[parsed.data.format];
    const base = bundle.model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    const fileName = bundle.model.sourceType === "imported" && parsed.data.format === bundle.model.sourceFormat
      ? (bundle.model.originalFileName || `${base}.${config.extension}`)
      : `${base}-r${bundle.model.revision}.${config.extension}`;
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes, mediaType: config.mediaType, fileName });
    storedKey = stored.objectKey;
    const persisted = await db.transaction(async (tx) => {
      const [object] = await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId }).onConflictDoUpdate({ target: storageObjects.objectKey, set: { updatedAt: new Date() } }).returning();
      const [artifact] = await tx.insert(rackModelArtifacts).values({ rackModelId: modelId, storageObjectId: object.id, format: parsed.data.format, fileName, createdBy: actor.userId, metadata: { revision: bundle.model.revision, sourceHash: bundle.model.sourceHash } }).returning();
      return { object, artifact };
    });
    committed = true;
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.exported", entityType: "rack_model", entityId: modelId, after: { format: parsed.data.format, artifactId: persisted.artifact.id, sha256: stored.sha256, fileName } });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": config.mediaType, "Content-Disposition": `attachment; filename="${fileName}"`, "X-Pramana-Artifact-Id": persisted.artifact.id } });
  } catch (error) {
    if (storedKey && !committed) await objectStorage.remove(storedKey);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export rack model." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
