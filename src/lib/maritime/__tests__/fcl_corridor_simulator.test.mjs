/**
 * ============================================================================
 * FCL CORRIDOR SIMULATOR & CONDITIONAL MODIFIERS TEST SUITE
 * ============================================================================
 * Tests the 6-phase freight architecture from Hyderabad to Florida:
 * Baseline lead time (45 days), Monsoon, Hurricane, Diwali, Cut-off, CBP exam.
 */

import { simulateFclPipeline } from "../fcl-corridor-simulator.ts";

function runTest(name, fn) {
  try {
    fn();
    console.log(`   ✅ ${name}`);
  } catch (err) {
    console.error(`   ❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

console.log("🚢 Starting FCL Freight Architecture & Simulation Engine Tests...\n");

console.log("🧪 1. Testing Baseline Algorithmic Target (45 Days)...");
runTest("Baseline standard FCL passage equals 45 days across 6 phases", () => {
  const result = simulateFclPipeline({
    shipmentId: "ship_hyderabad_florida_001",
    name: "Server Racks & Chiller Units FCL",
    equipmentType: "server_racks",
    origin: { name: "Sanathnagar ICD, Hyderabad", lat: 17.45, lng: 78.43 },
    destination: { name: "Miami Data Center, Florida", lat: 25.76, lng: -80.19 },
    departureDate: "2026-09-01T08:00:00.000Z",
  });

  assert(result.totalSimulatedDays === 45, `Expected baseline 45 days, got ${result.totalSimulatedDays}`);
  assert(result.phases.length === 6, `Expected 6 distinct phases, got ${result.phases.length}`);
  assert(result.totalDistanceNm === 9317, `Expected 9317 nm route distance, got ${result.totalDistanceNm}`);
  assert(result.phases[0].simulatedDays === 3, "Phase 1 procurement must be 3 days");
  assert(result.phases[1].simulatedDays === 7, "Phase 2 inland rail must be 7 days");
  assert(result.phases[2].simulatedDays === 4, "Phase 3 JNPT terminal must be 4 days");
  assert(result.phases[3].simulatedDays === 24, "Phase 4 ocean sailing must be 24 days");
  assert(result.phases[4].simulatedDays === 4, "Phase 5 US customs must be 4 days");
  assert(result.phases[5].simulatedDays === 3, "Phase 6 Florida drayage must be 3 days");
});

console.log("\n🧪 2. Testing Conditional Delay Rules & Seasonality Modifiers...");
runTest("Indian Monsoon adds +3 days to Phase 2 rail corridor", () => {
  const result = simulateFclPipeline({
    shipmentId: "monsoon_test",
    name: "Monsoon Chiller Transit",
    equipmentType: "chillers",
    origin: { name: "Hyderabad ICD", lat: 17.45, lng: 78.43 },
    destination: { name: "Florida Site", lat: 25.76, lng: -80.19 },
    departureDate: "2026-07-15T00:00:00.000Z",
    isMonsoonSeason: true,
  });

  assert(result.phases[1].simulatedDays === 10, `Expected Phase 2 to be 7+3=10 days, got ${result.phases[1].simulatedDays}`);
  assert(result.totalSimulatedDays === 48, `Expected total 48 days, got ${result.totalSimulatedDays}`);
  assert(result.activeBottlenecks.some(b => b.includes("Monsoon")), "Active bottleneck must mention Monsoon");
});

runTest("Atlantic Hurricane season adds +4 days across ocean & port arrival", () => {
  const result = simulateFclPipeline({
    shipmentId: "hurricane_test",
    name: "Hurricane Season UPS Transit",
    equipmentType: "ups_systems",
    origin: { name: "Hyderabad ICD", lat: 17.45, lng: 78.43 },
    destination: { name: "Florida Site", lat: 25.76, lng: -80.19 },
    departureDate: "2026-09-01T00:00:00.000Z",
    isHurricaneSeason: true,
  });

  assert(result.phases[3].simulatedDays === 27, `Expected Phase 4 to be 24+3=27 days, got ${result.phases[3].simulatedDays}`);
  assert(result.phases[4].simulatedDays === 5, `Expected Phase 5 to be 4+1=5 days, got ${result.phases[4].simulatedDays}`);
  assert(result.totalSimulatedDays === 49, `Expected total 49 days, got ${result.totalSimulatedDays}`);
});

runTest("Missed CY Cut-Off triggers mandatory +7 day vessel rollover penalty", () => {
  const result = simulateFclPipeline({
    shipmentId: "cutoff_test",
    name: "Missed Cutoff Transformer",
    equipmentType: "heavy_transformers",
    origin: { name: "Hyderabad ICD", lat: 17.45, lng: 78.43 },
    destination: { name: "Florida Site", lat: 25.76, lng: -80.19 },
    departureDate: "2026-09-01T00:00:00.000Z",
    missedCyCutOff: true,
  });

  assert(result.phases[2].simulatedDays === 11, `Expected Phase 3 to be 4+7=11 days, got ${result.phases[2].simulatedDays}`);
  assert(result.totalSimulatedDays === 52, `Expected total 52 days, got ${result.totalSimulatedDays}`);
  assert(result.criticalPathAlerts.some(a => a.includes("rollover")), "Alert must report rollover");
});

runTest("CBP Intensive Physical Exam adds +5 days demurrage hold", () => {
  const result = simulateFclPipeline({
    shipmentId: "cbp_test",
    name: "CBP Flagged Switchgear",
    equipmentType: "switchgear",
    origin: { name: "Hyderabad ICD", lat: 17.45, lng: 78.43 },
    destination: { name: "Florida Site", lat: 25.76, lng: -80.19 },
    departureDate: "2026-09-01T00:00:00.000Z",
    cbpPhysicalExam: true,
  });

  assert(result.phases[4].simulatedDays === 9, `Expected Phase 5 to be 4+5=9 days, got ${result.phases[4].simulatedDays}`);
  assert(result.totalSimulatedDays === 50, `Expected total 50 days, got ${result.totalSimulatedDays}`);
});

runTest("LCL Fragmentation adds +10 days for CFS consolidation & de-consolidation", () => {
  const result = simulateFclPipeline({
    shipmentId: "lcl_test",
    name: "LCL Spare Parts",
    equipmentType: "server_racks",
    origin: { name: "Hyderabad ICD", lat: 17.45, lng: 78.43 },
    destination: { name: "Florida Site", lat: 25.76, lng: -80.19 },
    departureDate: "2026-09-01T00:00:00.000Z",
    isLcl: true,
  });

  assert(result.totalSimulatedDays === 55, `Expected LCL total 55 days, got ${result.totalSimulatedDays}`);
});

console.log("\n🎉 ALL FCL FREIGHT ARCHITECTURE TESTS PASSED! (100% Green)\n");
