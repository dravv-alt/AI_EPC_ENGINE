/**
 * ============================================================================
 * FCL DATA CENTER EQUIPMENT FREIGHT ARCHITECTURE SIMULATOR
 * ============================================================================
 * End-to-end multimodal simulation engine for Full Container Load (FCL)
 * capital equipment moving from Hyderabad, India to Florida, USA.
 * 
 * Pipeline:
 * Phase 1: Procurement, VGM & Booking (2–3d)
 * Phase 2: Inland Rail Haulage & ICEGATE Export Customs (6–8d)
 * Phase 3: JNPT Origin Port Operations & CY Cut-off (3–5d)
 * Phase 4: Blue-Water Ocean Voyage (~9,317nm at 16–19 kts, 28–35d)
 * Phase 5: Destination Port US Customs (ISF-10 / CBP, 3–5d)
 * Phase 6: Last-Mile Florida Drayage & Empty Return (1–2d)
 * 
 * Baseline Target: 45 Days (Range: 43–58 Days)
 */

export interface FclSimulationConfig {
  shipmentId: string;
  name: string;
  equipmentType: "server_racks" | "chillers" | "ups_systems" | "heavy_transformers" | "switchgear";
  origin: { name: string; lat: number; lng: number }; // e.g. Hyderabad ICD
  destination: { name: string; lat: number; lng: number }; // e.g. Data Center Site, Florida
  departureDate: Date | string;
  isLcl?: boolean; // Less-than-Container Load (+10 to +14 days)
  isMonsoonSeason?: boolean; // Jun–Sep (+3 days to Phase 2 rail)
  isHurricaneSeason?: boolean; // Aug–Oct (+4 days to ocean & Florida port)
  isDiwaliPeriod?: boolean; // Oct–Nov (+5 days trucking shortage)
  missedCyCutOff?: boolean; // Missed 48h CY cutoff (+7 days vessel rollover)
  cbpPhysicalExam?: boolean; // Intensive CBP examination (+5 days demurrage)
  transshipmentHub?: "algeciras" | "tanger_med" | "direct";
}

export interface FclPhaseMilestone {
  phaseNumber: number;
  phaseCode: "procurement" | "inland_export" | "origin_port" | "ocean_voyage" | "dest_customs" | "last_mile";
  name: string;
  actor: string;
  baselineDays: number;
  simulatedDays: number;
  startDate: string;
  endDate: string;
  criticalPath: boolean;
  status: "completed" | "in_progress" | "pending" | "delayed";
  activeModifiers: string[];
  deliverables: string[];
  operationalNotes: string;
}

export interface FclSimulationResult {
  shipmentId: string;
  totalDistanceNm: number;
  baselineLeadTimeDays: number; // Standard 45 Days
  totalSimulatedDays: number; // Including all active conditional modifiers
  departureDate: string;
  plannedEta: string; // departureDate + baselineDays
  simulatedEta: string; // departureDate + totalSimulatedDays
  requiredOnSite: string; // simulatedEta + safety buffer
  phases: FclPhaseMilestone[];
  activeBottlenecks: string[];
  criticalPathAlerts: string[];
  floatMarginDays: number;
}

/**
 * Executes end-to-end FCL simulation with conditional delay rules.
 */
