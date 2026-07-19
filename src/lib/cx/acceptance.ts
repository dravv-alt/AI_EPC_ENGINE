import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cxTestRecords } from "@/lib/db/schema";

export type StepInput = { modality: "numeric" | "boolean" | "narrative"; nominalValue?: number | null; tolerance?: number | null; expectedBoolean?: boolean | null };
export type StepReading = { value?: number | null; boolean?: boolean | null; text?: string | null };
export type CxVerdict = "proposed_pass" | "proposed_fail" | "needs_human_review";

/** Pure, LLM-free acceptance boundary. Narrative criteria always require a human. */
export function evaluateStep(step: StepInput, reading: StepReading): CxVerdict {
  if (step.modality === "narrative") return "needs_human_review";
  if (step.modality === "boolean") return reading.boolean === step.expectedBoolean ? "proposed_pass" : "proposed_fail";
  if (reading.value == null || step.nominalValue == null || step.tolerance == null) throw new Error("Numeric step requires reading, nominal value, and tolerance.");
  return Math.abs(reading.value - step.nominalValue) <= step.tolerance ? "proposed_pass" : "proposed_fail";
}

export function aggregateVerdicts(verdicts: CxVerdict[]): CxVerdict {
  if (verdicts.includes("proposed_fail")) return "proposed_fail";
  if (verdicts.includes("needs_human_review")) return "needs_human_review";
  return "proposed_pass";
}

/** Approved commissioning test records shaped for the turnover pack manifest, deterministically sorted by id. */
export async function selectApprovedCxRecordsForManifest(projectId: string) {
  const rows = await db.select({ id: cxTestRecords.id, checklistId: cxTestRecords.checklistId, gateId: cxTestRecords.gateId, overallStatus: cxTestRecords.overallStatus, reportContentHash: cxTestRecords.reportContentHash, approvedBy: cxTestRecords.approvedBy, approvedAt: cxTestRecords.approvedAt }).from(cxTestRecords).where(and(eq(cxTestRecords.projectId, projectId), eq(cxTestRecords.reportStatus, "approved")));
  return rows.map((row) => ({ id: row.id, checklistId: row.checklistId, gateId: row.gateId, overallStatus: row.overallStatus, reportContentHash: row.reportContentHash, approvedBy: row.approvedBy, approvedAt: row.approvedAt?.toISOString() ?? null })).sort((a, b) => a.id.localeCompare(b.id));
}
