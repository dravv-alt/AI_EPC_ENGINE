import { z } from "zod";
import { compareCompliance } from "@/lib/compliance/compare";

const verdictSchema = z.enum(["conforms", "deterministic_flag", "possible_mismatch", "needs_engineering_judgment", "equivalent_by_precedent"]);

export const complianceGoldenSetSchema = z.object({
  schemaVersion: z.literal("1.0"),
  name: z.string().min(3),
  labelSource: z.enum(["controlled_fixture", "expert_reviewed"]),
  cases: z.array(z.object({
    id: z.string().min(3),
    modality: z.enum(["numeric", "boolean", "categorical", "narrative"]),
    requirement: z.object({
      statement: z.string().min(8),
      numericValue: z.string().nullable(),
      unit: z.string().nullable(),
      tolerance: z.string().nullable(),
      comparisonModality: z.enum(["numeric", "boolean", "categorical", "narrative"]),
    }),
    targetText: z.string().min(3),
    expectedVerdict: verdictSchema,
    rationale: z.string().min(8),
  })).min(10),
});

export function evaluateComplianceGoldenSet(input: unknown) {
  const dataset = complianceGoldenSetSchema.parse(input);
  const rows = dataset.cases.map((testCase) => {
    const result = compareCompliance(testCase.requirement, testCase.targetText);
    return { id: testCase.id, modality: testCase.modality, expected: testCase.expectedVerdict, actual: result.verdict, passed: result.verdict === testCase.expectedVerdict, reason: result.reason };
  });
  const positive = (verdict: string) => verdict === "deterministic_flag";
  const truePositive = rows.filter((row) => positive(row.expected) && positive(row.actual)).length;
  const falsePositive = rows.filter((row) => !positive(row.expected) && positive(row.actual)).length;
  const falseNegative = rows.filter((row) => positive(row.expected) && !positive(row.actual)).length;
  const trueNegative = rows.length - truePositive - falsePositive - falseNegative;
  const accuracy = rows.filter((row) => row.passed).length / rows.length;
  const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 1;
  const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 1;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  const byModality = Object.fromEntries(["numeric", "boolean", "categorical", "narrative"].map((modality) => {
    const cases = rows.filter((row) => row.modality === modality);
    return [modality, { cases: cases.length, passed: cases.filter((row) => row.passed).length }];
  }));
  return {
    dataset: dataset.name,
    labelSource: dataset.labelSource,
    productionAccuracyClaimPermitted: dataset.labelSource === "expert_reviewed",
    cases: rows.length,
    passed: rows.filter((row) => row.passed).length,
    metrics: { accuracy, precision, recall, f1, truePositive, falsePositive, falseNegative, trueNegative },
    byModality,
    failures: rows.filter((row) => !row.passed),
  };
}