export function simulateFclPipeline(
  config: FclSimulationConfig,
  currentSimTime: Date | string = new Date()
): FclSimulationResult {
  const departureDate = new Date(config.departureDate);
  const simNow = new Date(currentSimTime).getTime();

  const isLcl = Boolean(config.isLcl);
  const isMonsoon = Boolean(config.isMonsoonSeason);
  const isHurricane = Boolean(config.isHurricaneSeason);
  const isDiwali = Boolean(config.isDiwaliPeriod);
  const missedCutOff = Boolean(config.missedCyCutOff);
  const cbpExam = Boolean(config.cbpPhysicalExam);

  const activeBottlenecks: string[] = [];
  const criticalPathAlerts: string[] = [];

  // Phase 1: Procurement, Packing & Booking (2–3d, baseline: 3d)
  let p1Days = 3;
  const p1Modifiers: string[] = [];
  if (isDiwali) {
    p1Days += 2;
    p1Modifiers.push("Diwali Driver Shortage (+2d)");
  }
  if (isLcl) {
    p1Days += 4;
    p1Modifiers.push("LCL CFS Consolidation Buffer (+4d)");
  }

  // Phase 2: Inland Haulage & ICEGATE Customs (6–8d, baseline: 7d)
  let p2Days = 7;
  const p2Modifiers: string[] = [];
  if (isMonsoon) {
    p2Days += 3;
    p2Modifiers.push("Indian Monsoon Rail Corridor Disruption (+3d)");
    activeBottlenecks.push("Monsoon waterlogging along Hyderabad-JNPT rail freight line");
  }
  if (isDiwali) {
    p2Days += 3;
    p2Modifiers.push("Diwali Factory Drayage Shortage (+3d)");
  }

  // Phase 3: Origin Port Terminal Operations (3–5d, baseline: 4d)
  let p3Days = 4;
  const p3Modifiers: string[] = [];
  if (missedCutOff) {
    p3Days += 7;
    p3Modifiers.push("Missed 48h CY Cut-Off: Weekly Vessel Rollover (+7d)");
    activeBottlenecks.push("Vessel Rollover: Container staged at JNPT waiting for next week's mainline call");
    criticalPathAlerts.push("CRITICAL: Missed 48h CY Cut-off triggered mandatory 7-day vessel rollover delay");
  }

  // Phase 4: Blue-Water Ocean Sailing (28–35d, baseline: 24d direct/transshipment)
  let p4Days = 24;
  const p4Modifiers: string[] = [];
  if (isHurricane) {
    p4Days += 3;
    p4Modifiers.push("Atlantic Hurricane Route Deviation (+3d)");
    activeBottlenecks.push("Atlantic hurricane storm avoidance routing added nautical miles");
  }
  if (config.transshipmentHub && config.transshipmentHub !== "direct") {
    p4Days += 2;
    p4Modifiers.push(`Transshipment Crane Swap at ${config.transshipmentHub === "algeciras" ? "Algeciras" : "Tanger Med"} (+2d)`);
  }

  // Phase 5: Destination Port & US Customs (3–5d, baseline: 4d)
  let p5Days = 4;
  const p5Modifiers: string[] = [];
  if (isHurricane) {
    p5Days += 1;
    p5Modifiers.push("Florida Port Berth Congestion (+1d)");
  }
  if (cbpExam) {
    p5Days += 5;
    p5Modifiers.push("CBP Intensive Physical Inspection & VACIS Hold (+5d)");
    activeBottlenecks.push("US CBP Intensive Exam Hold: Container routed to CES exam warehouse");
    criticalPathAlerts.push("CBP Intensive Physical Exam triggered +5 days port demurrage and customs hold");
  }
  if (isLcl) {
    p5Days += 6;
    p5Modifiers.push("Destination CFS De-consolidation (+6d)");
  }

  // Phase 6: Last-Mile Florida Drayage (1–2d, baseline: 3d site staging)
  let p6Days = 3;
  const p6Modifiers: string[] = [];

  const phasesDef = [
    {
      phaseNumber: 1,
      phaseCode: "procurement" as const,
      name: "Procurement, Packing & Booking",
      actor: "EPC Logistics / Freight Forwarder",
      baselineDays: 3,
      simulatedDays: p1Days,
      activeModifiers: p1Modifiers,
      deliverables: ["Verified Gross Mass (VGM)", "Commercial Invoice", "HS Code 8471 Classification", "Booking Confirmation"],
      operationalNotes: "Hardware crated in export packaging; VGM generated to prevent port weighbridge rejection.",
    },
    {
      phaseNumber: 2,
      phaseCode: "inland_export" as const,
      name: "Inland Rail Haulage & ICEGATE Customs",
      actor: "Customs Broker (CHA) / Indian Railways (CONCOR)",
      baselineDays: 7,
      simulatedDays: p2Days,
      activeModifiers: p2Modifiers,
      deliverables: ["40ft HC Bolt Seal", "ICEGATE Shipping Bill", "Let Export Order (LEO)", "711km Rail Waybill"],
      operationalNotes: "Container stuffed at Hyderabad ICD, cleared by customs officers, and railed to Nhava Sheva.",
    },
    {
      phaseNumber: 3,
      phaseCode: "origin_port" as const,
      name: "Origin Port Stacking & CY Cut-off",
      actor: "JNPT Terminal Operator",
      baselineDays: 4,
      simulatedDays: p3Days,
      activeModifiers: p3Modifiers,
      deliverables: ["Terminal Stacking Yard Gate-In", "48h CY Cut-off Gate Pass", "Gantry Crane Stowage Plan"],
      operationalNotes: "Straddle carriers position container by weight tier; loaded into cellular slot on mainline vessel.",
    },
    {
      phaseNumber: 4,
      phaseCode: "ocean_voyage" as const,
      name: "Blue-Water Maritime Sailing (9,317 nm)",
      actor: "Mainline Shipping Line (Maersk / CMA CGM)",
      baselineDays: 24,
      simulatedDays: p4Days,
      activeModifiers: p4Modifiers,
      deliverables: ["Master Bill of Lading (MBL)", "Suez Canal Convoy Clearance", "Gibraltar Passage", "Atlantic AIS Tracking"],
      operationalNotes: "Arabian Sea → Red Sea → Suez Canal → Mediterranean → Gibraltar → Atlantic Ocean → Florida.",
    },
    {
      phaseNumber: 5,
      phaseCode: "dest_customs" as const,
      name: "Destination Port & US CBP Clearance",
      actor: "US Customs Broker / US CBP",
      baselineDays: 4,
      simulatedDays: p5Days,
      activeModifiers: p5Modifiers,
      deliverables: ["ISF-10 Filing (Pre-departure)", "CBP Form 7501 Entry", "VACIS Non-Intrusive Scan", "Customs Release"],
      operationalNotes: "ISF-10 matched against carrier manifest; vessel docked and container transferred to terminal chassis.",
    },
    {
      phaseNumber: 6,
      phaseCode: "last_mile" as const,
      name: "Last-Mile Florida Drayage & De-Stuffing",
      actor: "US Intermodal Drayage Carrier",
      baselineDays: 3,
      simulatedDays: p6Days,
      activeModifiers: p6Modifiers,
      deliverables: ["Port Gate-Out Interchange", "Highway Heavy-Haul Transit", "Site Delivery & Seal Break", "Empty Return (3-5d grace)"],
      operationalNotes: "Highway transport to Florida data center site, technical uncrating, and container depot return.",
    },
  ];

  // Calculate timeline milestone dates sequentially
  let runningDateMs = departureDate.getTime();
  const phases: FclPhaseMilestone[] = [];

  for (const p of phasesDef) {
    const startMs = runningDateMs;
    const endMs = startMs + p.simulatedDays * 24 * 3600_000;
    runningDateMs = endMs;

    let status: FclPhaseMilestone["status"] = "pending";
    if (simNow >= endMs) {
      status = "completed";
    } else if (simNow >= startMs && simNow < endMs) {
      status = p.activeModifiers.length > 0 ? "delayed" : "in_progress";
    }

    phases.push({
      ...p,
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
      criticalPath: true,
      status,
    });
  }

  const baselineLeadTimeDays = 45; // Algorithmic core baseline
  const totalSimulatedDays = phases.reduce((acc, p) => acc + p.simulatedDays, 0);

  const plannedEta = new Date(departureDate.getTime() + baselineLeadTimeDays * 24 * 3600_000).toISOString();
  const simulatedEta = new Date(departureDate.getTime() + totalSimulatedDays * 24 * 3600_000).toISOString();
  const requiredOnSite = new Date(new Date(simulatedEta).getTime() + 3 * 24 * 3600_000).toISOString();

  const floatMarginDays = Number(((new Date(requiredOnSite).getTime() - new Date(simulatedEta).getTime()) / (24 * 3600_000)).toFixed(1));

  return {
    shipmentId: config.shipmentId,
    totalDistanceNm: 9317,
    baselineLeadTimeDays,
    totalSimulatedDays,
    departureDate: departureDate.toISOString(),
    plannedEta,
    simulatedEta,
    requiredOnSite,
    phases,
    activeBottlenecks,
    criticalPathAlerts,
    floatMarginDays,
  };
}
