export type SuggestedRackProfile = {
  key: string;
  name: string;
  role: string;
  description: string;
  totalUnits: number;
  maxPowerKw: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  enclosure: "Open frame" | "Closed cabinet";
  powerFeed: string;
  cooling: string;
  cableManagement: string;
  security: string;
};

export const suggestedRackProfiles: SuggestedRackProfile[] = [
  {
    key: "ai-training-liquid",
    name: "AI Training Pod",
    role: "High-density GPU training",
    description: "Liquid-cooled accelerator rack with redundant power and high-speed fabric.",
    totalUnits: 52,
    maxPowerKw: 120,
    widthMm: 800,
    depthMm: 1400,
    heightMm: 2450,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B intelligent PDU",
    cooling: "Direct liquid cooling + residual air",
    cableManagement: "Overhead dual-path fiber and power",
    security: "Locking doors + monitored access",
  },
  {
    key: "ai-inference-hybrid",
    name: "AI Inference Pod",
    role: "Low-latency inference",
    description: "Hybrid-cooled compute rack optimized for dense inference services.",
    totalUnits: 48,
    maxPowerKw: 80,
    widthMm: 800,
    depthMm: 1200,
    heightMm: 2200,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B intelligent PDU",
    cooling: "Hybrid liquid + air",
    cableManagement: "Separated data and power pathways",
    security: "Locking doors + monitored access",
  },
  {
    key: "gpu-fabric-spine",
    name: "GPU Fabric Spine",
    role: "Cluster switching and optics",
    description: "Fabric spine rack for rail-optimized GPU interconnect and redundant uplinks.",
    totalUnits: 48,
    maxPowerKw: 35,
    widthMm: 800,
    depthMm: 1200,
    heightMm: 2200,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B intelligent PDU",
    cooling: "Front-to-rear air",
    cableManagement: "High-density overhead fiber trays",
    security: "Locking doors",
  },
  {
    key: "storage-dense",
    name: "Dense Storage Rack",
    role: "Training data and checkpoint storage",
    description: "High-capacity storage rack with weight, airflow, and service-clearance allowance.",
    totalUnits: 48,
    maxPowerKw: 42,
    widthMm: 800,
    depthMm: 1400,
    heightMm: 2200,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B intelligent PDU",
    cooling: "High-volume front-to-rear air",
    cableManagement: "Rear vertical copper and fiber managers",
    security: "Locking doors + asset monitoring",
  },
  {
    key: "network-leaf",
    name: "Network Leaf Rack",
    role: "Top-of-rack and leaf switching",
    description: "Network access rack with diverse carrier and cluster-fabric paths.",
    totalUnits: 42,
    maxPowerKw: 18,
    widthMm: 600,
    depthMm: 1200,
    heightMm: 2100,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B PDU",
    cooling: "Front-to-rear air",
    cableManagement: "Overhead diverse fiber pathways",
    security: "Locking doors",
  },
  {
    key: "management-oob",
    name: "Management & OOB Rack",
    role: "Control plane and out-of-band services",
    description: "Management, monitoring, KVM, timing, and out-of-band control equipment.",
    totalUnits: 42,
    maxPowerKw: 12,
    widthMm: 600,
    depthMm: 1000,
    heightMm: 2100,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B PDU",
    cooling: "Front-to-rear air",
    cableManagement: "Separated management cabling",
    security: "Restricted locking cabinet",
  },
  {
    key: "general-compute",
    name: "General Compute Rack",
    role: "CPU services and utility workloads",
    description: "Balanced compute rack for orchestration, services, and non-accelerated workloads.",
    totalUnits: 48,
    maxPowerKw: 45,
    widthMm: 600,
    depthMm: 1200,
    heightMm: 2200,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B intelligent PDU",
    cooling: "Front-to-rear air",
    cableManagement: "Overhead data and power separation",
    security: "Locking doors",
  },
  {
    key: "cooling-cdu",
    name: "Cooling Distribution Rack",
    role: "Rack-level CDU and controls",
    description: "Technology-cooling distribution and monitoring interface for liquid-cooled rows.",
    totalUnits: 42,
    maxPowerKw: 16,
    widthMm: 800,
    depthMm: 1200,
    heightMm: 2200,
    enclosure: "Open frame",
    powerFeed: "Dual control power feeds",
    cooling: "Facility-water to technology-loop interface",
    cableManagement: "Dedicated controls pathway",
    security: "Caged technical area",
  },
  {
    key: "power-interface",
    name: "Power Interface Rack",
    role: "Distribution, metering, and transfer",
    description: "Monitored rack power interface with A/B distribution and branch metering.",
    totalUnits: 42,
    maxPowerKw: 20,
    widthMm: 800,
    depthMm: 1000,
    heightMm: 2100,
    enclosure: "Closed cabinet",
    powerFeed: "A/B feeds with metered transfer",
    cooling: "Ambient technical-room cooling",
    cableManagement: "Dedicated power containment",
    security: "Restricted locking cabinet",
  },
  {
    key: "backup-archive",
    name: "Backup & Archive Rack",
    role: "Protected backup and recovery",
    description: "Capacity-oriented backup rack isolated from primary training and inference paths.",
    totalUnits: 48,
    maxPowerKw: 30,
    widthMm: 800,
    depthMm: 1200,
    heightMm: 2200,
    enclosure: "Closed cabinet",
    powerFeed: "Dual A/B PDU",
    cooling: "Front-to-rear air",
    cableManagement: "Separated backup fabric pathway",
    security: "Locking doors + asset monitoring",
  },
];

export function suggestedRackProfile(index: number) {
  return suggestedRackProfiles[index % suggestedRackProfiles.length];
}

export function rackTagValue(tags: unknown, key: string) {
  if (!Array.isArray(tags)) return "";
  const prefix = `${key}:`;
  const value = tags.find(
    (tag): tag is string => typeof tag === "string" && tag.startsWith(prefix),
  );
  if (!value) return "";
  try {
    return decodeURIComponent(value.slice(prefix.length));
  } catch {
    return value.slice(prefix.length);
  }
}
