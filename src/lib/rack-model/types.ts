export type RackModelRackRecord = {
  id: string;
  rackModelId: string;
  sourceSystemId: string | null;
  name: string;
  rowLabel: string;
  positionIndex: number;
  xMm: number;
  yMm: number;
  zMm: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  totalUnits: number;
  maxPowerKw: string | null;
  tags: unknown;
};

export type RackModelEquipmentRecord = {
  id: string;
  rackModelId: string;
  rackId: string;
  sourceAssetId: string | null;
  clusterId: string | null;
  gpuProfileId: string | null;
  name: string;
  equipmentType: string;
  modelReference: string | null;
  vendor: string | null;
  startUnit: number;
  unitHeight: number;
  powerKw: string | null;
  heatKw: string | null;
  weightKg: string | null;
  coolingClass: string | null;
  nodeCount: number | null;
  acceleratorCount: number | null;
  provenance: unknown;
  metadata: unknown;
};

export type RackModelClusterRecord = {
  id: string;
  rackModelId: string;
  name: string;
  workload: string | null;
  topology: string;
  networkFabric: string | null;
  color: string;
  status: string;
  metadata: unknown;
};

export type RackModelGpuProfileRecord = {
  id: string;
  rackModelId: string;
  clusterId: string;
  profileKey: string;
  vendor: string;
  model: string;
  architecture: string | null;
  gpusPerNode: number;
  nodesPerRack: number;
  nodeUnitHeight: number;
  nodePowerKw: string;
  nodeHeatKw: string;
  coolingClass: string | null;
  fabricType: string | null;
  fabricPortsPerNode: number;
  portSpeedGbps: number;
  metadata: unknown;
};

export type RackModelPortRecord = {
  id: string;
  rackModelId: string;
  equipmentId: string;
  name: string;
  portType: string;
  protocol: string | null;
  connector: string | null;
  speedGbps: number | null;
  positionIndex: number;
  metadata: unknown;
};

export type RackModelLinkRecord = {
  id: string;
  rackModelId: string;
  clusterId: string | null;
  sourcePortId: string;
  targetPortId: string;
  name: string;
  linkType: string;
  cableType: string | null;
  lengthM: string | null;
  redundancyGroup: string | null;
  color: string;
  status: string;
  path: unknown;
  metadata: unknown;
};

export type RackModelBundle = {
  model: {
    id: string;
    projectId: string;
    siteAnalysisId: string | null;
    siteAnalysisSnapshotId: string | null;
    sourceType: string;
    sourceObjectId: string | null;
    sourceFormat: string | null;
    originalFileName: string | null;
    name: string;
    status: string;
    revision: number;
    sourceHash: string;
    rackdbVersion: string;
    basis: unknown;
    summary: unknown;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  };
  racks: RackModelRackRecord[];
  equipment: RackModelEquipmentRecord[];
  clusters: RackModelClusterRecord[];
  gpuProfiles: RackModelGpuProfileRecord[];
  ports: RackModelPortRecord[];
  links: RackModelLinkRecord[];
  sourceUrl?: string | null;
  sourceMediaType?: string | null;
};
