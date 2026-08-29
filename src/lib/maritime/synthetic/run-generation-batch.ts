/**
 * ============================================================================
 * SYNTHETIC GROUND-TRUTH BATCH GENERATOR RUNNER
 * ============================================================================
 * Executes batch generation of synthetic scenarios with concurrency control, 
 * progress tracking, error isolation, and resume support.
 */

import { generateScenarioGrid, materializeScenario, ScenarioParams } from "./scenario-generator";
import { generateTrainingRow, SyntheticTrainingRow } from "./generate-training-row";
import { appendRowToDataset, loadCompletedScenarioIds, getDatasetSummary } from "./dataset-store";

export interface BatchGenerationOptions {
  samplesPerCell?: number;
  concurrency?: number;
  onProgress?: (completed: number, total: number, latestRow?: SyntheticTrainingRow) => void;
}

export interface BatchGenerationReport {
  totalScenarios: number;
  processedCount: number;
  failedCount: number;
  durationSeconds: number;
  summary: ReturnType<typeof getDatasetSummary>;
}

/**
 * Runs a full synthetic generation batch across trade corridors.
 */
export async function runGenerationBatch(
  options: BatchGenerationOptions = {}
): Promise<BatchGenerationReport> {
  const { samplesPerCell = 1, concurrency = 4, onProgress } = options;
  const startTime = Date.now();

  const allParams = generateScenarioGrid(samplesPerCell);
  const completedIds = await loadCompletedScenarioIds();

  const pending = allParams.filter((p) => {
    const s = materializeScenario(p);
    return !completedIds.has(s.id);
  });

  let processedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < pending.length; i += concurrency) {
    const chunk = pending.slice(i, i + concurrency);
    const scenarios = chunk.map((p) => materializeScenario(p));

    const settled = await Promise.allSettled(
      scenarios.map((scen) => generateTrainingRow(scen))
    );

    for (const res of settled) {
      if (res.status === "fulfilled") {
        await appendRowToDataset(res.value);
        processedCount++;
        if (onProgress) {
          onProgress(processedCount, pending.length, res.value);
        }
      } else {
        failedCount++;
        console.error("Scenario generation failed:", res.reason);
      }
    }
  }

  const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
  const summary = getDatasetSummary();

  return {
    totalScenarios: allParams.length,
    processedCount,
    failedCount,
    durationSeconds,
    summary,
  };
}
