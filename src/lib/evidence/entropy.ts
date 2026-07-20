import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { decisions, edges, evidence, requirements, sourceRegions } from "@/lib/db/schema";

// CanonicalBuildPlan Feature 21 — a transparent, ADVISORY-ONLY score that flags
// structurally weak evidence. This module is deliberately never imported by
// `computeReadiness` or any gate/blocker path (src/lib/readiness/**): it is
// computed on demand, from existing tables, with no LLM and no migration.
//
// Every signal below produces one of two shapes:
//   - computed:    { severity: 0..1, contribution: points, reason: short note, detail }
//   - unavailable: { severity: null, contribution: null, reason: why, detail }
// An unavailable signal must NEVER be silently folded in as a zero — that
// would misrepresent "nothing wrong" as "we checked and it's fine" when in
// fact the data couldn't support a check at all. This mirrors the pattern the
// predictive-risk engine (src/lib/predictive-risk/engine.ts) already uses for
// signals with `dataAvailable: false`.

export const ENTROPY_SIGNAL_KEYS = [
  "evidenceOverReuse",
  "staleOrUnsignedRecords",
  "missingCalibration",
  "circularEdges",
  "lowConfidenceExtraction",
  "overloadedApprover"
] as const;
export type EntropySignalKey = (typeof ENTROPY_SIGNAL_KEYS)[number];

// Each signal contributes up to this many points to the 0-100 total when
// fully triggered (severity 1). Kept equal and local to this module — Slice 7
// does not require named/overridable targets (that was Slice 1's job for
// enforcement-relevant constants); this score never enforces anything.
const SIGNAL_WEIGHT = 100 / ENTROPY_SIGNAL_KEYS.length;

// An evidence row PROVES-ing more requirements than this is treated as an
// outlier reuse rather than ordinary shared proof (e.g. one site walk-through
// photo legitimately proving two or three related requirements is normal).
const OVER_REUSE_THRESHOLD = 3;

// A requirement's extraction confidence below this, among ACCEPTED rows only
// (proposed/rejected rows haven't been human-confirmed yet and aren't judged
// here), is flagged as low-confidence.
const LOW_CONFIDENCE_THRESHOLD = 0.5;

// A single approver holding more than this share of a project's decisions is
// flagged as overloaded, but only once there are enough decisions for a share
// to be meaningful at all.
const OVERLOAD_SHARE_THRESHOLD = 0.6;
const MIN_DECISIONS_FOR_APPROVER_SIGNAL = 3;

