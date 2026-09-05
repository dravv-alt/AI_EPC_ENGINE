"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import {
  Box,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Focus,
  Layers3,
  LoaderCircle,
  MousePointer2,
  Network,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { RackModelBundle } from "@/lib/rack-model/types";
import {
  rackTagValue,
  suggestedRackProfile,
  suggestedRackProfiles,
  type SuggestedRackProfile,
} from "@/lib/rack-model/catalog";

type ModelListItem = RackModelBundle["model"];

type RackModelConfig = {
  name: string;
  rackCount: string;
  racksPerRow: string;
  rackPowerKw: string;
  totalUnits: string;
  rackWidthMm: string;
  rackDepthMm: string;
  rackHeightMm: string;
  rackGapMm: string;
  aislePitchMm: string;
  platform: string;
  coolingArchitecture: string;
};

type PopulationItem = {
  id: string;
  name: string;
  equipmentType:
    "nodes" | "network" | "storage" | "power" | "cooling" | "other";
  countPerRack: string;
  unitHeight: string;
  powerKw: string;
  vendor: string;
  modelReference: string;
};

type RackDraft = {
  name: string;
  rowLabel: string;
  totalUnits: string;
  maxPowerKw: string;
  widthMm: string;
  depthMm: string;
  heightMm: string;
};

const emptyRack: RackDraft = { name: "", rowLabel: "A", totalUnits: "48", maxPowerKw: "", widthMm: "600", depthMm: "1200", heightMm: "2200" };

type RackImplementationDraft = {
  name: string;
  displayName: string;
  profileKey: string;
  role: string;
  totalUnits: string;
  maxPowerKw: string;
  widthMm: string;
  depthMm: string;
  heightMm: string;
  enclosure: string;
  powerFeed: string;
  cooling: string;
  cableManagement: string;
  security: string;
};

type GpuClusterDraft = {
  id: string;
  name: string;
  workload: string;
  rackCount: string;
  vendor: string;
  model: string;
  architecture: string;
  nodesPerRack: string;
  gpusPerNode: string;
  nodeUnitHeight: string;
  nodePowerKw: string;
  nodeHeatKw: string;
  coolingClass: string;
  fabricType: string;
  fabricPortsPerNode: string;
  portSpeedGbps: string;
  topology: "leaf_spine" | "rail_optimized" | "ring";
  color: string;
};

const defaultGpuCluster = (): GpuClusterDraft => ({
  id: crypto.randomUUID(),
  name: "Primary AI cluster",
  workload: "Mixed training and inference",
  rackCount: "4",
  vendor: "NVIDIA",
  model: "GB200 NVL72",
  architecture: "Blackwell",
  nodesPerRack: "1",
  gpusPerNode: "72",
  nodeUnitHeight: "40",
  nodePowerKw: "120",
  nodeHeatKw: "120",
  coolingClass: "Direct liquid cooling",
  fabricType: "InfiniBand NDR",
  fabricPortsPerNode: "2",
  portSpeedGbps: "400",
  topology: "rail_optimized",
  color: "#65c7b7",
});

const defaultPopulation: PopulationItem[] = [
  {
    id: "pdu",
    name: "A/B intelligent rack PDU",
    equipmentType: "power",
    countPerRack: "2",
    unitHeight: "1",
    powerKw: "0",
    vendor: "",
    modelReference: "",
  },
  {
    id: "fabric",
    name: "Top-of-rack fabric switch",
    equipmentType: "network",
    countPerRack: "2",
    unitHeight: "1",
    powerKw: "1",
    vendor: "",
    modelReference: "",
  },
  {
    id: "compute",
    name: "Compute assembly",
    equipmentType: "nodes",
    countPerRack: "1",
    unitHeight: "40",
    powerKw: "",
    vendor: "",
    modelReference: "",
  },
];

