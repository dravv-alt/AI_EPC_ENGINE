import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  assets,
  projects,
  rackModelEquipment,
  rackModelClusters,
  rackModelGpuProfiles,
  rackModelLinks,
  rackModelPorts,
  rackModelRacks,
  rackModels,
  siteAnalyses,
  siteAnalysisSnapshots,
  systems,
} from "@/lib/db/schema";

type Answers = Record<string, string>;

export type RackModelPreferences = {
  rackCount?: number;
  racksPerRow?: number;
  rackPowerKw?: number;
  totalUnits?: number;
  rackWidthMm?: number;
  rackDepthMm?: number;
  rackHeightMm?: number;
  rackGapMm?: number;
  aislePitchMm?: number;
  platform?: string;
  coolingArchitecture?: string;
  equipmentProfile?: Array<{
    name: string;
    equipmentType:
      "nodes" | "network" | "storage" | "power" | "cooling" | "other";
    countPerRack: number;
    unitHeight: number;
    powerKw?: number;
    vendor?: string;
    modelReference?: string;
  }>;
  gpuClusters?: Array<{
    name: string;
    workload?: string;
    rackCount: number;
    vendor: string;
    model: string;
    architecture?: string;
    nodesPerRack: number;
    gpusPerNode: number;
    nodeUnitHeight: number;
    nodePowerKw: number;
    nodeHeatKw?: number;
    coolingClass?: string;
    fabricType: string;
    fabricPortsPerNode: number;
    portSpeedGbps: number;
    topology?: "leaf_spine" | "rail_optimized" | "ring";
    color?: string;
  }>;
};

