import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { projects, rackModelArtifacts, rackModels, storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { loadRackModel } from "@/lib/rack-model/load";
import { objectStorage } from "@/lib/storage/service";

export const runtime = "nodejs";
const MAX_BYTES = 75 * 1024 * 1024;

function validateModelFile(file: File, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "glb") {
    const header = new TextDecoder().decode(bytes.slice(0, 4));
    if (header !== "glTF") throw new Error("The GLB header is invalid.");
    return { format: "glb", mediaType: "model/gltf-binary" } as const;
  }
  if (extension === "obj") {
    const preview = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512_000)));
    if (!/(^|\n)\s*v\s+[-+0-9.]/m.test(preview) || !/(^|\n)\s*f\s+[0-9]/m.test(preview)) {
      throw new Error("The OBJ does not contain recognizable vertices and faces.");
    }
    return { format: "obj", mediaType: "model/obj" } as const;
  }
  throw new Error("Upload a binary GLB or self-contained OBJ model.");
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let storedKey: string | null = null;
  let committed = false;
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    const requestedName = String(form.get("name") ?? "").trim();
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a GLB or OBJ file." }, { status: 400 });
    if (file.size < 16 || file.size > MAX_BYTES) return NextResponse.json({ error: "Model files must be between 16 bytes and 75 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = validateModelFile(file, bytes);
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes, mediaType: detected.mediaType, fileName: file.name });
    storedKey = stored.objectKey;
    const model = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId}))`);
      const [latest] = await tx.select({ revision: rackModels.revision }).from(rackModels).where(eq(rackModels.projectId, projectId)).orderBy(desc(rackModels.revision)).limit(1);
      const [object] = await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId }).onConflictDoUpdate({ target: storageObjects.objectKey, set: { updatedAt: new Date() } }).returning();
      const [created] = await tx.insert(rackModels).values({
        projectId,
        name: requestedName || file.name.replace(/\.(glb|obj)$/i, ""),
        revision: (latest?.revision ?? 0) + 1,
        sourceHash: stored.sha256,
        sourceType: "imported",
        sourceObjectId: object.id,
        sourceFormat: detected.format,
        originalFileName: file.name,
        createdBy: actor.userId,
        basis: { source: "user_model_import", originalFileName: file.name, mediaType: detected.mediaType, authoritativeGeometry: false, note: "Imported geometry is reviewable project context until its objects are mapped to controlled racks and assets." },
        summary: { imported: true, byteSize: stored.byteSize, rackCount: 0, mappedAssetCount: 0 },
      }).returning();
      await tx.insert(rackModelArtifacts).values({ rackModelId: created.id, storageObjectId: object.id, format: `source_${detected.format}`, fileName: file.name, createdBy: actor.userId, metadata: { original: true, sha256: stored.sha256 } });
      return created;
    });
    committed = true;
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "rack_model.imported", entityType: "rack_model", entityId: model.id, after: { fileName: file.name, format: detected.format, sha256: stored.sha256, byteSize: stored.byteSize } });
    const bundle = await loadRackModel(projectId, model.id);
    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    if (storedKey && !committed) await objectStorage.remove(storedKey);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import model." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}