type EquipmentDraft = {
  name: string;
  equipmentType: PopulationItem["equipmentType"];
  startUnit: string;
  unitHeight: string;
  powerKw: string;
  vendor: string;
  modelReference: string;
};
const emptyEquipment: EquipmentDraft = {
  name: "",
  equipmentType: "nodes",
  startUnit: "1",
  unitHeight: "1",
  powerKw: "",
  vendor: "",
  modelReference: "",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rackImplementationDraft(
  rack: RackModelBundle["racks"][number],
  suggestion: SuggestedRackProfile,
): RackImplementationDraft {
  return {
    name: rack.name,
    displayName: rackTagValue(rack.tags, "displayName") || suggestion.name,
    profileKey: rackTagValue(rack.tags, "profile") || suggestion.key,
    role: rackTagValue(rack.tags, "role") || suggestion.role,
    totalUnits: String(rack.totalUnits),
    maxPowerKw: rack.maxPowerKw ?? String(suggestion.maxPowerKw),
    widthMm: String(rack.widthMm),
    depthMm: String(rack.depthMm),
    heightMm: String(rack.heightMm),
    enclosure:
      rackTagValue(rack.tags, "enclosure") || suggestion.enclosure,
    powerFeed: rackTagValue(rack.tags, "powerFeed") || suggestion.powerFeed,
    cooling: rackTagValue(rack.tags, "cooling") || suggestion.cooling,
    cableManagement:
      rackTagValue(rack.tags, "cableManagement") ||
      suggestion.cableManagement,
    security: rackTagValue(rack.tags, "security") || suggestion.security,
  };
}

function isImplementedRack(tags: unknown) {
  return Array.isArray(tags) && tags.includes("implemented");
}

function configFromBundle(bundle: RackModelBundle | null): RackModelConfig {
  const basis = record(bundle?.model.basis);
  const summary = record(bundle?.model.summary);
  const firstRack = bundle?.racks[0];
  return {
    name: bundle?.model.name ?? "",
    rackCount: summary.rackCount ? String(summary.rackCount) : "",
    racksPerRow: summary.racksPerRow ? String(summary.racksPerRow) : "",
    rackPowerKw: firstRack?.maxPowerKw ?? "",
    totalUnits: firstRack ? String(firstRack.totalUnits) : "48",
    rackWidthMm: firstRack ? String(firstRack.widthMm) : "600",
    rackDepthMm: firstRack ? String(firstRack.depthMm) : "1200",
    rackHeightMm: firstRack ? String(firstRack.heightMm) : "2200",
    rackGapMm: String(record(basis.customization).rackGapMm ?? 80),
    aislePitchMm: String(record(basis.customization).aislePitchMm ?? 3000),
    platform: typeof basis.platform === "string" ? basis.platform : "",
    coolingArchitecture:
      typeof basis.coolingArchitecture === "string"
        ? basis.coolingArchitecture
        : "",
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RackViewer({
  bundle,
  hidden,
  selectedRack,
  onSelectRack,
  showWiring,
}: {
  bundle: RackModelBundle;
  hidden: Set<string>;
  selectedRack: string | null;
  onSelectRack: (id: string | null) => void;
  showWiring: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectMapRef = useRef(new Map<string, THREE.Object3D>());

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1513);
    scene.fog = new THREE.Fog(0x0d1513, 18, 65);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
    camera.position.set(12, 10, 14);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    scene.add(new THREE.HemisphereLight(0xdff7ef, 0x0a1713, 2.1));
    const key = new THREE.DirectionalLight(0xfff3dc, 2.4);
    key.position.set(8, 14, 7);
    key.castShadow = true;
    scene.add(key);
    const grid = new THREE.GridHelper(80, 80, 0x33584f, 0x1d302b);
    scene.add(grid);
    const rackMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2b6e60,
      roughness: 0.52,
      metalness: 0.34,
      transparent: true,
      opacity: 0.46,
    });
    const frameMaterials: THREE.LineBasicMaterial[] = [];
    const generatedMaterials: THREE.Material[] = [];
    const equipmentMaterials: Record<string, THREE.MeshStandardMaterial> = {
      nodes: new THREE.MeshStandardMaterial({
        color: 0xe8b35d,
        roughness: 0.55,
      }),
      network: new THREE.MeshStandardMaterial({
        color: 0x7cb8e8,
        roughness: 0.5,
      }),
      storage: new THREE.MeshStandardMaterial({
        color: 0xa98bdd,
        roughness: 0.5,
      }),
      power: new THREE.MeshStandardMaterial({
        color: 0xe16b67,
        roughness: 0.5,
      }),
      cooling: new THREE.MeshStandardMaterial({
        color: 0x63c7bd,
        roughness: 0.5,
      }),
    };
    const objectMap = new Map<string, THREE.Object3D>();
    const equipmentObjectMap = new Map<string, THREE.Object3D>();
    objectMapRef.current = objectMap;
    const frameObjects = () => {
      const box = new THREE.Box3();
      for (const object of objectMap.values()) box.expandByObject(object);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const dimensions = box.getSize(new THREE.Vector3());
      const size = Math.max(dimensions.length(), 1);
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(new THREE.Vector3(size * 0.48, size * 0.35, size * 0.48));
      camera.near = Math.max(0.01, size / 1000);
      camera.far = Math.max(100, size * 8);
      camera.updateProjectionMatrix();
      controls.update();
    };
    if (bundle.sourceUrl && bundle.model.sourceFormat) {
      const onObject = (object: THREE.Object3D) => {
        object.name = bundle.model.originalFileName || bundle.model.name;
        object.traverse((child) => {
          child.castShadow = true;
          child.receiveShadow = true;
          if (
            child instanceof THREE.Mesh &&
            bundle.model.sourceFormat === "obj"
          ) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x8fb8ad,
              roughness: 0.62,
              metalness: 0.22,
            });
          }
        });
        scene.add(object);
        objectMap.set("imported-model", object);
        frameObjects();
      };
      if (bundle.model.sourceFormat === "glb") {
        new GLTFLoader().load(
          bundle.sourceUrl,
          (gltf) => onObject(gltf.scene),
          undefined,
          () => undefined,
        );
      } else if (bundle.model.sourceFormat === "obj") {
        new OBJLoader().load(
          bundle.sourceUrl,
          onObject,
          undefined,
          () => undefined,
        );
      }
    }
    const equipmentByRack = new Map<string, RackModelBundle["equipment"]>();
    for (const item of bundle.equipment) {
      const items = equipmentByRack.get(item.rackId) ?? [];
      items.push(item);
      equipmentByRack.set(item.rackId, items);
    }
    for (const rack of bundle.racks) {
      const group = new THREE.Group();
      group.name = rack.name;
      group.userData.rackId = rack.id;
      const width = rack.widthMm / 1000,
        depth = rack.depthMm / 1000,
        height = rack.heightMm / 1000;
      group.position.set(rack.xMm / 1000, rack.zMm / 1000, rack.yMm / 1000);
      const shellGeometry = new THREE.BoxGeometry(width, height, depth);
      const shell = new THREE.Mesh(shellGeometry, rackMaterial);
      shell.position.set(width / 2, height / 2, depth / 2);
      shell.castShadow = true;
      shell.receiveShadow = true;
      shell.userData.rackId = rack.id;
      group.add(shell);
      const frameMaterial = new THREE.LineBasicMaterial({
        color: 0xa9d9cb,
        transparent: true,
        opacity: 0.9,
      });
      frameMaterials.push(frameMaterial);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(shellGeometry),
        frameMaterial,
      );
      edges.position.copy(shell.position);
      group.add(edges);
      const postMaterial = new THREE.MeshStandardMaterial({
        color: 0x72958c,
        roughness: 0.35,
        metalness: 0.72,
      });
      const postGeometry = new THREE.BoxGeometry(
        Math.max(width * 0.035, 0.018),
        height,
        Math.max(depth * 0.025, 0.018),
      );
      for (const [px, pz] of [
        [width * 0.05, depth * 0.04],
        [width * 0.95, depth * 0.04],
        [width * 0.05, depth * 0.96],
        [width * 0.95, depth * 0.96],
      ]) {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(px, height / 2, pz);
        group.add(post);
      }
      const rackEquipment = equipmentByRack.get(rack.id) ?? [];
      for (const item of rackEquipment) {
        const unitHeight = height / rack.totalUnits;
        const itemHeight = Math.max(
          unitHeight * item.unitHeight - 0.012,
          0.018,
        );
        const geometry = new THREE.BoxGeometry(
          width * 0.86,
          itemHeight,
          depth * 0.76,
        );
        const cluster = bundle.clusters.find(
          (candidate) => candidate.id === item.clusterId,
        );
        const material = item.gpuProfileId
          ? new THREE.MeshStandardMaterial({
              color: new THREE.Color(cluster?.color ?? "#e8b35d"),
              roughness: 0.4,
              metalness: 0.24,
            })
          : (equipmentMaterials[item.equipmentType] ??
            equipmentMaterials.nodes);
        if (item.gpuProfileId) generatedMaterials.push(material);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          width / 2,
          unitHeight * (item.startUnit - 1) + itemHeight / 2 + 0.006,
          depth * 0.43,
        );
        mesh.userData.rackId = rack.id;
        mesh.userData.equipmentId = item.id;
        equipmentObjectMap.set(item.id, mesh);
        group.add(mesh);
        const face = new THREE.Mesh(
          new THREE.BoxGeometry(
            width * 0.78,
            Math.max(itemHeight * 0.72, 0.012),
            0.012,
          ),
          new THREE.MeshStandardMaterial({
            color: 0x10201c,
            emissive: item.equipmentType === "network" ? 0x174f63 : 0x162720,
            emissiveIntensity: 0.55,
            roughness: 0.4,
          }),
        );
        face.position.set(width / 2, mesh.position.y, 0.045);
        group.add(face);
        if (item.gpuProfileId && item.acceleratorCount) {
          const visibleAccelerators = Math.min(item.acceleratorCount, 8);
          const columns = Math.min(4, visibleAccelerators);
          const rows = Math.ceil(visibleAccelerators / columns);
          const moduleWidth = (width * 0.68) / columns;
          const moduleHeight = Math.min(
            Math.max(itemHeight * 0.2, 0.018),
            (itemHeight * 0.62) / rows,
          );
          const moduleMaterial = new THREE.MeshStandardMaterial({
            color: 0x101715,
            emissive: new THREE.Color(cluster?.color ?? "#65c7b7"),
            emissiveIntensity: 0.42,
            roughness: 0.28,
            metalness: 0.62,
          });
          generatedMaterials.push(moduleMaterial);
          for (let index = 0; index < visibleAccelerators; index += 1) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const acceleratorModule = new THREE.Mesh(
              new THREE.BoxGeometry(
                moduleWidth * 0.72,
                moduleHeight * 0.68,
                0.018,
              ),
              moduleMaterial,
            );
            acceleratorModule.position.set(
              width * 0.16 + column * moduleWidth + moduleWidth / 2,
              mesh.position.y + (row - (rows - 1) / 2) * moduleHeight * 1.12,
              0.034,
            );
            group.add(acceleratorModule);
          }
        }
      }
      group.visible = !hidden.has(rack.id);
      scene.add(group);
      objectMap.set(rack.id, group);
    }
    const portEquipment = new Map(
      bundle.ports.map((port) => [port.id, port.equipmentId]),
    );
    const wiringGroup = new THREE.Group();
    wiringGroup.name = "persisted-cable-links";
    for (const link of bundle.links) {
      const source = equipmentObjectMap.get(
        portEquipment.get(link.sourcePortId) ?? "",
      );
      const target = equipmentObjectMap.get(
        portEquipment.get(link.targetPortId) ?? "",
      );
      if (!source || !target) continue;
      const start = source.getWorldPosition(new THREE.Vector3());
      const end = target.getWorldPosition(new THREE.Vector3());
      const lift = Math.max(start.y, end.y) + 0.35;
      const curve = new THREE.CatmullRomCurve3([
        start,
        new THREE.Vector3(start.x, lift, start.z),
        new THREE.Vector3(end.x, lift, end.z),
        end,
      ]);
      const geometry = new THREE.TubeGeometry(curve, 18, 0.012, 5, false);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(link.color || "#65c7b7"),
        transparent: true,
        opacity: link.linkType === "inter_rack_fabric" ? 0.9 : 0.62,
      });
      const cable = new THREE.Mesh(geometry, material);
      cable.userData.linkId = link.id;
      wiringGroup.add(cable);
    }
    wiringGroup.visible = showWiring;
    scene.add(wiringGroup);
    frameObjects();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const click = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...objectMap.values()], true)[0];
      onSelectRack(hit?.object.userData.rackId ?? null);
    };
    renderer.domElement.addEventListener("click", click);
    const resize = () => {
      const width = host.clientWidth,
        height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", click);
      controls.dispose();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        ) {
          object.geometry.dispose();
        }
      });
      rackMaterial.dispose();
      frameMaterials.forEach((material) => material.dispose());
      Object.values(equipmentMaterials).forEach((material) =>
        material.dispose(),
      );
      generatedMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [bundle, onSelectRack, showWiring]);

  useEffect(() => {
    for (const [id, object] of objectMapRef.current)
      object.visible = !hidden.has(id);
  }, [hidden]);
  useEffect(() => {
    for (const [id, object] of objectMapRef.current)
      object.traverse((child) => {
        if (child instanceof THREE.LineSegments)
          child.material.color.set(id === selectedRack ? 0xffd77f : 0xa9d9cb);
      });
  }, [selectedRack]);

  useEffect(() => {
    if (!selectedRack) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const object = objectMapRef.current.get(selectedRack);
    if (!camera || !controls || !object) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const dimensions = box.getSize(new THREE.Vector3());
    const size = Math.max(dimensions.length(), 2.4);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(size * 1.35, size * 0.82, size * 1.35));
    controls.target.copy(center);
    camera.near = 0.02;
    camera.far = Math.max(120, size * 20);
    camera.updateProjectionMatrix();
    controls.update();
  }, [selectedRack]);

  function setView(
    view: "iso" | "top" | "front",
    scope: "selection" | "hall" = "selection",
  ) {
    const camera = cameraRef.current,
      controls = controlsRef.current;
    if (!camera || !controls) return;
    const box = new THREE.Box3();
    const selectedObject = selectedRack
      ? objectMapRef.current.get(selectedRack)
      : null;
    if (scope === "selection" && selectedObject?.visible)
      box.expandByObject(selectedObject);
    else
      for (const object of objectMapRef.current.values())
        if (object.visible) box.expandByObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = Math.max(box.getSize(new THREE.Vector3()).length(), 2.4);
    const distance = scope === "hall" ? 0.58 : 1.25;
    const offset =
      view === "top"
        ? new THREE.Vector3(0, size * distance * 1.4, 0.001)
        : view === "front"
          ? new THREE.Vector3(0, size * 0.16, size * distance * 1.45)
          : new THREE.Vector3(
              size * distance,
              size * distance * 0.66,
              size * distance,
            );
    camera.position.copy(center).add(offset);
    controls.target.copy(center);
    camera.updateProjectionMatrix();
    controls.update();
  }

  const selectedName = bundle.racks.find(
    (rack) => rack.id === selectedRack,
  )?.name;
  return (
    <div className="rack-viewer-shell">
      <div className="rack-viewer-toolbar" aria-label="Model camera controls">
        <button
          type="button"
          onClick={() => setView("iso", selectedRack ? "selection" : "hall")}
        >
          <Focus size={15} /> {selectedRack ? "Focus rack" : "Isometric"}
        </button>
        <button
          type="button"
          onClick={() => setView("top", selectedRack ? "selection" : "hall")}
        >
          Top
        </button>
        <button
          type="button"
          onClick={() => setView("front", selectedRack ? "selection" : "hall")}
        >
          Front
        </button>
        <span className="rack-viewer-toolbar-divider" />
        <button type="button" onClick={() => setView("iso", "hall")}>
          <Rows3 size={15} /> Fit hall
        </button>
        <span className="rack-viewer-toolbar-divider" />
        <span className="rack-wiring-state">
          <Network size={14} />{" "}
          {showWiring ? `${bundle.links.length} links` : "Wiring hidden"}
        </span>
      </div>
      <div
        ref={hostRef}
        className="rack-viewer-canvas"
        role="img"
        aria-label="Interactive three-dimensional rack planning model"
      />
      <div className="rack-viewer-hud">
        <span>
          <MousePointer2 size={14} />
          {selectedName
            ? `${selectedName} selected`
            : "Select a rack to inspect it"}
        </span>
        <span>Drag to orbit · Scroll to zoom · Right-drag to pan</span>
      </div>
    </div>
  );
}