function numberFrom(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function rowName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function equipmentProfile(assetType: string) {
  const normalized = assetType.toLowerCase();
  if (/switch|network|fabric|router/.test(normalized))
    return { type: "network", units: 1 };
  if (/storage|nas|san/.test(normalized)) return { type: "storage", units: 2 };
  if (/pdu|power/.test(normalized)) return { type: "power", units: 2 };
  if (/cool|cdu/.test(normalized)) return { type: "cooling", units: 4 };
  return {
    type: "nodes",
    units: /blade|gpu|server|compute/.test(normalized) ? 8 : 2,
  };
}

function defaultPopulation(input: {
  totalUnits: number;
  rackPowerKw: number | null;
  platform: string | null;
  coolingArchitecture: string | null;
}): NonNullable<RackModelPreferences["equipmentProfile"]> {
  const liquid = /liquid|dlc|cdu|immersion/i.test(
    input.coolingArchitecture ?? "",
  );
  const reserved = 2 + 2 + (liquid ? 4 : 0);
  const computeUnits = Math.max(4, input.totalUnits - reserved);
  return [
    {
      name: "A/B intelligent rack PDU",
      equipmentType: "power",
      countPerRack: 2,
      unitHeight: 1,
      powerKw: 0,
    },
    {
      name: "Top-of-rack fabric switch",
      equipmentType: "network",
      countPerRack: 2,
      unitHeight: 1,
      powerKw: input.rackPowerKw
        ? Math.min(1.2, input.rackPowerKw * 0.015)
        : undefined,
    },
    ...(liquid
      ? [
          {
            name: "Rack coolant distribution interface",
            equipmentType: "cooling" as const,
            countPerRack: 1,
            unitHeight: 4,
            powerKw: input.rackPowerKw
              ? Math.min(1.5, input.rackPowerKw * 0.02)
              : undefined,
          },
        ]
      : []),
    {
      name: `${input.platform || "Project workload"} compute assembly`,
      equipmentType: "nodes",
      countPerRack: 1,
      unitHeight: computeUnits,
      powerKw: input.rackPowerKw ?? undefined,
      modelReference: input.platform ?? undefined,
    },
  ];
}

export async function createRackModel(input: {
  projectId: string;
  actorId: string;
  name?: string;
  preferences?: RackModelPreferences;
}) {
  const [project, analysis, systemRows, assetRows, latestSnapshot] =
    await Promise.all([
      db.query.projects.findFirst({ where: eq(projects.id, input.projectId) }),
      db.query.siteAnalyses.findFirst({
        where: eq(siteAnalyses.projectId, input.projectId),
      }),
      db.select().from(systems).where(eq(systems.projectId, input.projectId)),
      db.select().from(assets).where(eq(assets.projectId, input.projectId)),
      db
        .select()
        .from(siteAnalysisSnapshots)
        .where(eq(siteAnalysisSnapshots.projectId, input.projectId))
        .orderBy(desc(siteAnalysisSnapshots.version))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  if (!project) throw new Error("Project not found.");
  if (!analysis) {
    throw new Error(
      "Complete and save Site Analysis before generating a rack model.",
    );
  }

  const answers = (analysis.answers ?? {}) as Answers;
  const preferences = input.preferences ?? {};
  const targetItMw = numberFrom(answers.target_it_mw);
  const statedRackCount =
    preferences.rackCount ?? numberFrom(answers.rack_count);
  const rackPowerKw = preferences.rackPowerKw ?? numberFrom(answers.rack_kw);
  const derivedRackCount =
    targetItMw && rackPowerKw
      ? Math.ceil((targetItMw * 1000) / rackPowerKw)
      : null;
  const rackCount = Math.round(statedRackCount ?? derivedRackCount ?? 0);

  if (!rackCount) {
    throw new Error(
      "Rack count is unresolved. Save an Initial rack count, or save Target IT MW and Typical rack load in Site Analysis.",
    );
  }
  if (rackCount < 1 || rackCount > 500) {
    throw new Error(
      "Rack count must be between 1 and 500 for an interactive planning model.",
    );
  }

  const racksPerRow = Math.min(
    rackCount,
    preferences.racksPerRow ??
      Math.min(20, Math.max(8, Math.ceil(Math.sqrt(rackCount * 2)))),
  );
  const rowCount = Math.ceil(rackCount / racksPerRow);
  const rackWidthMm = preferences.rackWidthMm ?? 600;
  const rackDepthMm = preferences.rackDepthMm ?? 1200;
  const rackHeightMm = preferences.rackHeightMm ?? 2200;
  const totalUnits = preferences.totalUnits ?? 48;
  const rackGapMm = preferences.rackGapMm ?? 80;
  const aislePitchMm = preferences.aislePitchMm ?? 3000;
  const platform = preferences.platform?.trim() || answers.platform || null;
  const coolingArchitecture =
    preferences.coolingArchitecture?.trim() ||
    answers.cooling_architecture ||
    null;
  const population = preferences.equipmentProfile?.length
    ? preferences.equipmentProfile
    : defaultPopulation({
        totalUnits,
        rackPowerKw,
        platform,
        coolingArchitecture,
      });
  const gpuClusters = (preferences.gpuClusters ?? []).filter(
    (cluster) => cluster.rackCount > 0,
  );
  if (
    gpuClusters.reduce((sum, cluster) => sum + cluster.rackCount, 0) > rackCount
  ) {
    throw new Error(
      "GPU cluster rack assignments exceed the model rack count.",
    );
  }
  for (const cluster of gpuClusters) {
    if (
      !cluster.name.trim() ||
      !cluster.vendor.trim() ||
      !cluster.model.trim()
    ) {
      throw new Error(
        "Every GPU cluster requires a name, GPU vendor, and GPU model.",
      );
    }
    if (
      cluster.nodesPerRack < 1 ||
      cluster.gpusPerNode < 1 ||
      cluster.nodeUnitHeight < 1
    ) {
      throw new Error(
        `GPU cluster ${cluster.name} contains an invalid node or accelerator count.`,
      );
    }
  }
  const infrastructurePopulation = gpuClusters.length
    ? population.filter((item) => item.equipmentType !== "nodes")
    : population;
  const requestedUnits = infrastructurePopulation.reduce(
    (sum, item) => sum + item.countPerRack * item.unitHeight,
    0,
  );
  const largestGpuPopulation = gpuClusters.reduce(
    (largest, cluster) =>
      Math.max(largest, cluster.nodesPerRack * cluster.nodeUnitHeight),
    0,
  );
  if (requestedUnits + largestGpuPopulation > totalUnits) {
    throw new Error(
      `Rack population requires ${requestedUnits}U but the rack contains ${totalUnits}U.`,
    );
  }
  const sourceSystem =
    systemRows.find((item) =>
      /rack|compute|it|workload/i.test(`${item.name} ${item.systemType}`),
    ) ??
    systemRows[0] ??
    null;
  const mismatchPct =
    statedRackCount && rackPowerKw && targetItMw
      ? Math.abs((statedRackCount * rackPowerKw) / 1000 - targetItMw) /
        targetItMw
      : null;
  const assumptions = [
    ...(statedRackCount
      ? []
      : ["Rack count calculated from target IT load and typical rack load."]),
    `${totalUnits}U, ${rackWidthMm} mm x ${rackDepthMm} mm planning rack envelope used until OEM dimensions are approved.`,
    "Aisle and row geometry is a planning layout and requires architectural coordination.",
    ...(Object.keys(preferences).length
      ? [
          "This revision includes explicit user planning overrides; each remains subject to controlled review.",
        ]
      : []),
    ...(mismatchPct !== null && mismatchPct > 0.1
      ? [
          "Stated rack count and rack kW differ from target IT MW by more than 10%.",
        ]
      : []),
  ];
  const sourcePayload = {
    analysisId: analysis.id,
    analysisUpdatedAt: analysis.updatedAt,
    snapshotId: latestSnapshot?.id ?? null,
    snapshotHash: latestSnapshot?.inputsHash ?? null,
    answers,
    preferences,
    systems: systemRows.map(({ id, name, systemType }) => ({
      id,
      name,
      systemType,
    })),
    assets: assetRows.map(({ id, systemId, tag, assetType, vendor }) => ({
      id,
      systemId,
      tag,
      assetType,
      vendor,
    })),
  };
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(sourcePayload))
    .digest("hex");
  const modelName =
    input.name?.trim() ||
    `${answers.project_name?.trim() || project.name} - rack planning model`;

  return db.transaction(async (tx) => {
    // Generation can be initiated from more than one browser session. Serialize
    // revisions per project so the project/revision uniqueness constraint never
    // turns a valid concurrent request into an intermittent failure.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.projectId}))`,
    );
    const [latestModel] = await tx
      .select({ revision: rackModels.revision })
      .from(rackModels)
      .where(eq(rackModels.projectId, input.projectId))
      .orderBy(desc(rackModels.revision))
      .limit(1);
    const revision = (latestModel?.revision ?? 0) + 1;

    const [model] = await tx
      .insert(rackModels)
      .values({
        projectId: input.projectId,
        siteAnalysisId: analysis.id,
        siteAnalysisSnapshotId: latestSnapshot?.id ?? null,
        name: modelName,
        revision,
        sourceHash,
        rackdbVersion: "0.7",
        createdBy: input.actorId,
        basis: {
          source: "site_analysis_and_controlled_assets",
          projectCode: project.code,
          location: answers.location || null,
          platform,
          workload: answers.workload || null,
          targetItMw,
          rackPowerKw,
          coolingArchitecture,
          buildingLayout:
            answers.building_layout_family || answers.building_layout || null,
          customization: Object.keys(preferences).length ? preferences : null,
          equipmentPopulation: population,
          gpuClusters,
          assumptions,
        },
        summary: {
          rackCount,
          rowCount,
          racksPerRow,
          plannedItMw: rackPowerKw ? (rackCount * rackPowerKw) / 1000 : null,
          targetItMw,
          mismatchPct,
          mappedAssetCount: assetRows.length,
          sourceSystemCount: systemRows.length,
          gpuClusterCount: gpuClusters.length,
          plannedGpuCount: gpuClusters.reduce(
            (sum, cluster) =>
              sum +
              cluster.rackCount * cluster.nodesPerRack * cluster.gpusPerNode,
            0,
          ),
        },
      })
      .returning();

    const rackValues = Array.from({ length: rackCount }, (_, index) => {
      const rowIndex = Math.floor(index / racksPerRow);
      const positionIndex = index % racksPerRow;
      const rowLabel = rowName(rowIndex);
      return {
        rackModelId: model.id,
        sourceSystemId: sourceSystem?.id ?? null,
        name: `${rowLabel}-${String(positionIndex + 1).padStart(2, "0")}`,
        rowLabel,
        positionIndex,
        xMm: positionIndex * (rackWidthMm + rackGapMm),
        yMm: rowIndex * aislePitchMm,
        zMm: 0,
        widthMm: rackWidthMm,
        depthMm: rackDepthMm,
        heightMm: rackHeightMm,
        totalUnits,
        maxPowerKw: rackPowerKw ? String(rackPowerKw) : null,
        tags: [
          "planning",
          slug(platform || "platform-unresolved"),
          `row-${rowLabel.toLowerCase()}`,
        ],
      };
    });
    const createdRacks = await tx
      .insert(rackModelRacks)
      .values(rackValues)
      .returning();

    const createdClusters = gpuClusters.length
      ? await tx
          .insert(rackModelClusters)
          .values(
            gpuClusters.map((cluster) => ({
              rackModelId: model.id,
              name: cluster.name.trim(),
              workload: cluster.workload?.trim() || answers.workload || null,
              topology: cluster.topology ?? "leaf_spine",
              networkFabric: cluster.fabricType,
              color: cluster.color ?? "#65c7b7",
              metadata: { rackCount: cluster.rackCount, sourceHash },
            })),
          )
          .returning()
      : [];
    const createdGpuProfiles = createdClusters.length
      ? await tx
          .insert(rackModelGpuProfiles)
          .values(
            createdClusters.map((cluster, index) => {
              const profile = gpuClusters[index];
              return {
                rackModelId: model.id,
                clusterId: cluster.id,
                profileKey: `${slug(profile.vendor)}-${slug(profile.model)}-${index + 1}`,
                vendor: profile.vendor.trim(),
                model: profile.model.trim(),
                architecture: profile.architecture?.trim() || null,
                gpusPerNode: profile.gpusPerNode,
                nodesPerRack: profile.nodesPerRack,
                nodeUnitHeight: profile.nodeUnitHeight,
                nodePowerKw: String(profile.nodePowerKw),
                nodeHeatKw: String(profile.nodeHeatKw ?? profile.nodePowerKw),
                coolingClass:
                  profile.coolingClass?.trim() || coolingArchitecture,
                fabricType: profile.fabricType,
                fabricPortsPerNode: profile.fabricPortsPerNode,
                portSpeedGbps: profile.portSpeedGbps,
                metadata: { source: "user_confirmed_cluster_plan", sourceHash },
              };
            }),
          )
          .returning()
      : [];
    const rackClusterAssignments = new Map<string, number>();
    let assignedRackIndex = 0;
    gpuClusters.forEach((cluster, clusterIndex) => {
      for (let index = 0; index < cluster.rackCount; index += 1) {
        const rack = createdRacks[assignedRackIndex++];
        if (rack) rackClusterAssignments.set(rack.id, clusterIndex);
      }
    });

    const equipmentValues = createdRacks.flatMap((rack, rackIndex) => {
      const mappedAssets = assetRows.filter(
        (_, assetIndex) => assetIndex % rackCount === rackIndex,
      );
      const unusedAssets = [...mappedAssets];
      let nextUnit = 1;
      const controlled = [] as Array<typeof rackModelEquipment.$inferInsert>;
      const clusterIndex = rackClusterAssignments.get(rack.id);
      const cluster =
        clusterIndex === undefined ? null : createdClusters[clusterIndex];
      const gpuProfile =
        clusterIndex === undefined ? null : createdGpuProfiles[clusterIndex];
      for (const component of infrastructurePopulation) {
        for (
          let componentIndex = 0;
          componentIndex < component.countPerRack;
          componentIndex += 1
        ) {
          if (nextUnit + component.unitHeight - 1 > totalUnits) break;
          const assetIndex = unusedAssets.findIndex(
            (asset) =>
              equipmentProfile(asset.assetType).type ===
              component.equipmentType,
          );
          const asset =
            assetIndex >= 0 ? unusedAssets.splice(assetIndex, 1)[0] : null;
          controlled.push({
            rackModelId: model.id,
            rackId: rack.id,
            sourceAssetId: asset?.id ?? null,
            clusterId: cluster?.id ?? null,
            name:
              asset?.tag ??
              (component.countPerRack > 1
                ? `${component.name} ${componentIndex + 1}`
                : component.name),
            equipmentType: component.equipmentType,
            modelReference:
              asset?.assetType ?? component.modelReference ?? platform ?? null,
            vendor:
              asset?.vendor ??
              component.vendor ??
              (platform?.startsWith("NVIDIA") ? "NVIDIA" : null),
            startUnit: nextUnit,
            unitHeight: component.unitHeight,
            powerKw:
              component.powerKw !== undefined
                ? String(component.powerKw)
                : null,
            heatKw:
              component.powerKw !== undefined
                ? String(component.powerKw)
                : null,
            coolingClass: coolingArchitecture,
            provenance: {
              kind: asset
                ? "controlled_asset_with_planning_slot"
                : preferences.equipmentProfile?.length
                  ? "user_planning_spec"
                  : "site_analysis_planning_profile",
              assetId: asset?.id ?? null,
              systemId: asset?.systemId ?? null,
              siteAnalysisId: analysis.id,
              sourceHash,
              approved: false,
            },
            metadata: { workload: answers.workload || null, componentIndex },
          });
          nextUnit += component.unitHeight;
        }
      }
      if (cluster && gpuProfile) {
        const profile = gpuClusters[clusterIndex!];
        for (
          let nodeIndex = 0;
          nodeIndex < profile.nodesPerRack;
          nodeIndex += 1
        ) {
          controlled.push({
            rackModelId: model.id,
            rackId: rack.id,
            clusterId: cluster.id,
            gpuProfileId: gpuProfile.id,
            name: `${profile.vendor} ${profile.model} node ${nodeIndex + 1}`,
            equipmentType: "gpu_node",
            modelReference: profile.model,
            vendor: profile.vendor,
            startUnit: nextUnit,
            unitHeight: profile.nodeUnitHeight,
            powerKw: String(profile.nodePowerKw),
            heatKw: String(profile.nodeHeatKw ?? profile.nodePowerKw),
            coolingClass: profile.coolingClass || coolingArchitecture,
            nodeCount: 1,
            acceleratorCount: profile.gpusPerNode,
            provenance: {
              kind: "user_confirmed_gpu_cluster_plan",
              siteAnalysisId: analysis.id,
              sourceHash,
              approved: false,
            },
            metadata: {
              clusterName: cluster.name,
              architecture: profile.architecture || null,
              fabricType: profile.fabricType,
              nodeIndex,
            },
          });
          nextUnit += profile.nodeUnitHeight;
        }
      }
      for (const asset of unusedAssets.slice(0, 10)) {
        const profile = equipmentProfile(asset.assetType);
        if (nextUnit + profile.units - 1 > totalUnits) break;
        controlled.push({
          rackModelId: model.id,
          rackId: rack.id,
          sourceAssetId: asset.id,
          name: asset.tag,
          equipmentType: profile.type,
          modelReference: asset.assetType,
          vendor: asset.vendor,
          startUnit: nextUnit,
          unitHeight: profile.units,
          coolingClass: coolingArchitecture,
          provenance: {
            kind: "controlled_asset",
            assetId: asset.id,
            systemId: asset.systemId,
          },
          metadata: { originalAssetType: asset.assetType },
        });
        nextUnit += profile.units;
      }
      return controlled;
    });
    const createdEquipment = await tx
      .insert(rackModelEquipment)
      .values(equipmentValues)
      .returning();

    const portsToCreate: Array<typeof rackModelPorts.$inferInsert> = [];
    for (const item of createdEquipment) {
      const profile = createdGpuProfiles.find(
        (candidate) => candidate.id === item.gpuProfileId,
      );
      if (profile) {
        for (let index = 0; index < profile.fabricPortsPerNode; index += 1) {
          portsToCreate.push({
            rackModelId: model.id,
            equipmentId: item.id,
            name: `fabric-${index + 1}`,
            portType: "fabric",
            protocol: profile.fabricType,
            connector: profile.portSpeedGbps >= 800 ? "OSFP" : "QSFP-DD",
            speedGbps: profile.portSpeedGbps,
            positionIndex: index,
            metadata: {
              clusterId: item.clusterId,
              rail: index % 2 === 0 ? "A" : "B",
            },
          });
        }
      } else if (item.equipmentType === "network" && item.clusterId) {
        for (let index = 0; index < 64; index += 1) {
          portsToCreate.push({
            rackModelId: model.id,
            equipmentId: item.id,
            name: `port-${String(index + 1).padStart(2, "0")}`,
            portType: index < 56 ? "downlink" : "uplink",
            protocol: createdClusters.find(
              (candidate) => candidate.id === item.clusterId,
            )?.networkFabric,
            speedGbps:
              createdGpuProfiles.find(
                (candidate) => candidate.clusterId === item.clusterId,
              )?.portSpeedGbps ?? 400,
            positionIndex: index,
            metadata: { clusterId: item.clusterId },
          });
        }
      }
    }
    const createdPorts = portsToCreate.length
      ? await tx.insert(rackModelPorts).values(portsToCreate).returning()
      : [];
    const portsByEquipment = new Map<string, typeof createdPorts>();
    createdPorts.forEach((port) => {
      const list = portsByEquipment.get(port.equipmentId) ?? [];
      list.push(port);
      portsByEquipment.set(port.equipmentId, list);
    });
    const linksToCreate: Array<typeof rackModelLinks.$inferInsert> = [];
    for (const cluster of createdClusters) {
      const clusterEquipment = createdEquipment.filter(
        (item) => item.clusterId === cluster.id,
      );
      const switches = clusterEquipment.filter(
        (item) => item.equipmentType === "network",
      );
      const gpuNodes = clusterEquipment.filter((item) => item.gpuProfileId);
      const switchesByRack = new Map<string, typeof switches>();
      switches.forEach((item) => {
        const list = switchesByRack.get(item.rackId) ?? [];
        list.push(item);
        switchesByRack.set(item.rackId, list);
      });
      for (const node of gpuNodes) {
        const nodePorts = portsByEquipment.get(node.id) ?? [];
        const rackSwitches = switchesByRack.get(node.rackId) ?? [];
        nodePorts.forEach((nodePort, index) => {
          const targetSwitch =
            rackSwitches[index % Math.max(rackSwitches.length, 1)];
          const switchPort = targetSwitch
            ? (portsByEquipment.get(targetSwitch.id) ?? []).find(
                (port) =>
                  port.portType === "downlink" &&
                  !linksToCreate.some((link) => link.targetPortId === port.id),
              )
            : null;
          if (!switchPort) return;
          linksToCreate.push({
            rackModelId: model.id,
            clusterId: cluster.id,
            sourcePortId: nodePort.id,
            targetPortId: switchPort.id,
            name: `${node.name} to ${targetSwitch.name}`,
            linkType: "node_fabric",
            cableType:
              nodePort.speedGbps && nodePort.speedGbps >= 800
                ? "OSFP optical"
                : "QSFP-DD optical",
            redundancyGroup: index % 2 === 0 ? "A" : "B",
            color: cluster.color,
            metadata: {
              sourceEquipmentId: node.id,
              targetEquipmentId: targetSwitch.id,
            },
          });
        });
      }
      const rootSwitches = switchesByRack.values().next().value ?? [];
      for (const [rackId, rackSwitches] of switchesByRack) {
        if (rackId === rootSwitches[0]?.rackId) continue;
        rackSwitches.forEach((rackSwitch, index) => {
          const rootSwitch =
            rootSwitches[index % Math.max(rootSwitches.length, 1)];
          const sourcePort = (portsByEquipment.get(rackSwitch.id) ?? []).find(
            (port) => port.portType === "uplink",
          );
          const targetPort = rootSwitch
            ? (portsByEquipment.get(rootSwitch.id) ?? []).find(
                (port) =>
                  port.portType === "uplink" &&
                  !linksToCreate.some((link) => link.targetPortId === port.id),
              )
            : null;
          if (!sourcePort || !targetPort) return;
          linksToCreate.push({
            rackModelId: model.id,
            clusterId: cluster.id,
            sourcePortId: sourcePort.id,
            targetPortId: targetPort.id,
            name: `${rackSwitch.name} inter-rack uplink`,
            linkType: "inter_rack_fabric",
            cableType: "fiber trunk",
            redundancyGroup: index % 2 === 0 ? "A" : "B",
            color: cluster.color,
            metadata: {
              sourceEquipmentId: rackSwitch.id,
              targetEquipmentId: rootSwitch.id,
            },
          });
        });
      }
    }
    const createdLinks = linksToCreate.length
      ? await tx.insert(rackModelLinks).values(linksToCreate).returning()
      : [];

    return {
      model,
      racks: createdRacks,
      equipment: createdEquipment,
      clusters: createdClusters,
      gpuProfiles: createdGpuProfiles,
      ports: createdPorts,
      links: createdLinks,
    };
  });
}