// Loose heuristic for "a calibration reference is present in this text" —
// intentionally permissive (id/ref/cert/date forms) since this is an
// advisory heuristic over free-text notes, not a structured field.
const CALIBRATION_REFERENCE_PATTERN = /\bcalibrat(ed|ion)\b.{0,40}\b([a-z0-9-]*\d[a-z0-9-]*)\b|\bcal[-\s]?(id|ref|cert)[:#]?\s*\S+/i;

export interface ComputedSignal<Detail> {
  key: EntropySignalKey;
  label: string;
  mode: "computed";
  severity: number;
  contribution: number;
  reason: string;
  detail: Detail;
}
export interface UnavailableSignal<Detail> {
  key: EntropySignalKey;
  label: string;
  mode: "unavailable";
  severity: null;
  contribution: null;
  reason: string;
  detail: Detail;
}
export type EntropySignal<Detail = Record<string, unknown>> = ComputedSignal<Detail> | UnavailableSignal<Detail>;

export interface EvidenceEntropyResult {
  projectId: string;
  computedAt: string;
  total: number;
  maxPossible: number;
  signals: EntropySignal[];
}

function computed<Detail>(key: EntropySignalKey, label: string, severity: number, reason: string, detail: Detail): ComputedSignal<Detail> {
  const clamped = Math.min(1, Math.max(0, severity));
  return { key, label, mode: "computed", severity: clamped, contribution: Math.round(clamped * SIGNAL_WEIGHT * 100) / 100, reason, detail };
}
function unavailable<Detail>(key: EntropySignalKey, label: string, reason: string, detail: Detail): UnavailableSignal<Detail> {
  return { key, label, mode: "unavailable", severity: null, contribution: null, reason, detail };
}

function evidenceOverReuseSignal(evidenceRows: Array<typeof evidence.$inferSelect>, allEdges: Array<typeof edges.$inferSelect>): EntropySignal {
  const provesEdges = allEdges.filter((edge) => edge.fromType === "evidence" && edge.relationshipType === "PROVES" && edge.toType === "requirement");
  const provesCountByEvidence = new Map<string, Set<string>>();
  for (const edge of provesEdges) {
    const set = provesCountByEvidence.get(edge.fromId) ?? new Set<string>();
    set.add(edge.toId);
    provesCountByEvidence.set(edge.fromId, set);
  }
  const outliers = [...provesCountByEvidence.entries()]
    .map(([evidenceId, requirementIds]) => ({ evidenceId, provesCount: requirementIds.size }))
    .filter((item) => item.provesCount > OVER_REUSE_THRESHOLD)
    .sort((a, b) => b.provesCount - a.provesCount);
  const maxProvesCount = outliers[0]?.provesCount ?? 0;
  const severity = maxProvesCount > OVER_REUSE_THRESHOLD ? Math.min(1, (maxProvesCount - OVER_REUSE_THRESHOLD) / OVER_REUSE_THRESHOLD) : 0;
  return computed(
    "evidenceOverReuse",
    "Evidence over-reuse",
    severity,
    outliers.length ? `${outliers.length} evidence record(s) each PROVE more than ${OVER_REUSE_THRESHOLD} requirements.` : `No evidence record PROVEs more than ${OVER_REUSE_THRESHOLD} requirements.`,
    { threshold: OVER_REUSE_THRESHOLD, evidenceRowCount: evidenceRows.length, outliers }
  );
}

function staleOrUnsignedSignal(evidenceRows: Array<typeof evidence.$inferSelect>): EntropySignal {
  const stale = evidenceRows.filter((item) => item.validityState === "stale");
  const pending = evidenceRows.filter((item) => item.validityState === "pending");
  const unsignedAccepted = evidenceRows.filter((item) => item.validityState === "accepted" && !item.capturedBy);
  const flagged = [...stale, ...pending, ...unsignedAccepted];
  const severity = evidenceRows.length ? flagged.length / evidenceRows.length : 0;
  return computed(
    "staleOrUnsignedRecords",
    "Unsigned or stale records",
    severity,
    flagged.length ? `${flagged.length} of ${evidenceRows.length} evidence record(s) are stale, pending, or accepted without a capturing user.` : "No evidence record is stale, pending, or unsigned-accepted.",
    {
      totalEvidenceRows: evidenceRows.length,
      staleIds: stale.map((item) => item.id),
      pendingIds: pending.map((item) => item.id),
      unsignedAcceptedIds: unsignedAccepted.map((item) => item.id)
    }
  );
}

async function missingCalibrationSignal(evidenceRows: Array<typeof evidence.$inferSelect>): Promise<EntropySignal> {
  const measurementRows = evidenceRows.filter((item) => item.evidenceType === "measurement");
  if (!measurementRows.length) {
    return computed("missingCalibration", "Missing calibration", 0, "No measurement-type evidence exists in this project, so there is nothing to check for a calibration reference.", { measurementRowCount: 0 });
  }
  const regionIds = [...new Set(measurementRows.map((item) => item.sourceRegionId).filter((id): id is string => Boolean(id)))];
  const regions = regionIds.length ? await db.select({ id: sourceRegions.id, extractedText: sourceRegions.extractedText }).from(sourceRegions).where(inArray(sourceRegions.id, regionIds)) : [];
  const regionById = new Map(regions.map((region) => [region.id, region.extractedText]));

  const uncheckable: string[] = [];
  const flagged: string[] = [];
  const compliant: string[] = [];
  for (const row of measurementRows) {
    const linkedText = row.sourceRegionId ? regionById.get(row.sourceRegionId) : undefined;
    const text = [row.notes ?? "", linkedText ?? ""].join(" ").trim();
    if (!text) {
      uncheckable.push(row.id);
      continue;
    }
    if (CALIBRATION_REFERENCE_PATTERN.test(text)) compliant.push(row.id);
    else flagged.push(row.id);
  }
  const checkableCount = flagged.length + compliant.length;
  if (checkableCount === 0) {
    return unavailable(
      "missingCalibration",
      "Missing calibration",
      "Measurement-type evidence exists, but none of it carries notes or linked source-region text to check for a calibration reference.",
      { measurementRowCount: measurementRows.length, uncheckableIds: uncheckable }
    );
  }
  const severity = flagged.length / checkableCount;
  return computed(
    "missingCalibration",
    "Missing calibration",
    severity,
    `${flagged.length} of ${checkableCount} checkable measurement record(s) carry no calibration reference in their notes or linked source text.` + (uncheckable.length ? ` ${uncheckable.length} record(s) had no text to check and were excluded rather than assumed compliant.` : ""),
    { measurementRowCount: measurementRows.length, checkableCount, flaggedIds: flagged, compliantIds: compliant, uncheckableIds: uncheckable }
  );
}

function circularEdgesSignal(allEdges: Array<typeof edges.$inferSelect>): EntropySignal {
  const adjacency = new Map<string, string[]>();
  for (const edge of allEdges) {
    const from = `${edge.fromType}:${edge.fromId}`;
    const to = `${edge.toType}:${edge.toId}`;
    const list = adjacency.get(from) ?? [];
    list.push(to);
    adjacency.set(from, list);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  let cyclePath: string[] | null = null;

  function visit(node: string, path: string[]): boolean {
    color.set(node, GRAY);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const state = color.get(next) ?? WHITE;
      if (state === GRAY) {
        const start = path.indexOf(next);
        cyclePath = [...path.slice(start), next];
        return true;
      }
      if (state === WHITE && visit(next, path)) return true;
    }
    path.pop();
    color.set(node, BLACK);
    return false;
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      if (visit(node, [])) break;
    }
  }
  const hasCycle = Boolean(cyclePath);
  return computed(
    "circularEdges",
    "Circular provenance edges",
    hasCycle ? 1 : 0,
    hasCycle ? "A cycle exists in the project's provenance edge graph." : "No cycle was found in the project's provenance edge graph.",
    { cycle: cyclePath ?? [] }
  );
}

