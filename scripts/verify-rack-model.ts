import { and, desc, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";
import {
  rackModelClusters,
  rackModelEquipment,
  rackModelGpuProfiles,
  rackModelLinks,
  rackModelPorts,
  rackModelRacks,
  rackModels,
} from "@/lib/db/schema";
import {
  createGlb,
  createObj,
  createRackDbYaml,
  createRackModelPdf,
} from "@/lib/rack-model/exports";
import { createRackModel } from "@/lib/rack-model/generation";
import { loadRackModel } from "@/lib/rack-model/load";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function verifyMixedGpuGeneration(input: {
  projectId: string;
  actorId: string;
}) {
  let modelId: string | null = null;
  try {
    const generated = await createRackModel({
      projectId: input.projectId,
      actorId: input.actorId,
      name: "Automated mixed GPU fabric verification",
      preferences: {
        rackCount: 8,
        racksPerRow: 4,
        totalUnits: 48,
        rackPowerKw: 85,
        gpuClusters: [
          {
            name: "NVIDIA training fabric",
            workload: "Training",
            rackCount: 4,
            vendor: "NVIDIA",
            model: "H100 SXM",
            architecture: "Hopper",
            nodesPerRack: 2,
            gpusPerNode: 8,
            nodeUnitHeight: 4,
            nodePowerKw: 10.2,
            coolingClass: "Direct liquid cooling",
            fabricType: "InfiniBand NDR",
            fabricPortsPerNode: 2,
            portSpeedGbps: 400,
            topology: "rail_optimized",
            color: "#76b900",
          },
          {
            name: "AMD inference fabric",
            workload: "Inference",
            rackCount: 4,
            vendor: "AMD",
            model: "Instinct MI300X",
            architecture: "CDNA 3",
            nodesPerRack: 2,
            gpusPerNode: 8,
            nodeUnitHeight: 4,
            nodePowerKw: 9.8,
            coolingClass: "Direct liquid cooling",
            fabricType: "Ethernet RoCEv2",
            fabricPortsPerNode: 2,
            portSpeedGbps: 400,
            topology: "leaf_spine",
            color: "#ed1c24",
          },
        ],
      },
    });
    modelId = generated.model.id;
    assert(
      generated.clusters.length === 2,
      "Mixed GPU generation lost a cluster.",
    );
    assert(
      generated.gpuProfiles.length === 2,
      "Mixed GPU generation lost a GPU profile.",
    );
    assert(
      generated.equipment.filter((item) => item.gpuProfileId).length === 16,
      "Mixed GPU generation produced the wrong number of GPU nodes.",
    );
    assert(
      generated.ports.length > 0,
      "Mixed GPU generation produced no ports.",
    );
    assert(
      generated.links.length > 0,
      "Mixed GPU generation produced no links.",
    );
    assert(
      new Set(generated.links.map((link) => link.clusterId)).size === 2,
      "Fabric links were not isolated by GPU cluster.",
    );
    return {
      clusters: generated.clusters.length,
      gpuNodes: generated.equipment.filter((item) => item.gpuProfileId).length,
      ports: generated.ports.length,
      links: generated.links.length,
    };
  } finally {
    if (modelId) {
      await db.transaction(async (tx) => {
        await tx
          .delete(rackModelLinks)
          .where(eq(rackModelLinks.rackModelId, modelId));
        await tx
          .delete(rackModelPorts)
          .where(eq(rackModelPorts.rackModelId, modelId));
        await tx
          .delete(rackModelEquipment)
          .where(eq(rackModelEquipment.rackModelId, modelId));
        await tx
          .delete(rackModelGpuProfiles)
          .where(eq(rackModelGpuProfiles.rackModelId, modelId));
        await tx
          .delete(rackModelClusters)
          .where(eq(rackModelClusters.rackModelId, modelId));
        await tx
          .delete(rackModelRacks)
          .where(eq(rackModelRacks.rackModelId, modelId));
        await tx.delete(rackModels).where(eq(rackModels.id, modelId));
      });
    }
  }
}

async function main() {
  const [latest] = await db
    .select()
    .from(rackModels)
    .where(
      and(
        eq(rackModels.sourceType, "generated"),
        eq(rackModels.status, "generated"),
      ),
    )
    .orderBy(desc(rackModels.createdAt))
    .limit(1);
  assert(
    latest,
    "No generated rack model exists. Generate one from Site Analysis before verification.",
  );
  const bundle = await loadRackModel(latest.projectId, latest.id);
  assert(bundle, "Latest rack model could not be loaded.");
  assert(bundle.racks.length > 0, "Rack model contains no racks.");
  assert(
    bundle.equipment.every((item) => {
      const rack = bundle.racks.find(
        (candidate) => candidate.id === item.rackId,
      );
      return (
        rack &&
        item.startUnit >= 1 &&
        item.startUnit + item.unitHeight - 1 <= rack.totalUnits
      );
    }),
    "At least one equipment record exceeds its rack-unit envelope.",
  );
  const equipmentIds = new Set(bundle.equipment.map((item) => item.id));
  const portsById = new Map(bundle.ports.map((port) => [port.id, port]));
  assert(
    bundle.ports.every((port) => equipmentIds.has(port.equipmentId)),
    "At least one fabric port references missing equipment.",
  );
  assert(
    bundle.links.every(
      (link) =>
        portsById.has(link.sourcePortId) && portsById.has(link.targetPortId),
    ),
    "At least one fabric link references a missing port.",
  );
  assert(
    bundle.equipment.every((item) => {
      if (!item.gpuProfileId) return true;
      return (
        !!item.clusterId &&
        (item.acceleratorCount ?? 0) > 0 &&
        bundle.gpuProfiles.some((profile) => profile.id === item.gpuProfileId)
      );
    }),
    "At least one GPU node is missing its cluster, accelerator count, or GPU profile.",
  );

  const rackDb = createRackDbYaml(bundle).toString("utf8");
  assert(
    rackDb.includes("types:\n  racks:"),
    "RackDB export has no rack type registry.",
  );
  assert(
    rackDb.includes("datacenters:"),
    "RackDB export has no datacenter topology.",
  );
  assert(
    rackDb.includes("infrastructures:"),
    "RackDB export has no infrastructure layout.",
  );
  assert(
    (rackDb.match(/^  - rack:/gm) ?? []).length === bundle.racks.length,
    "RackDB infrastructure rack count does not match the model.",
  );
  assert(
    latest.createdBy,
    "Generated rack model has no author for GPU integration verification.",
  );
  const mixedGpu = await verifyMixedGpuGeneration({
    projectId: latest.projectId,
    actorId: latest.createdBy,
  });

  const glb = createGlb(bundle);
  assert(glb.readUInt32LE(0) === 0x46546c67, "GLB magic header is invalid.");
  assert(glb.readUInt32LE(4) === 2, "GLB is not version 2.");
  assert(
    glb.readUInt32LE(8) === glb.length,
    "GLB declared length does not match its bytes.",
  );
  const jsonLength = glb.readUInt32LE(12);
  const gltf = JSON.parse(
    glb
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .trim(),
  );
  assert(
    gltf.nodes.length === bundle.racks.length + bundle.equipment.length,
    "GLB does not contain every rack and equipment object.",
  );
  assert(
    gltf.extras.fabricLinks.length === bundle.links.length,
    "GLB metadata does not contain every persisted fabric link.",
  );

  const obj = createObj(bundle).toString("utf8");
  assert(
    (obj.match(/^o /gm) ?? []).length ===
      bundle.racks.length + bundle.equipment.length,
    "OBJ object count does not match the model.",
  );

  const pdf = await createRackModelPdf(bundle);
  assert(
    pdf.subarray(0, 4).toString("ascii") === "%PDF",
    "Engineering PDF header is invalid.",
  );
  const artifactDirectory = path.join(process.cwd(), "tmp");
  const pdfDirectory = path.join(process.cwd(), "output", "pdf");
  await Promise.all([
    mkdir(artifactDirectory, { recursive: true }),
    mkdir(pdfDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(artifactDirectory, "mumbai-dc07-rackdb.yml"), rackDb),
    writeFile(path.join(artifactDirectory, "mumbai-dc07-racks.glb"), glb),
    writeFile(path.join(artifactDirectory, "mumbai-dc07-racks.obj"), obj),
    writeFile(
      path.join(pdfDirectory, "mumbai-dc07-digital-rack-model.pdf"),
      pdf,
    ),
  ]);
  console.log(
    JSON.stringify(
      {
        ok: true,
        modelId: latest.id,
        revision: latest.revision,
        rackdbVersion: bundle.model.rackdbVersion,
        racks: bundle.racks.length,
        equipment: bundle.equipment.length,
        mixedGpu,
        rackDbBytes: Buffer.byteLength(rackDb),
        glbBytes: glb.length,
        objBytes: Buffer.byteLength(obj),
        pdfBytes: pdf.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
