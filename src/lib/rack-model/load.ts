import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  rackModelClusters,
  rackModelEquipment,
  rackModelGpuProfiles,
  rackModelLinks,
  rackModelPorts,
  rackModelRacks,
  rackModels,
  storageObjects,
} from "@/lib/db/schema";
import type { RackModelBundle } from "@/lib/rack-model/types";
import { objectStorage } from "@/lib/storage/service";

export async function loadRackModel(
  projectId: string,
  modelId: string,
): Promise<RackModelBundle | null> {
  const model = await db.query.rackModels.findFirst({
    where: eq(rackModels.id, modelId),
  });
  if (!model || model.projectId !== projectId) return null;
  const [racks, equipment, clusters, gpuProfiles, ports, links] =
    await Promise.all([
      db
        .select()
        .from(rackModelRacks)
        .where(eq(rackModelRacks.rackModelId, modelId))
        .orderBy(
          asc(rackModelRacks.rowLabel),
          asc(rackModelRacks.positionIndex),
        ),
      db
        .select()
        .from(rackModelEquipment)
        .where(eq(rackModelEquipment.rackModelId, modelId))
        .orderBy(asc(rackModelEquipment.startUnit)),
      db
        .select()
        .from(rackModelClusters)
        .where(eq(rackModelClusters.rackModelId, modelId))
        .orderBy(asc(rackModelClusters.name)),
      db
        .select()
        .from(rackModelGpuProfiles)
        .where(eq(rackModelGpuProfiles.rackModelId, modelId))
        .orderBy(asc(rackModelGpuProfiles.profileKey)),
      db
        .select()
        .from(rackModelPorts)
        .where(eq(rackModelPorts.rackModelId, modelId))
        .orderBy(asc(rackModelPorts.positionIndex)),
      db
        .select()
        .from(rackModelLinks)
        .where(eq(rackModelLinks.rackModelId, modelId))
        .orderBy(asc(rackModelLinks.name)),
    ]);
  let sourceUrl: string | null = null;
  let sourceMediaType: string | null = null;
  if (model.sourceObjectId) {
    const object = await db.query.storageObjects.findFirst({
      where: eq(storageObjects.id, model.sourceObjectId),
    });
    if (object?.projectId === projectId) {
      sourceUrl = await objectStorage.signedReadUrl(object.objectKey, 600);
      sourceMediaType = object.mediaType;
    }
  }
  return {
    model,
    racks,
    equipment,
    clusters,
    gpuProfiles,
    ports,
    links,
    sourceUrl,
    sourceMediaType,
  } as RackModelBundle;
}