export function RackModelWorkbench({
  projectId,
  initialModels,
  initialBundle,
}: {
  projectId: string;
  initialModels: ModelListItem[];
  initialBundle: RackModelBundle | null;
}) {
  const [models, setModels] = useState(initialModels);
  const [bundle, setBundle] = useState(initialBundle);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedRack, setSelectedRack] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<RackModelConfig>(() =>
    configFromBundle(initialBundle),
  );
  const [population, setPopulation] =
    useState<PopulationItem[]>(defaultPopulation);
  const [gpuClusters, setGpuClusters] = useState<GpuClusterDraft[]>(() => {
    if (!initialBundle?.gpuProfiles?.length) return [defaultGpuCluster()];
    return initialBundle.gpuProfiles.map((profile) => {
      const cluster = initialBundle.clusters.find(
        (item) => item.id === profile.clusterId,
      );
      const metadata = record(cluster?.metadata);
      return {
        id: cluster?.id ?? crypto.randomUUID(),
        name: cluster?.name ?? profile.model,
        workload: cluster?.workload ?? "",
        rackCount: String(metadata.rackCount ?? 1),
        vendor: profile.vendor,
        model: profile.model,
        architecture: profile.architecture ?? "",
        nodesPerRack: String(profile.nodesPerRack),
        gpusPerNode: String(profile.gpusPerNode),
        nodeUnitHeight: String(profile.nodeUnitHeight),
        nodePowerKw: profile.nodePowerKw,
        nodeHeatKw: profile.nodeHeatKw,
        coolingClass: profile.coolingClass ?? "",
        fabricType: profile.fabricType ?? "",
        fabricPortsPerNode: String(profile.fabricPortsPerNode),
        portSpeedGbps: String(profile.portSpeedGbps),
        topology:
          (cluster?.topology as GpuClusterDraft["topology"]) ?? "leaf_spine",
        color: cluster?.color ?? "#65c7b7",
      };
    });
  });
  const [showWiring, setShowWiring] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [equipmentDraft, setEquipmentDraft] =
    useState<EquipmentDraft>(emptyEquipment);
  const [rackOpen, setRackOpen] = useState(false);
  const [rackDraft, setRackDraft] = useState<RackDraft>(emptyRack);
  const [implementationDraft, setImplementationDraft] =
    useState<RackImplementationDraft | null>(null);
  const [rackQuery, setRackQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () =>
      new Set(
        initialBundle?.racks[0]?.rowLabel
          ? [initialBundle.racks[0].rowLabel]
          : [],
      ),
  );
  const rows = useMemo(
    () =>
      bundle ? [...new Set(bundle.racks.map((rack) => rack.rowLabel))] : [],
    [bundle],
  );
  const selected =
    bundle?.racks.find((rack) => rack.id === selectedRack) ?? null;
  const selectedRackIndex = selected
    ? Math.max(0, bundle?.racks.findIndex((rack) => rack.id === selected.id) ?? 0)
    : 0;
  const selectedSuggestion = suggestedRackProfile(selectedRackIndex);
  const selectedEquipment =
    bundle?.equipment.filter((item) => item.rackId === selectedRack) ?? [];
  const matchingRacks = useMemo(() => {
    if (!bundle) return [];
    const query = rackQuery.trim().toLowerCase();
    return query
      ? bundle.racks.filter((rack, index) => {
          const suggestion = suggestedRackProfile(index);
          const displayName =
            rackTagValue(rack.tags, "displayName") || suggestion.name;
          return `${rack.name} ${displayName} ${suggestion.role} ${rack.rowLabel} ${rack.maxPowerKw ?? ""}`
            .toLowerCase()
            .includes(query);
        })
      : bundle.racks;
  }, [bundle, rackQuery]);

  useEffect(() => {
    setImplementationDraft(
      selected
        ? rackImplementationDraft(selected, selectedSuggestion)
        : null,
    );
  }, [selected, selectedSuggestion]);

  async function generate(custom = false) {
    setBusy("generate");
    setError("");
    const preferences = custom
      ? {
          rackCount: optionalNumber(config.rackCount),
          racksPerRow: optionalNumber(config.racksPerRow),
          rackPowerKw: optionalNumber(config.rackPowerKw),
          totalUnits: optionalNumber(config.totalUnits),
          rackWidthMm: optionalNumber(config.rackWidthMm),
          rackDepthMm: optionalNumber(config.rackDepthMm),
          rackHeightMm: optionalNumber(config.rackHeightMm),
          rackGapMm: optionalNumber(config.rackGapMm),
          aislePitchMm: optionalNumber(config.aislePitchMm),
          platform: config.platform.trim() || undefined,
          coolingArchitecture: config.coolingArchitecture.trim() || undefined,
          equipmentProfile: population.map((item) => ({
            name: item.name.trim(),
            equipmentType: item.equipmentType,
            countPerRack: Number(item.countPerRack),
            unitHeight: Number(item.unitHeight),
            powerKw: optionalNumber(item.powerKw),
            vendor: item.vendor.trim() || undefined,
            modelReference: item.modelReference.trim() || undefined,
          })),
          gpuClusters: gpuClusters.map((cluster) => ({
            name: cluster.name.trim(),
            workload: cluster.workload.trim() || undefined,
            rackCount: Number(cluster.rackCount),
            vendor: cluster.vendor.trim(),
            model: cluster.model.trim(),
            architecture: cluster.architecture.trim() || undefined,
            nodesPerRack: Number(cluster.nodesPerRack),
            gpusPerNode: Number(cluster.gpusPerNode),
            nodeUnitHeight: Number(cluster.nodeUnitHeight),
            nodePowerKw: Number(cluster.nodePowerKw),
            nodeHeatKw: optionalNumber(cluster.nodeHeatKw),
            coolingClass: cluster.coolingClass.trim() || undefined,
            fabricType: cluster.fabricType.trim(),
            fabricPortsPerNode: Number(cluster.fabricPortsPerNode),
            portSpeedGbps: Number(cluster.portSpeedGbps),
            topology: cluster.topology,
            color: cluster.color,
          })),
        }
      : undefined;
    const response = await fetch(`/api/projects/${projectId}/rack-models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.name.trim() || undefined,
        preferences,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to generate model.");
    else {
      setBundle(result);
      setModels((current) => [result.model, ...current]);
      setHidden(new Set());
      setSelectedRack(null);
      setConfig(configFromBundle(result));
      setConfigOpen(false);
    }
    setBusy(null);
  }
  async function selectModel(id: string) {
    setBusy("load");
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${id}`,
    );
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to load model.");
    else {
      setBundle(result);
      setHidden(new Set());
      setSelectedRack(null);
      setConfig(configFromBundle(result));
    }
    setBusy(null);
  }
  async function changeStatus(
    status: "under_review" | "approved" | "rejected" | "superseded",
  ) {
    if (!bundle) return;
    setBusy("status");
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${bundle.model.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to update model.");
    else {
      setBundle({ ...bundle, model: { ...bundle.model, ...result.model } });
      setModels((current) =>
        current.map((item) =>
          item.id === result.model.id ? { ...item, ...result.model } : item,
        ),
      );
    }
    setBusy(null);
  }
  async function exportModel(format: "rackdb_yaml" | "glb" | "obj" | "pdf") {
    if (!bundle) return;
    setBusy(format);
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${bundle.model.id}/export`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      },
    );
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Export failed.");
    } else {
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ?? `rack-model.${format}`;
      downloadBlob(blob, fileName);
    }
    setBusy(null);
  }
  function toggleRack(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleRow(row: string) {
    setHidden((current) => {
      const next = new Set(current);
      const ids =
        bundle?.racks
          .filter((rack) => rack.rowLabel === row)
          .map((rack) => rack.id) ?? [];
      const hide = ids.some((id) => !next.has(id));
      ids.forEach((id) => (hide ? next.add(id) : next.delete(id)));
      return next;
    });
  }
  function toggleRowExpanded(row: string) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }
  function updateConfig(field: keyof RackModelConfig, value: string) {
    setConfig((current) => ({ ...current, [field]: value }));
  }

  function chooseImplementationProfile(profileKey: string) {
    const profile =
      suggestedRackProfiles.find((item) => item.key === profileKey) ??
      selectedSuggestion;
    setImplementationDraft((current) =>
      current
        ? {
            ...current,
            profileKey: profile.key,
            displayName: profile.name,
            role: profile.role,
            totalUnits: String(profile.totalUnits),
            maxPowerKw: String(profile.maxPowerKw),
            widthMm: String(profile.widthMm),
            depthMm: String(profile.depthMm),
            heightMm: String(profile.heightMm),
            enclosure: profile.enclosure,
            powerFeed: profile.powerFeed,
            cooling: profile.cooling,
            cableManagement: profile.cableManagement,
            security: profile.security,
          }
        : current,
    );
  }

  async function importModel() {
    if (!importFile) {
      setError("Choose a GLB or OBJ model file.");
      return;
    }
    setBusy("import");
    setError("");
    const form = new FormData();
    form.set("file", importFile);
    form.set("name", importName);
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/import`,
      { method: "POST", body: form },
    );
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to import model.");
    else {
      setBundle(result);
      setModels((current) => [result.model, ...current]);
      setImportOpen(false);
      setImportFile(null);
      setImportName("");
      setSelectedRack(null);
      setHidden(new Set());
    }
    setBusy(null);
  }

  async function addEquipment() {
    if (!bundle || !selected) return;
    setBusy("equipment");
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${bundle.model.id}/equipment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...equipmentDraft,
          rackId: selected.id,
          startUnit: Number(equipmentDraft.startUnit),
          unitHeight: Number(equipmentDraft.unitHeight),
          powerKw: optionalNumber(equipmentDraft.powerKw),
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to add equipment.");
    else {
      setBundle(result);
      setEquipmentOpen(false);
      setEquipmentDraft(emptyEquipment);
    }
    setBusy(null);
  }

  async function addRack() {
    if (!bundle) return;
    setBusy("rack"); setError("");
    const response = await fetch(`/api/projects/${projectId}/rack-models/${bundle.model.id}/racks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rackDraft.name, rowLabel: rackDraft.rowLabel, totalUnits: Number(rackDraft.totalUnits), maxPowerKw: optionalNumber(rackDraft.maxPowerKw), widthMm: Number(rackDraft.widthMm), depthMm: Number(rackDraft.depthMm), heightMm: Number(rackDraft.heightMm) }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to add custom rack.");
    else { setBundle(result); const created = result.racks.find((rack: RackModelBundle["racks"][number]) => rack.name === rackDraft.name); setSelectedRack(created?.id ?? null); setExpandedRows((current) => new Set([...current, rackDraft.rowLabel])); setRackDraft(emptyRack); setRackOpen(false); }
    setBusy(null);
  }

  async function saveRackImplementation(
    draft: RackImplementationDraft | null = implementationDraft,
  ) {
    if (!bundle || !selected || !draft) return;
    setBusy("rack-update");
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${bundle.model.id}/racks`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          rackId: selected.id,
          totalUnits: Number(draft.totalUnits),
          maxPowerKw: optionalNumber(draft.maxPowerKw),
          widthMm: Number(draft.widthMm),
          depthMm: Number(draft.depthMm),
          heightMm: Number(draft.heightMm),
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to save the implemented rack.");
    } else {
      setBundle(result);
    }
    setBusy(null);
  }

  async function applyRackSuggestion() {
    if (!selected) return;
    const draft: RackImplementationDraft = {
      name: selected.name,
      displayName: selectedSuggestion.name,
      profileKey: selectedSuggestion.key,
      role: selectedSuggestion.role,
      totalUnits: String(selectedSuggestion.totalUnits),
      maxPowerKw: String(selectedSuggestion.maxPowerKw),
      widthMm: String(selectedSuggestion.widthMm),
      depthMm: String(selectedSuggestion.depthMm),
      heightMm: String(selectedSuggestion.heightMm),
      enclosure: selectedSuggestion.enclosure,
      powerFeed: selectedSuggestion.powerFeed,
      cooling: selectedSuggestion.cooling,
      cableManagement: selectedSuggestion.cableManagement,
      security: selectedSuggestion.security,
    };
    setImplementationDraft(draft);
    await saveRackImplementation(draft);
  }

  async function removeEquipment(id: string) {
    if (!bundle) return;
    setBusy("equipment");
    setError("");
    const response = await fetch(
      `/api/projects/${projectId}/rack-models/${bundle.model.id}/equipment?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to remove equipment.");
    else setBundle(result);
    setBusy(null);
  }

  return (
    <section className="rack-model-workbench">
      <header className="rack-model-controlbar">
        <div>
          <p className="eyebrow">RackDB-first controlled model</p>
          <h2>Digital Rack Model</h2>
          <p>
            Generate a detailed rack population from this project, author
            equipment at rack-unit level, or import a GLB/OBJ model as a stored
            project revision.
          </p>
        </div>
        <div className="rack-model-actions">
          <button
            className="button"
            type="button"
            onClick={() => generate(false)}
            disabled={!!busy}
          >
            {busy === "generate" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}{" "}
            Generate from project
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={!!busy}
          >
            <FileUp size={17} /> Import model
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setConfigOpen(true)}
            disabled={!!busy}
          >
            <SlidersHorizontal size={17} /> Create &amp; customize
          </button>
        </div>
      </header>
      {error && (
        <div className="callout callout-danger" role="alert">
          {error}
        </div>
      )}
      {configOpen && (
        <section
          className="rack-config-panel"
          aria-label="Customize rack model revision"
        >
          <header>
            <div>
              <p className="eyebrow">New planning revision</p>
              <h3>Create and customize</h3>
              <p>
                Values below override Site Analysis only for this reviewable
                revision. Blank optional fields continue using the saved project
                basis.
              </p>
            </div>
            <button
              type="button"
              className="rack-config-close"
              onClick={() => setConfigOpen(false)}
              aria-label="Close customization"
            >
              <X size={18} />
            </button>
          </header>
          <div className="rack-config-grid">
            <label className="rack-config-wide">
              <span>Revision name</span>
              <input
                value={config.name}
                onChange={(event) => updateConfig("name", event.target.value)}
                placeholder="e.g. High-density hybrid option"
              />
            </label>
            <label>
              <span>Rack count</span>
              <input
                type="number"
                min="1"
                max="500"
                value={config.rackCount}
                onChange={(event) =>
                  updateConfig("rackCount", event.target.value)
                }
              />
            </label>
            <label>
              <span>Racks per row</span>
              <input
                type="number"
                min="1"
                max="50"
                value={config.racksPerRow}
                onChange={(event) =>
                  updateConfig("racksPerRow", event.target.value)
                }
              />
            </label>
            <label>
              <span>Power per rack (kW)</span>
              <input
                type="number"
                min="0.1"
                max="500"
                step="0.1"
                value={config.rackPowerKw}
                onChange={(event) =>
                  updateConfig("rackPowerKw", event.target.value)
                }
              />
            </label>
            <label>
              <span>Rack units</span>
              <input
                type="number"
                min="12"
                max="60"
                value={config.totalUnits}
                onChange={(event) =>
                  updateConfig("totalUnits", event.target.value)
                }
              />
            </label>
            <label>
              <span>Width (mm)</span>
              <input
                type="number"
                min="400"
                max="1600"
                value={config.rackWidthMm}
                onChange={(event) =>
                  updateConfig("rackWidthMm", event.target.value)
                }
              />
            </label>
            <label>
              <span>Depth (mm)</span>
              <input
                type="number"
                min="500"
                max="2400"
                value={config.rackDepthMm}
                onChange={(event) =>
                  updateConfig("rackDepthMm", event.target.value)
                }
              />
            </label>
            <label>
              <span>Height (mm)</span>
              <input
                type="number"
                min="1000"
                max="3200"
                value={config.rackHeightMm}
                onChange={(event) =>
                  updateConfig("rackHeightMm", event.target.value)
                }
              />
            </label>
            <label>
              <span>Rack gap (mm)</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={config.rackGapMm}
                onChange={(event) =>
                  updateConfig("rackGapMm", event.target.value)
                }
              />
            </label>
            <label>
              <span>Aisle pitch (mm)</span>
              <input
                type="number"
                min="1400"
                max="8000"
                value={config.aislePitchMm}
                onChange={(event) =>
                  updateConfig("aislePitchMm", event.target.value)
                }
              />
            </label>
            <label className="rack-config-wide">
              <span>Technology platform</span>
              <input
                value={config.platform}
                onChange={(event) =>
                  updateConfig("platform", event.target.value)
                }
                placeholder="Use Site Analysis platform when blank"
              />
            </label>
            <label className="rack-config-wide">
              <span>Cooling architecture</span>
              <input
                value={config.coolingArchitecture}
                onChange={(event) =>
                  updateConfig("coolingArchitecture", event.target.value)
                }
                placeholder="Use Site Analysis cooling architecture when blank"
              />
            </label>
          </div>
          <section className="rack-population-editor">
            <header>
              <div>
                <h4>Rack population</h4>
                <p>
                  These components are placed into every generated rack. Their
                  U-space must fit the selected rack height.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPopulation((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      name: "New rack component",
                      equipmentType: "other",
                      countPerRack: "1",
                      unitHeight: "1",
                      powerKw: "",
                      vendor: "",
                      modelReference: "",
                    },
                  ])
                }
              >
                <Plus size={15} /> Add component
              </button>
            </header>
            {population.map((item) => (
              <div className="rack-population-row" key={item.id}>
                <input
                  aria-label="Component name"
                  value={item.name}
                  onChange={(event) =>
                    setPopulation((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, name: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <select
                  aria-label="Equipment type"
                  value={item.equipmentType}
                  onChange={(event) =>
                    setPopulation((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              equipmentType: event.target
                                .value as PopulationItem["equipmentType"],
                            }
                          : entry,
                      ),
                    )
                  }
                >
                  {[
                    "nodes",
                    "network",
                    "storage",
                    "power",
                    "cooling",
                    "other",
                  ].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                <label>
                  <span>Qty/rack</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={item.countPerRack}
                    onChange={(event) =>
                      setPopulation((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, countPerRack: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <span>Height U</span>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={item.unitHeight}
                    onChange={(event) =>
                      setPopulation((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, unitHeight: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <span>Power kW</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="0.1"
                    value={item.powerKw}
                    onChange={(event) =>
                      setPopulation((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, powerKw: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <input
                  aria-label="Vendor"
                  placeholder="Vendor"
                  value={item.vendor}
                  onChange={(event) =>
                    setPopulation((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, vendor: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Model reference"
                  placeholder="Model / reference"
                  value={item.modelReference}
                  onChange={(event) =>
                    setPopulation((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, modelReference: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="rack-icon-button"
                  onClick={() =>
                    setPopulation((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </section>
          <section className="rack-population-editor rack-gpu-editor">
            <header>
              <div>
                <h4>GPU clusters and fabric</h4>
                <p>
                  Define one or more accelerator families. Each cluster is
                  allocated to its own rack range and receives persisted node
                  ports, redundant rack fabrics, and inter-rack links.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setGpuClusters((current) => [...current, defaultGpuCluster()])
                }
              >
                <Plus size={15} /> Add GPU cluster
              </button>
            </header>
            {gpuClusters.map((cluster, clusterIndex) => (
              <article
                className="rack-gpu-cluster"
                key={cluster.id}
                style={{ "--cluster-color": cluster.color } as CSSProperties}
              >
                <header>
                  <div>
                    <span>Cluster {clusterIndex + 1}</span>
                    <strong>{cluster.name || "Unnamed GPU cluster"}</strong>
                  </div>
                  <button
                    type="button"
                    className="rack-icon-button"
                    onClick={() =>
                      setGpuClusters((current) =>
                        current.filter((item) => item.id !== cluster.id),
                      )
                    }
                    aria-label={`Remove ${cluster.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </header>
                <div className="rack-gpu-grid">
                  {(
                    [
                      ["name", "Cluster name"],
                      ["workload", "Workload"],
                      ["rackCount", "Rack count"],
                      ["vendor", "GPU vendor"],
                      ["model", "GPU model"],
                      ["architecture", "Architecture"],
                      ["nodesPerRack", "Nodes / rack"],
                      ["gpusPerNode", "GPUs / node"],
                      ["nodeUnitHeight", "Node height (U)"],
                      ["nodePowerKw", "Node power (kW)"],
                      ["nodeHeatKw", "Node heat (kW)"],
                      ["coolingClass", "Cooling class"],
                      ["fabricType", "Fabric"],
                      ["fabricPortsPerNode", "Fabric ports / node"],
                      ["portSpeedGbps", "Port speed (Gbps)"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input
                        type={
                          [
                            "rackCount",
                            "nodesPerRack",
                            "gpusPerNode",
                            "nodeUnitHeight",
                            "nodePowerKw",
                            "nodeHeatKw",
                            "fabricPortsPerNode",
                            "portSpeedGbps",
                          ].includes(field)
                            ? "number"
                            : "text"
                        }
                        min="1"
                        value={cluster[field]}
                        onChange={(event) =>
                          setGpuClusters((current) =>
                            current.map((item) =>
                              item.id === cluster.id
                                ? { ...item, [field]: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    <span>Fabric topology</span>
                    <select
                      value={cluster.topology}
                      onChange={(event) =>
                        setGpuClusters((current) =>
                          current.map((item) =>
                            item.id === cluster.id
                              ? {
                                  ...item,
                                  topology: event.target
                                    .value as GpuClusterDraft["topology"],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="leaf_spine">Leaf-spine</option>
                      <option value="rail_optimized">Rail-optimized</option>
                      <option value="ring">Ring</option>
                    </select>
                  </label>
                  <label>
                    <span>Cluster color</span>
                    <input
                      type="color"
                      value={cluster.color}
                      onChange={(event) =>
                        setGpuClusters((current) =>
                          current.map((item) =>
                            item.id === cluster.id
                              ? { ...item, color: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>
          <footer>
            <p>
              <ShieldCheck size={15} /> Custom values stay marked as planning
              overrides until this revision is reviewed and approved.
            </p>
            <div>
              <button
                type="button"
                className="button"
                onClick={() => setConfigOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => generate(true)}
                disabled={!!busy}
              >
                {busy === "generate" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Box size={17} />
                )}{" "}
                Create custom revision
              </button>
            </div>
          </footer>
        </section>
      )}
      {importOpen && (
        <section
          className="rack-config-panel rack-import-panel"
          aria-label="Import custom model"
        >
          <header>
            <div>
              <p className="eyebrow">Stored project geometry</p>
              <h3>Import GLB or OBJ</h3>
              <p>
                The original file is hash-verified, stored in project object
                storage, rendered here, and retained as a versioned revision.
                Imported geometry is not treated as an approved asset register
                until mapped.
              </p>
            </div>
            <button
              type="button"
              className="rack-config-close"
              onClick={() => setImportOpen(false)}
              aria-label="Close import"
            >
              <X size={18} />
            </button>
          </header>
          <div className="rack-config-grid">
            <label className="rack-config-wide">
              <span>Model name</span>
              <input
                value={importName}
                onChange={(event) => setImportName(event.target.value)}
                placeholder="Defaults to the uploaded filename"
              />
            </label>
            <label className="rack-config-wide">
              <span>Model file (GLB or self-contained OBJ, max 75 MB)</span>
              <input
                type="file"
                accept=".glb,.obj,model/gltf-binary,model/obj"
                onChange={(event) =>
                  setImportFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
          </div>
          <footer>
            <p>
              <ShieldCheck size={15} /> Source file and hash remain attached to
              the revision audit trail.
            </p>
            <div>
              <button
                type="button"
                className="button"
                onClick={() => setImportOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={importModel}
                disabled={!!busy || !importFile}
              >
                {busy === "import" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <FileUp size={17} />
                )}{" "}
                Store and render
              </button>
            </div>
          </footer>
        </section>
      )}
      {!bundle ? (
        <div className="rack-model-empty">
          <Box size={38} />
          <h3>No rack model yet</h3>
          <p>
            Save rack count, target IT load, or typical rack load in Site
            Analysis, then generate the first controlled planning revision.
          </p>
          <div className="rack-model-actions">
            <button
              className="button"
              type="button"
              onClick={() => generate(false)}
              disabled={!!busy}
            >
              Generate from Site Analysis
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setConfigOpen(true)}
              disabled={!!busy}
            >
              <SlidersHorizontal size={17} /> Create &amp; customize
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rack-model-meta">
            <label>
              Revision
              <select
                value={bundle.model.id}
                onChange={(event) => selectModel(event.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    R{model.revision} · {model.status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <span className={`status-badge status-${bundle.model.status}`}>
              <ShieldCheck size={14} />
              {bundle.model.status.replaceAll("_", " ")}
            </span>
            <span>
              <Rows3 size={15} />
              {bundle.racks.length} racks
            </span>
            <span>
              <Layers3 size={15} />
              {bundle.equipment.length} modeled items
            </span>
            {!!bundle.clusters.length && (
              <span>
                <Network size={15} /> {bundle.clusters.length} GPU cluster
                {bundle.clusters.length === 1 ? "" : "s"} ·{" "}
                {bundle.links.length} links
              </span>
            )}
            <button
              type="button"
              className="rack-wiring-toggle"
              onClick={() => setShowWiring((value) => !value)}
              disabled={!bundle.links.length}
            >
              <Network size={15} /> {showWiring ? "Hide wiring" : "Show wiring"}
            </button>
            <div className="rack-review-actions">
              {(bundle.model.status === "generated" ||
                bundle.model.status === "rejected") && (
                <button
                  type="button"
                  onClick={() => changeStatus("under_review")}
                >
                  Send to review
                </button>
              )}
              {bundle.model.status === "generated" && (
                <button type="button" onClick={() => changeStatus("rejected")}>
                  Reject revision
                </button>
              )}
              {bundle.model.status === "under_review" && (
                <>
                  <button
                    type="button"
                    onClick={() => changeStatus("rejected")}
                  >
                    Reject revision
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatus("approved")}
                  >
                    <CheckCircle2 size={15} /> Approve planning model
                  </button>
                </>
              )}
              {bundle.model.status === "approved" && (
                <button
                  type="button"
                  onClick={() => changeStatus("superseded")}
                >
                  Mark superseded
                </button>
              )}
            </div>
          </div>
          <div className="rack-model-layout">
            <aside className="rack-object-tree">
              <div className="rack-panel-title">
                <div>
                  <span className="rack-panel-kicker">Navigation</span>
                  <h3>Rack hall</h3>
                </div>
                <span>
                  {bundle.model.sourceType === "imported"
                    ? "Imported"
                    : `${bundle.racks.length - hidden.size} visible`}
                </span>
              </div>
              {bundle.model.sourceType !== "imported" && ["generated", "rejected"].includes(bundle.model.status) && <>
                <button type="button" className="button button-secondary" onClick={() => setRackOpen((value) => !value)}><Plus size={14} /> Add custom rack</button>
                {rackOpen && <div className="rack-equipment-form">
                  <h4>Create a persisted rack</h4>
                  <input placeholder="Rack name, e.g. A-21" value={rackDraft.name} onChange={(event) => setRackDraft({ ...rackDraft, name: event.target.value })} />
                  <div><input placeholder="Row" value={rackDraft.rowLabel} onChange={(event) => setRackDraft({ ...rackDraft, rowLabel: event.target.value })} /><input type="number" min="12" max="60" placeholder="Rack units" value={rackDraft.totalUnits} onChange={(event) => setRackDraft({ ...rackDraft, totalUnits: event.target.value })} /></div>
                  <input type="number" min="0.1" step="0.1" placeholder="Maximum rack power (kW)" value={rackDraft.maxPowerKw} onChange={(event) => setRackDraft({ ...rackDraft, maxPowerKw: event.target.value })} />
                  <div><input type="number" placeholder="Width mm" value={rackDraft.widthMm} onChange={(event) => setRackDraft({ ...rackDraft, widthMm: event.target.value })} /><input type="number" placeholder="Depth mm" value={rackDraft.depthMm} onChange={(event) => setRackDraft({ ...rackDraft, depthMm: event.target.value })} /></div>
                  <input type="number" placeholder="Height mm" value={rackDraft.heightMm} onChange={(event) => setRackDraft({ ...rackDraft, heightMm: event.target.value })} />
                  <button type="button" onClick={addRack} disabled={!!busy || !rackDraft.name.trim() || !rackDraft.rowLabel.trim()}><Plus size={14} /> Create and save rack</button>
                </div>}
              </>}
              {bundle.model.sourceType !== "imported" && (
                <div className="rack-tree-tools">
                  <label className="rack-tree-search">
                    <Search size={14} />
                    <input
                      value={rackQuery}
                      onChange={(event) => setRackQuery(event.target.value)}
                      placeholder="Find rack, row or kW"
                      aria-label="Search racks"
                    />
                    {rackQuery && (
                      <button
                        type="button"
                        onClick={() => setRackQuery("")}
                        aria-label="Clear rack search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="rack-tree-tool-actions">
                    <button type="button" onClick={() => setHidden(new Set())}>
                      Show all
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedRows(new Set())}
                    >
                      Collapse rows
                    </button>
                  </div>
                </div>
              )}
              {bundle.model.sourceType === "imported" ? (
                <article className="rack-imported-tree">
                  <FileUp size={17} />
                  <div>
                    <b>{bundle.model.originalFileName}</b>
                    <span>
                      {bundle.model.sourceFormat?.toUpperCase()} source model
                    </span>
                  </div>
                </article>
              ) : (
                rows.map((row) => {
                  const rowRacks = matchingRacks.filter(
                    (rack) => rack.rowLabel === row,
                  );
                  if (!rowRacks.length) return null;
                  const isExpanded = rackQuery.trim()
                    ? true
                    : expandedRows.has(row);
                  const rowRackIds = bundle.racks
                    .filter((rack) => rack.rowLabel === row)
                    .map((rack) => rack.id);
                  const rowVisible = rowRackIds.filter(
                    (id) => !hidden.has(id),
                  ).length;
                  return (
                    <section key={row}>
                      <div className="rack-row-header">
                        <button
                          className="rack-row-toggle"
                          type="button"
                          onClick={() => toggleRowExpanded(row)}
                          aria-expanded={isExpanded}
                        >
                          <span
                            className={`rack-row-chevron ${isExpanded ? "is-open" : ""}`}
                          >
                            ›
                          </span>
                          <Rows3 size={15} />
                          <span className="rack-row-name">Row {row}</span>
                          <span className="rack-row-count">
                            {rowVisible}/{rowRackIds.length}
                          </span>
                        </button>
                        <button
                          className="rack-row-visibility"
                          type="button"
                          onClick={() => toggleRow(row)}
                          aria-label={`Toggle visibility for row ${row}`}
                        >
                          {rowVisible ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                        </button>
                      </div>
                      {isExpanded &&
                        rowRacks.map((rack) => {
                          const rackIndex = bundle.racks.findIndex(
                            (item) => item.id === rack.id,
                          );
                          const suggestion = suggestedRackProfile(
                            Math.max(0, rackIndex),
                          );
                          const implemented = isImplementedRack(rack.tags);
                          const displayName =
                            rackTagValue(rack.tags, "displayName") ||
                            suggestion.name;
                          return (
                          <button
                            className={`rack-tree-item ${selectedRack === rack.id ? "is-selected" : ""}`}
                            type="button"
                            key={rack.id}
                            onClick={() => setSelectedRack(rack.id)}
                          >
                            <span>
                              <b>{rack.name}</b>
                              <em>{displayName}</em>
                              <small>
                                {implemented ? "Implemented" : "Suggested"} ·{" "}
                                {rack.maxPowerKw
                                  ? `${rack.maxPowerKw} kW`
                                  : `${suggestion.maxPowerKw} kW basis`}
                              </small>
                            </span>
                            <i
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleRack(rack.id);
                              }}
                            >
                              {hidden.has(rack.id) ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </i>
                          </button>
                          );
                        })}
                    </section>
                  );
                })
              )}
            </aside>
            <RackViewer
              bundle={bundle}
              hidden={hidden}
              selectedRack={selectedRack}
              onSelectRack={setSelectedRack}
              showWiring={showWiring}
            />
            <aside className="rack-detail-panel">
              <div className="rack-panel-title">
                <div>
                  <span className="rack-panel-kicker">Inspector</span>
                  <h3>
                    {selected?.name ??
                      (bundle.model.sourceType === "imported"
                        ? "Imported model"
                        : "Model basis")}
                  </h3>
                </div>
                {selected &&
                  ["generated", "rejected"].includes(bundle.model.status) && (
                    <button
                      type="button"
                      className="rack-icon-button"
                      onClick={() => setEquipmentOpen((value) => !value)}
                      aria-label="Add rack equipment"
                    >
                      <Plus size={15} />
                    </button>
                  )}
              </div>
              {selected ? (
                <>
                  <div className="rack-selection-status">
                    <span />
                    {isImplementedRack(selected.tags)
                      ? "Implemented configuration"
                      : "Suggested configuration — not yet implemented"}
                  </div>
                  <section className="rack-suggestion-card">
                    <header>
                      <span>Suggested rack</span>
                      <b>{selectedSuggestion.name}</b>
                    </header>
                    <p>{selectedSuggestion.description}</p>
                    <dl>
                      <div>
                        <dt>Role</dt>
                        <dd>{selectedSuggestion.role}</dd>
                      </div>
                      <div>
                        <dt>Envelope</dt>
                        <dd>
                          {selectedSuggestion.totalUnits}U ·{" "}
                          {selectedSuggestion.maxPowerKw} kW
                        </dd>
                      </div>
                      <div>
                        <dt>Cooling</dt>
                        <dd>{selectedSuggestion.cooling}</dd>
                      </div>
                    </dl>
                    {["generated", "rejected"].includes(
                      bundle.model.status,
                    ) && (
                      <button
                        type="button"
                        onClick={applyRackSuggestion}
                        disabled={!!busy}
                      >
                        <CheckCircle2 size={14} /> Apply this suggestion
                      </button>
                    )}
                  </section>
                  <dl className="rack-metric-grid">
                    <div>
                      <dt>Row / position</dt>
                      <dd>
                        {selected.rowLabel} / {selected.positionIndex + 1}
                      </dd>
                    </div>
                    <div>
                      <dt>Envelope</dt>
                      <dd>
                        {selected.widthMm} × {selected.depthMm} ×{" "}
                        {selected.heightMm} mm
                      </dd>
                    </div>
                    <div>
                      <dt>Rack units</dt>
                      <dd>{selected.totalUnits}U</dd>
                    </div>
                    <div>
                      <dt>Power basis</dt>
                      <dd>
                        {selected.maxPowerKw
                          ? `${selected.maxPowerKw} kW`
                          : "Unresolved"}
                      </dd>
                    </div>
                  </dl>
                  {implementationDraft && (
                    <section className="rack-implementation-editor">
                      <header>
                        <div>
                          <span>Implemented rack</span>
                          <h4>Edit this rack only</h4>
                        </div>
                        <span className="rack-implementation-code">
                          {selected.name}
                        </span>
                      </header>
                      <fieldset
                        disabled={
                          !!busy ||
                          !["generated", "rejected"].includes(
                            bundle.model.status,
                          )
                        }
                      >
                        <label>
                          <span>Rack ID / name</span>
                          <input
                            value={implementationDraft.name}
                            onChange={(event) =>
                              setImplementationDraft({
                                ...implementationDraft,
                                name: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Rack profile</span>
                          <select
                            value={implementationDraft.profileKey}
                            onChange={(event) =>
                              chooseImplementationProfile(event.target.value)
                            }
                          >
                            {suggestedRackProfiles.map((profile) => (
                              <option key={profile.key} value={profile.key}>
                                {profile.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Implemented display name</span>
                          <input
                            value={implementationDraft.displayName}
                            onChange={(event) =>
                              setImplementationDraft({
                                ...implementationDraft,
                                displayName: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Operational role</span>
                          <input
                            value={implementationDraft.role}
                            onChange={(event) =>
                              setImplementationDraft({
                                ...implementationDraft,
                                role: event.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="rack-implementation-row">
                          <label>
                            <span>Rack units</span>
                            <input
                              type="number"
                              min="12"
                              max="60"
                              value={implementationDraft.totalUnits}
                              onChange={(event) =>
                                setImplementationDraft({
                                  ...implementationDraft,
                                  totalUnits: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            <span>Power kW</span>
                            <input
                              type="number"
                              min="0.1"
                              max="500"
                              step="0.1"
                              value={implementationDraft.maxPowerKw}
                              onChange={(event) =>
                                setImplementationDraft({
                                  ...implementationDraft,
                                  maxPowerKw: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="rack-implementation-row rack-implementation-dimensions">
                          {(
                            [
                              ["widthMm", "Width mm"],
                              ["depthMm", "Depth mm"],
                              ["heightMm", "Height mm"],
                            ] as const
                          ).map(([field, label]) => (
                            <label key={field}>
                              <span>{label}</span>
                              <input
                                type="number"
                                value={implementationDraft[field]}
                                onChange={(event) =>
                                  setImplementationDraft({
                                    ...implementationDraft,
                                    [field]: event.target.value,
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                        <label>
                          <span>Enclosure</span>
                          <select
                            value={implementationDraft.enclosure}
                            onChange={(event) =>
                              setImplementationDraft({
                                ...implementationDraft,
                                enclosure: event.target.value,
                              })
                            }
                          >
                            <option>Closed cabinet</option>
                            <option>Open frame</option>
                          </select>
                        </label>
                        {(
                          [
                            ["powerFeed", "Power and PDU arrangement"],
                            ["cooling", "Cooling architecture"],
                            ["cableManagement", "Cable management"],
                            ["security", "Physical security"],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field}>
                            <span>{label}</span>
                            <input
                              value={implementationDraft[field]}
                              onChange={(event) =>
                                setImplementationDraft({
                                  ...implementationDraft,
                                  [field]: event.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                      </fieldset>
                      {["generated", "rejected"].includes(
                        bundle.model.status,
                      ) ? (
                        <button
                          type="button"
                          onClick={() => saveRackImplementation()}
                          disabled={
                            !!busy ||
                            !implementationDraft.name.trim() ||
                            !implementationDraft.displayName.trim()
                          }
                        >
                          {busy === "rack-update" ? (
                            <LoaderCircle className="spin" size={14} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Save implemented rack
                        </button>
                      ) : (
                        <p className="rack-editor-locked">
                          Return this revision to draft to edit its implemented
                          rack specification.
                        </p>
                      )}
                    </section>
                  )}
                  {equipmentOpen && (
                    <div className="rack-equipment-form">
                      <h4>Add rack-mounted component</h4>
                      <input
                        placeholder="Component name"
                        value={equipmentDraft.name}
                        onChange={(event) =>
                          setEquipmentDraft({
                            ...equipmentDraft,
                            name: event.target.value,
                          })
                        }
                      />
                      <select
                        value={equipmentDraft.equipmentType}
                        onChange={(event) =>
                          setEquipmentDraft({
                            ...equipmentDraft,
                            equipmentType: event.target
                              .value as EquipmentDraft["equipmentType"],
                          })
                        }
                      >
                        {[
                          "nodes",
                          "network",
                          "storage",
                          "power",
                          "cooling",
                          "other",
                        ].map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                      <div>
                        <input
                          type="number"
                          min="1"
                          max={selected.totalUnits}
                          aria-label="Start unit"
                          placeholder="Start U"
                          value={equipmentDraft.startUnit}
                          onChange={(event) =>
                            setEquipmentDraft({
                              ...equipmentDraft,
                              startUnit: event.target.value,
                            })
                          }
                        />
                        <input
                          type="number"
                          min="1"
                          max={selected.totalUnits}
                          aria-label="Unit height"
                          placeholder="Height U"
                          value={equipmentDraft.unitHeight}
                          onChange={(event) =>
                            setEquipmentDraft({
                              ...equipmentDraft,
                              unitHeight: event.target.value,
                            })
                          }
                        />
                      </div>
                      <input
                        placeholder="Vendor"
                        value={equipmentDraft.vendor}
                        onChange={(event) =>
                          setEquipmentDraft({
                            ...equipmentDraft,
                            vendor: event.target.value,
                          })
                        }
                      />
                      <input
                        placeholder="Model / reference"
                        value={equipmentDraft.modelReference}
                        onChange={(event) =>
                          setEquipmentDraft({
                            ...equipmentDraft,
                            modelReference: event.target.value,
                          })
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Power kW"
                        value={equipmentDraft.powerKw}
                        onChange={(event) =>
                          setEquipmentDraft({
                            ...equipmentDraft,
                            powerKw: event.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={addEquipment}
                        disabled={!!busy || !equipmentDraft.name.trim()}
                      >
                        <Plus size={14} /> Add to {selected.name}
                      </button>
                    </div>
                  )}
                  <h4>Installed / planned items</h4>
                  {selectedEquipment.map((item) => {
                    const profile = bundle.gpuProfiles.find(
                      (candidate) => candidate.id === item.gpuProfileId,
                    );
                    const cluster = bundle.clusters.find(
                      (candidate) => candidate.id === item.clusterId,
                    );
                    return (
                      <article
                        key={item.id}
                        style={
                          cluster
                            ? ({
                                "--rack-cluster-color": cluster.color,
                              } as CSSProperties)
                            : undefined
                        }
                        className={profile ? "rack-equipment-gpu" : undefined}
                      >
                        <b>{item.name}</b>
                        <span>
                          U{item.startUnit}–
                          {item.startUnit + item.unitHeight - 1} ·{" "}
                          {item.equipmentType}
                        </span>
                        {profile && (
                          <small className="rack-equipment-profile">
                            {profile.vendor} {profile.model} ·{" "}
                            {item.acceleratorCount} GPU
                            {item.acceleratorCount === 1 ? "" : "s"} ·{" "}
                            {profile.fabricPortsPerNode} ×{" "}
                            {profile.portSpeedGbps} Gb/s {profile.fabricType}
                            {cluster ? ` · ${cluster.name}` : ""}
                          </small>
                        )}
                        <small>
                          {item.sourceAssetId
                            ? "Controlled asset"
                            : record(item.provenance).kind ===
                                "manual_rack_authoring"
                              ? "Manual rack specification"
                              : "Project planning profile"}
                        </small>
                        {["generated", "rejected"].includes(
                          bundle.model.status,
                        ) && (
                          <button
                            type="button"
                            className="rack-equipment-remove"
                            onClick={() => removeEquipment(item.id)}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </article>
                    );
                  })}
                </>
              ) : (
                <>
                  <p>
                    {bundle.model.sourceType === "imported"
                      ? "This original model is stored and rendered as project geometry. Map its objects to controlled racks/assets before using it as an authoritative RackDB equipment register."
                      : "Select a rack in the model or tree to inspect and edit its equipment population."}
                  </p>
                  <dl>
                    <div>
                      <dt>Source hash</dt>
                      <dd className="mono">
                        {bundle.model.sourceHash.slice(0, 16)}…
                      </dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>
                        {bundle.model.sourceType === "imported"
                          ? `${bundle.model.sourceFormat?.toUpperCase()} import`
                          : `RackDB ${bundle.model.rackdbVersion}`}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </aside>
          </div>
          <section className="rack-export-panel">
            <div>
              <p className="eyebrow">Controlled deliverables</p>
              <h3>Export this exact revision</h3>
              <p>
                {bundle.model.sourceType === "imported"
                  ? "The original hash-verified geometry is downloadable unchanged. RackDB export becomes available after canonical rack mapping."
                  : "Every export is stored with its hash and recorded in the project audit chain."}
              </p>
            </div>
            <div className="rack-export-actions">
              {bundle.model.sourceType === "generated" ? (
                <>
                  <button
                    type="button"
                    onClick={() => exportModel("rackdb_yaml")}
                    disabled={!!busy}
                  >
                    <Download size={16} /> RackDB YAML
                  </button>
                  <button
                    type="button"
                    onClick={() => exportModel("glb")}
                    disabled={!!busy}
                  >
                    GLB
                  </button>
                  <button
                    type="button"
                    onClick={() => exportModel("obj")}
                    disabled={!!busy}
                  >
                    OBJ
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    exportModel(
                      bundle.model.sourceFormat === "obj" ? "obj" : "glb",
                    )
                  }
                  disabled={!!busy}
                >
                  <Download size={16} /> Original{" "}
                  {bundle.model.sourceFormat?.toUpperCase()}
                </button>
              )}
              <button
                type="button"
                onClick={() => exportModel("pdf")}
                disabled={!!busy}
              >
                Engineering PDF
              </button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
