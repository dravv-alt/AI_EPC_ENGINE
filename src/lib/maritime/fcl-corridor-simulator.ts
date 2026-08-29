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

export interface Comprehensive6PhaseDelayDecomposition {
  totalPredictedDelayHours: number;
  totalPredictedDelayDays: number;
  oceanWeatherDelayHours: number;
  phaseDelays: {
    phaseNumber: number;
    phaseName: string;
    phaseCode: string;
    actor: string;
    baselineDurationHours: number;
    delayHours: number;
    delayDays: number;
    delayPercentOfTotal: number;
    primaryDrivers: string[];
  }[];
  oceanHydrodynamicDelayHours: number;
  inlandLogisticsDelayHours: number;
  customsRegulatoryDelayHours: number;
  portTerminalDelayHours: number;
}

/**
 * Synthesizes the complete 6-phase end-to-end delay across procurement,
 * inland rail, origin CY port cut-off, blue-water ocean voyage (Kwon physics + ML),
 * destination US CBP clearance, and last-mile site drayage.
 */
export function decomposeComprehensive6PhaseDelay(params: {
  oceanWeatherDelayHours: number;
  isMonsoon?: boolean;
  isHurricane?: boolean;
  isDiwali?: boolean;
  missedCyCutOff?: boolean;
  cbpPhysicalExam?: boolean;
  isLcl?: boolean;
  portCongestion?: boolean;
}): Comprehensive6PhaseDelayDecomposition {
  const oceanWeatherDelay = Math.max(0, params.oceanWeatherDelayHours || 0);

  // Phase 1: Procurement, VGM & Booking (Baseline: 72h / 3d)
  let p1Delay = 0;
  const p1Drivers: string[] = [];
  if (params.isDiwali) {
    p1Delay += 48; // +2d
    p1Drivers.push("Diwali Factory Driver Shortage (+48.0h)");
  }
  if (params.isLcl) {
    p1Delay += 96; // +4d
    p1Drivers.push("LCL Consolidation Warehouse Dwell (+96.0h)");
  }

  // Phase 2: Inland Rail Haulage & ICEGATE Customs (Baseline: 168h / 7d)
  let p2Delay = 0;
  const p2Drivers: string[] = [];
  if (params.isMonsoon) {
    p2Delay += 72; // +3d
    p2Drivers.push("Monsoon Waterlogging on Rail Corridor (+72.0h)");
  }
  if (params.isDiwali) {
    p2Delay += 72; // +3d
    p2Drivers.push("Diwali Inland Drayage Fleet Shortage (+72.0h)");
  }

  // Phase 3: Origin Port Operations & CY Cut-off (Baseline: 96h / 4d)
  let p3Delay = 0;
  const p3Drivers: string[] = [];
  if (params.missedCyCutOff) {
    p3Delay += 168; // +7d
    p3Drivers.push("Missed 48h CY Cut-off: Weekly Vessel Rollover (+168.0h)");
  }
  if (params.portCongestion) {
    p3Delay += 24; // +1d
    p3Drivers.push("Origin Berth Congestion & Crane Queuing (+24.0h)");
  }

  // Phase 4: Blue-Water Ocean Voyage (Baseline: 576h / 24d)
  let p4Delay = oceanWeatherDelay;
  const p4Drivers: string[] = [];
  if (oceanWeatherDelay > 0) {
    p4Drivers.push(`Kwon (2008) Hydrodynamic & Weather Speed Loss (+${oceanWeatherDelay.toFixed(1)}h)`);
  }
  if (params.isHurricane) {
    p4Delay += 72; // +3d
    p4Drivers.push("Atlantic Hurricane Route Deviation (+72.0h)");
  }

  // Phase 5: Destination Port & US CBP Clearance (Baseline: 96h / 4d)
  let p5Delay = 0;
  const p5Drivers: string[] = [];
  if (params.cbpPhysicalExam) {
    p5Delay += 120; // +5d
    p5Drivers.push("CBP Intensive Physical Inspection Hold & Demurrage (+120.0h)");
  }
  if (params.isHurricane) {
    p5Delay += 24; // +1d
    p5Drivers.push("Florida Port Closure & Berth Delay (+24.0h)");
  }
  if (params.isLcl) {
    p5Delay += 144; // +6d
    p5Drivers.push("Destination CFS De-consolidation & Bonded Release (+144.0h)");
  }

  // Phase 6: Last-Mile Florida Drayage & De-Stuffing (Baseline: 72h / 3d)
  let p6Delay = 0;
  const p6Drivers: string[] = [];

  const totalDelayHours = Number((p1Delay + p2Delay + p3Delay + p4Delay + p5Delay + p6Delay).toFixed(1));
  const totalDelayDays = Number((totalDelayHours / 24).toFixed(1));

  const phaseList = [
    {
      phaseNumber: 1,
      phaseName: "Phase 1: Procurement, VGM & Booking",
      phaseCode: "procurement",
      actor: "EPC Logistics / Forwarder",
      baselineDurationHours: 72,
      delayHours: Number(p1Delay.toFixed(1)),
      delayDays: Number((p1Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p1Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p1Drivers.length ? p1Drivers : ["Standard export packing & VGM clearance on schedule"],
    },
    {
      phaseNumber: 2,
      phaseName: "Phase 2: Inland Rail Haulage & ICEGATE Customs",
      phaseCode: "inland_export",
      actor: "Customs Broker (CHA) / Rail Carrier",
      baselineDurationHours: 168,
      delayHours: Number(p2Delay.toFixed(1)),
      delayDays: Number((p2Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p2Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p2Drivers.length ? p2Drivers : ["711km rail corridor operating on schedule"],
    },
    {
      phaseNumber: 3,
      phaseName: "Phase 3: Origin Port Operations & CY Cut-off",
      phaseCode: "origin_port",
      actor: "JNPT Port Terminal Operator",
      baselineDurationHours: 96,
      delayHours: Number(p3Delay.toFixed(1)),
      delayDays: Number((p3Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p3Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p3Drivers.length ? p3Drivers : ["48h strict CY Cut-off met without rollover"],
    },
    {
      phaseNumber: 4,
      phaseName: "Phase 4: Blue-Water Ocean Voyage (~9,317 nm)",
      phaseCode: "ocean_voyage",
      actor: "Ocean Shipping Line (Maersk / CMA CGM)",
      baselineDurationHours: 576,
      delayHours: Number(p4Delay.toFixed(1)),
      delayDays: Number((p4Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p4Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p4Drivers.length ? p4Drivers : ["Ocean passage operating at baseline 16–19 kts"],
    },
    {
      phaseNumber: 5,
      phaseName: "Phase 5: Destination Port & US CBP Clearance",
      phaseCode: "dest_customs",
      actor: "US Customs Broker / US CBP",
      baselineDurationHours: 96,
      delayHours: Number(p5Delay.toFixed(1)),
      delayDays: Number((p5Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p5Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p5Drivers.length ? p5Drivers : ["ISF-10 matched, VACIS non-intrusive scan cleared"],
    },
    {
      phaseNumber: 6,
      phaseName: "Phase 6: Last-Mile Florida Drayage & De-Stuffing",
      phaseCode: "last_mile",
      actor: "US Intermodal Drayage Carrier",
      baselineDurationHours: 72,
      delayHours: Number(p6Delay.toFixed(1)),
      delayDays: Number((p6Delay / 24).toFixed(1)),
      delayPercentOfTotal: totalDelayHours > 0 ? Number(((p6Delay / totalDelayHours) * 100).toFixed(1)) : 0,
      primaryDrivers: p6Drivers.length ? p6Drivers : ["Highway drayage to site on schedule"],
    },
  ];

  return {
    totalPredictedDelayHours: totalDelayHours,
    totalPredictedDelayDays: totalDelayDays,
    oceanWeatherDelayHours: oceanWeatherDelay,
    phaseDelays: phaseList,
    oceanHydrodynamicDelayHours: Number(p4Delay.toFixed(1)),
    inlandLogisticsDelayHours: Number((p1Delay + p2Delay + p6Delay).toFixed(1)),
    customsRegulatoryDelayHours: Number((p2Delay + p5Delay).toFixed(1)),
    portTerminalDelayHours: Number((p3Delay + p5Delay).toFixed(1)),
  };
}