function lowConfidenceExtractionSignal(requirementRows: Array<typeof requirements.$inferSelect>): EntropySignal {
  const accepted = requirementRows.filter((item) => item.reviewState === "accepted");
  if (!accepted.length) {
    return computed("lowConfidenceExtraction", "Low-confidence extraction", 0, "No accepted requirement exists yet, so there is nothing to assess for extraction confidence.", { acceptedCount: 0 });
  }
  const withConfidence = accepted.filter((item) => item.confidence !== null);
  if (!withConfidence.length) {
    return unavailable(
      "lowConfidenceExtraction",
      "Low-confidence extraction",
      "Accepted requirements exist, but none of them carry an extraction confidence value to assess.",
      { acceptedCount: accepted.length }
    );
  }
  const low = withConfidence.filter((item) => Number(item.confidence) < LOW_CONFIDENCE_THRESHOLD);
  const severity = low.length / withConfidence.length;
  return computed(
    "lowConfidenceExtraction",
    "Low-confidence extraction",
    severity,
    `${low.length} of ${withConfidence.length} accepted requirement(s) with a confidence value fall below ${LOW_CONFIDENCE_THRESHOLD}.` + (withConfidence.length < accepted.length ? ` ${accepted.length - withConfidence.length} accepted requirement(s) had no confidence value and were excluded.` : ""),
    { threshold: LOW_CONFIDENCE_THRESHOLD, acceptedCount: accepted.length, assessedCount: withConfidence.length, lowConfidenceIds: low.map((item) => item.id) }
  );
}

function overloadedApproverSignal(decisionRows: Array<typeof decisions.$inferSelect>): EntropySignal {
  if (decisionRows.length < MIN_DECISIONS_FOR_APPROVER_SIGNAL) {
    return unavailable(
      "overloadedApprover",
      "Overloaded approver",
      `Only ${decisionRows.length} decision(s) exist for this project; at least ${MIN_DECISIONS_FOR_APPROVER_SIGNAL} are needed before an approver's share is meaningful.`,
      { decisionCount: decisionRows.length, minimumRequired: MIN_DECISIONS_FOR_APPROVER_SIGNAL }
    );
  }
  const countByApprover = new Map<string, number>();
  for (const decision of decisionRows) countByApprover.set(decision.decidedBy, (countByApprover.get(decision.decidedBy) ?? 0) + 1);
  const [topApprover, topCount] = [...countByApprover.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = topCount / decisionRows.length;
  const severity = share > OVERLOAD_SHARE_THRESHOLD ? Math.min(1, (share - OVERLOAD_SHARE_THRESHOLD) / (1 - OVERLOAD_SHARE_THRESHOLD)) : 0;
  return computed(
    "overloadedApprover",
    "Overloaded approver",
    severity,
    severity > 0 ? `One approver holds ${Math.round(share * 100)}% of this project's ${decisionRows.length} decisions, above the ${Math.round(OVERLOAD_SHARE_THRESHOLD * 100)}% threshold.` : `No approver holds more than ${Math.round(OVERLOAD_SHARE_THRESHOLD * 100)}% of this project's decisions.`,
    { decisionCount: decisionRows.length, threshold: OVERLOAD_SHARE_THRESHOLD, topApproverId: topApprover, topApproverShare: Math.round(share * 10000) / 10000 }
  );
}

/**
 * Computes the evidence-entropy / weak-evidence score for a project.
 *
 * ADVISORY ONLY — this is a read-only, on-demand computation over existing
 * tables. It must never be called from `computeReadiness` or any gate/blocker
 * decision path, and it never writes anything (no persistence, no migration).
 */
export async function computeEvidenceEntropy(projectId: string): Promise<EvidenceEntropyResult> {
  const [evidenceRows, allEdges, requirementRows, decisionRows] = await Promise.all([
    db.select().from(evidence).where(eq(evidence.projectId, projectId)),
    db.select().from(edges).where(eq(edges.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)),
    db.select().from(decisions).where(eq(decisions.projectId, projectId))
  ]);

  const signals: EntropySignal[] = [
    evidenceOverReuseSignal(evidenceRows, allEdges),
    staleOrUnsignedSignal(evidenceRows),
    await missingCalibrationSignal(evidenceRows),
    circularEdgesSignal(allEdges),
    lowConfidenceExtractionSignal(requirementRows),
    overloadedApproverSignal(decisionRows)
  ];

  const total = Math.round(signals.reduce((sum, signal) => sum + (signal.contribution ?? 0), 0) * 100) / 100;
  const maxPossible = Math.round(signals.filter((signal) => signal.mode === "computed").length * SIGNAL_WEIGHT * 100) / 100;

  return { projectId, computedAt: new Date().toISOString(), total, maxPossible, signals };
}
