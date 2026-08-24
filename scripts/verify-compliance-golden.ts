import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyDeterministicSafetyFloor } from "../src/lib/compliance/assess";
import { compareCompliance } from "../src/lib/compliance/compare";
import { isComplianceCandidateRelevant } from "../src/lib/compliance/discover";
import {
  complianceGoldenSetSchema,
  evaluateComplianceGoldenSet,
} from "../src/lib/compliance/evaluate";
import { selectControlledTargetExcerpt } from "../src/lib/compliance/target-excerpt";

async function main() {
  const datasetPath = path.resolve(
    process.argv[2] ?? "fixtures/compliance-golden-set.json",
  );
  const dataset = complianceGoldenSetSchema.parse(
    JSON.parse(await readFile(datasetPath, "utf8")),
  );
  const evaluation = evaluateComplianceGoldenSet(dataset);

  const deterministicFlag = compareCompliance(
    {
      statement: "Pressure shall be 100 kPa.",
      numericValue: "100",
      unit: "kPa",
      tolerance: "0",
      comparisonModality: "numeric",
    },
    "Pressure: 120 kPa.",
  );
  assert.equal(
    applyDeterministicSafetyFloor({
      modelVerdict: "conforms",
      modelReason: "Model suggested conformity.",
      deterministic: deterministicFlag,
    }).verdict,
    "deterministic_flag",
    "A model must not erase a deterministic deviation.",
  );
  const narrative = compareCompliance(
    {
      statement: "Installation shall be suitable for service.",
      numericValue: null,
      unit: null,
      tolerance: null,
      comparisonModality: "narrative",
    },
    "Vendor standard arrangement.",
  );
  assert.equal(
    applyDeterministicSafetyFloor({
      modelVerdict: "conforms",
      modelReason: "Model suggested conformity.",
      deterministic: narrative,
    }).verdict,
    "needs_engineering_judgment",
    "A model must not certify a qualitative comparison.",
  );
  const fullPage =
    "Motor schedule: 480 V.\nOperating pressure: 1 bar.\nAmbient limit: 40 °C.";
  assert.equal(
    selectControlledTargetExcerpt(
      "Operating pressure shall be 100 kPa.",
      fullPage,
    ),
    "Operating pressure: 1 bar.",
    "The selector must choose the relevant exact line, not the first page number.",
  );
  assert.equal(
    isComplianceCandidateRelevant(
      "CHW supply temperature at the header shall not exceed 7 °C at design load.",
      "Electrical panels shall be rated for a minimum IP54 ingress protection class.",
      0.88,
    ),
    false,
    "A high embedding score must not pair unrelated engineering domains.",
  );
  assert.equal(
    isComplianceCandidateRelevant(
      "CHW supply temperature at the header shall not exceed 7 °C at design load.",
      "The chilled-water supply temperature shall be maintained at 6 °C.",
      0.78,
    ),
    true,
    "A semantically and lexically aligned target must remain eligible.",
  );

  const report = {
    schemaVersion: "1.0",
    dataset: dataset.name,
    labelSource: dataset.labelSource,
    generatedAt: new Date().toISOString(),
    productionAccuracyClaimPermitted: dataset.labelSource === "expert_reviewed",
    cases: evaluation.cases,
    passed: evaluation.passed,
    metrics: evaluation.metrics,
    byModality: evaluation.byModality,
    failures: evaluation.failures,
    safetyAssertions: {
      deterministicDeviationCannotBeDowngraded: true,
      qualitativeCannotBeMachineCertified: true,
      relevantExactTargetFragmentSelected: true,
      crossDomainCandidateRejected: true,
    },
  };

  const outputDirectory = path.resolve("output/evaluation");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "compliance-golden-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));

  assert.ok(
    evaluation.metrics.accuracy >= 0.95,
    `Controlled-set accuracy ${(evaluation.metrics.accuracy * 100).toFixed(1)}% is below the 95% gate.`,
  );
  assert.equal(
    evaluation.metrics.falsePositive,
    0,
    "The controlled set permits no false-positive deterministic deviations.",
  );
  assert.equal(
    evaluation.metrics.falseNegative,
    0,
    "The controlled set permits no missed deterministic deviations.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
