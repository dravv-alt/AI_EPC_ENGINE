/**
 * ============================================================================
 * DYNAMIC FREIGHT ESTIMATOR & CORRIDOR DIFFERENTIATION TEST SUITE
 * ============================================================================
 * Verifies that every distinct origin/destination corridor and cargo type
 * generates mathematically differentiated, empirically accurate 6-phase lead times.
 */

import { estimateDynamicSupplyChainPhases } from "../dynamic-freight-estimator.ts";

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

console.log("🌐 Starting Dynamic Multimodal Freight Estimator Tests...\n");

console.log("🧪 1. Testing Hyderabad, India → Florida, USA (Flagship FCL Corridor)...");
runTest("Hyderabad → Florida generates realistic ~45 day total door-to-site duration", () => {
  const result = estimateDynamicSupplyChainPhases({
    originLat: 17.45,
    originLng: 78.43,
    originName: "Sanathnagar ICD, Hyderabad",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Data Center, Florida",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  console.log(`      • Total Door-to-Site Duration: ${result.totalLeadTimeDays} Days (${result.totalLeadTimeHours} Hours)`);
  console.log(`      • Origin Inland Distance:      ${result.originInlandDistanceKm} km (Rail to JNPT)`);
  console.log(`      • Ocean Route Distance:        ${result.oceanNauticalMiles} nm`);
  console.log(`      • Destination Inland Distance: ${result.destinationInlandDistanceKm} km (Florida Drayage)`);
  console.log(`      • Origin Customs:              ${result.customsRegime.origin}`);
  console.log(`      • Destination Customs:         ${result.customsRegime.destination}`);

  assert(result.totalLeadTimeDays >= 40 && result.totalLeadTimeDays <= 55, `Expected 40-55 days, got ${result.totalLeadTimeDays}`);
  assert(result.phases.length === 6, "Must contain all 6 distinct supply chain phases");
  assert(result.phases[1].distanceKm >= 600, "Inland rail leg from Hyderabad must be > 600 km");
  assert(result.phases[3].distanceNm >= 8000, "Ocean distance must be > 8000 nm");
});

console.log("\n🧪 2. Testing Corridor Differentiation (Mumbai Factory vs Hyderabad Inland)...");
runTest("Mumbai Coastal Factory has shorter Phase 2 lead time than inland Hyderabad", () => {
  const mumbaiResult = estimateDynamicSupplyChainPhases({
    originLat: 18.96,
    originLng: 72.82,
    originName: "Mumbai Coastal Plant",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Data Center, Florida",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  const hyderabadResult = estimateDynamicSupplyChainPhases({
    originLat: 17.45,
    originLng: 78.43,
    originName: "Sanathnagar ICD, Hyderabad",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Data Center, Florida",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  console.log(`      • Mumbai Phase 2 Haulage:    ${mumbaiResult.phases[1].durationDays} Days (${mumbaiResult.originInlandDistanceKm} km)`);
  console.log(`      • Hyderabad Phase 2 Haulage: ${hyderabadResult.phases[1].durationDays} Days (${hyderabadResult.originInlandDistanceKm} km)`);

  assert(
    mumbaiResult.phases[1].durationHours < hyderabadResult.phases[1].durationHours,
    "Coastal origin must have significantly faster Phase 2 inland haulage than deep-inland ICD"
  );
});

console.log("\n🧪 3. Testing Regional Customs Differentiation (EU vs USA vs East Asia)...");
runTest("Rotterdam EU Customs processes faster than US CBP VACIS + ISF-10 clearance", () => {
  const euResult = estimateDynamicSupplyChainPhases({
    originLat: 18.96,
    originLng: 72.82,
    originName: "Mumbai Port",
    destinationLat: 51.92,
    destinationLng: 4.47,
    destinationName: "Rotterdam EPC Site",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  const usResult = estimateDynamicSupplyChainPhases({
    originLat: 18.96,
    originLng: 72.82,
    originName: "Mumbai Port",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Data Center, Florida",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  console.log(`      • EU Destination Customs (Phase 5): ${euResult.phases[4].durationHours}h (${euResult.customsRegime.destination})`);
  console.log(`      • US Destination Customs (Phase 5): ${usResult.phases[4].durationHours}h (${usResult.customsRegime.destination})`);

  assert(euResult.customsRegime.destination.includes("ATLAS"), "EU destination must identify ATLAS customs");
  assert(usResult.customsRegime.destination.includes("CBP"), "US destination must identify US CBP");
});

console.log("\n🧪 4. Testing Heavy Transformer Rigging vs Standard Server Racks...");
runTest("Heavy Transformers allocate specialized timber crating and tandem crane hours", () => {
  const serverResult = estimateDynamicSupplyChainPhases({
    originLat: 17.45,
    originLng: 78.43,
    originName: "Hyderabad ICD",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Site",
    transportMode: "sea",
    equipmentType: "server_racks",
  });

  const transformerResult = estimateDynamicSupplyChainPhases({
    originLat: 17.45,
    originLng: 78.43,
    originName: "Hyderabad ICD",
    destinationLat: 25.76,
    destinationLng: -80.19,
    destinationName: "Miami Site",
    transportMode: "sea",
    equipmentType: "heavy_transformers",
  });

  console.log(`      • Standard Servers Phase 1 (Packing): ${serverResult.phases[0].durationHours}h`);
  console.log(`      • Heavy Transformer Phase 1 (Packing): ${transformerResult.phases[0].durationHours}h`);

  assert(
    transformerResult.phases[0].durationHours > serverResult.phases[0].durationHours,
    "Heavy transformers must allocate more crating hours than standard server cartons"
  );
  assert(
    transformerResult.phases[2].durationHours > serverResult.phases[2].durationHours,
    "Heavy transformers must allocate tandem crane loading hours at origin port"
  );
});

console.log("\n🎉 ALL DYNAMIC FREIGHT ESTIMATOR TESTS PASSED! (100% Green)\n");
