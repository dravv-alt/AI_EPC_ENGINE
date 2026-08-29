/**
 * ============================================================================
 * SYNTHETIC DATASET STORE & CHECKPOINT MANAGER
 * ============================================================================
 * Manages in-memory / JSON-lines storage of generated synthetic training records 
 * with resume and checkpoint support.
 */

import { SyntheticTrainingRow } from "./generate-training-row";

const datasetStore = new Map<string, SyntheticTrainingRow>();
const completedScenarioIds = new Set<string>();

/**
 * Appends a generated training row to the dataset store.
 */
export async function appendRowToDataset(row: SyntheticTrainingRow): Promise<void> {
  datasetStore.set(row.scenarioId, row);
  completedScenarioIds.add(row.scenarioId);
}

/**
 * Loads set of completed scenario IDs to resume interrupted batches without duplicate work.
 */
export async function loadCompletedScenarioIds(): Promise<Set<string>> {
  return new Set(completedScenarioIds);
}

/**
 * Retrieves all stored synthetic training rows.
 */
export function getAllTrainingRows(): SyntheticTrainingRow[] {
  return Array.from(datasetStore.values());
}

/**
 * Clears dataset store.
 */
export function clearDatasetStore(): void {
  datasetStore.clear();
  completedScenarioIds.clear();
}

/**
 * Exports summary statistics of the synthetic ground-truth dataset.
 */
export function getDatasetSummary() {
  const rows = getAllTrainingRows();
  const total = rows.length;
  if (!total) {
    return { totalRecords: 0, meanCleanDelay: 0, meanNoisyDelay: 0, disruptionCount: 0 };
  }

  const meanClean = rows.reduce((s, r) => s + r.cleanPhysicsDelayHours, 0) / total;
  const meanNoisy = rows.reduce((s, r) => s + r.noisyGroundTruthDelayHours, 0) / total;
  const disruptionCount = rows.filter((r) => r.hasOperationalDisruption).length;

  return {
    totalRecords: total,
    meanCleanDelay: Number(meanClean.toFixed(2)),
    meanNoisyDelay: Number(meanNoisy.toFixed(2)),
    disruptionCount,
    disruptionPercentage: Number(((disruptionCount / total) * 100).toFixed(1)),
  };
}
