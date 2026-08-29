/**
 * ============================================================================
 * EXPORT MARITIME GROUND-TRUTH TRAINING DATASET TO JSON FOR XGBOOST
 * ============================================================================
 * Materializes 36 diverse multi-corridor voyages (covering all 6 trade corridors, 
 * 11 vessel classes, summer monsoon and winter storm months), extracting 
 * hundreds of leg records with real historical weather and operational noise labels.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { generateScenarioGrid, materializeScenario } from "../lib/maritime/synthetic/scenario-generator";
import { generateTrainingRow } from "../lib/maritime/synthetic/generate-training-row";

console.log("🚢 Generating multi-corridor maritime ground truth dataset for XGBoost...");

const grid = generateScenarioGrid(1);

// Generate 120 diverse parameter tuples across all 6 corridors (20 per corridor)
const selectedIndices: number[] = [];
// 6 corridors * 20 scenarios = 120 voyages
for (let corridor = 0; corridor < 6; corridor++) {
  const corridorBase = corridor * (11 * 2 * 12); // corridor offset
  for (let s = 0; s < 20; s++) {
    selectedIndices.push(corridorBase + s * 13); // stride through vessel classes & months
  }
}

const selectedParams = selectedIndices.map((idx) => grid[idx % grid.length]);

async function main() {
  const scenarios = await Promise.all(
    selectedParams.map(async (p) => {
      const scen = materializeScenario(p);
      // Take 15 waypoints per voyage to provide dense trade lane coverage (~540 total legs)
      scen.waypoints = scen.waypoints.slice(0, 15);
      return generateTrainingRow(scen);
    })
  );

  const outPath = path.resolve(process.cwd(), "dataset_maritime.json");
  fs.writeFileSync(outPath, JSON.stringify(scenarios, null, 2), "utf-8");

  const totalLegs = scenarios.reduce((sum, s) => sum + s.legs.length, 0);
  console.log(`✅ Successfully generated ${scenarios.length} voyages with ${totalLegs} total legs.`);
  console.log(`📁 Exported to ${outPath}`);
}

main().catch(console.error);
