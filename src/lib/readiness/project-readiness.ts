import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { edges, evidence, findings, gates, requirements } from "@/lib/db/schema";
import { computeReadiness, type ReadinessState } from "@/lib/readiness/compute";

type ProofState = "accepted" | "missing" | "stale" | "failed" | "unapproved";
export interface RequirementProofDetail { requirementId: string; statement: string; state: ProofState; evidenceIds: string[] }
export interface GateReadiness {
  gateId: string;
  state: ReadinessState;
  acceptedRequirements: number;
  requiredEvidence: number;
  acceptedEvidence: number;
  missingEvidence: number;
  unapprovedEvidence: number;
  staleEvidence: number;
  failedEvidence: number;
  blockingFindings: number;
  unmetPrerequisites: number;
  proofDetails: RequirementProofDetail[];
  blockingFindingDetails: Array<{ id: string; title: string; severity: string; ownerId: string | null; dueAt: Date | null; isOverdue: boolean; reasons: Array<"severity" | "overdue"> }>;
  prerequisiteDetails: Array<{ id: string; name: string; status: string }>;
  evaluatedAt: Date;
  ruleVersion: string;
}

// Statuses that mean a finding is no longer actionable, so it can never be
// "overdue" regardless of dueAt. "resolved" is included for forward
// compatibility even though only "closed" is emitted today.
const CLOSED_FINDING_STATUSES = new Set(["resolved", "closed"]);

// Deterministic: a finding is overdue only by its own dueAt/status, never by
// severity. Severity decides whether it blocks the gate; overdue decides
// whether it's visible in the blocker view regardless of severity (US-05).
function isOverdueFinding(finding: typeof findings.$inferSelect, now: Date): boolean {
  return finding.dueAt !== null && finding.dueAt.getTime() < now.getTime() && !CLOSED_FINDING_STATUSES.has(finding.status);
}

// Fixed, versioned constant — not computed per-record — so it's referenced
// directly (rather than persisted to a column) anywhere provenance needs it,
// e.g. the turnover manifest.
export const READINESS_RULE_VERSION = "readiness-v2.1";
const ruleVersion = READINESS_RULE_VERSION;

function proofState(records: Array<typeof evidence.$inferSelect>): ProofState {
  if (records.some((item) => item.validityState === "failed")) return "failed";
  if (records.some((item) => item.validityState === "accepted")) return "accepted";
  if (records.some((item) => item.validityState === "stale")) return "stale";
  if (records.some((item) => item.validityState === "pending")) return "unapproved";
  return "missing";
}

async function evaluateProject(projectId: string): Promise<GateReadiness[]> {
  const [projectGates, projectRequirements, allEdges, projectEvidence, projectFindings] = await Promise.all([
    db.select().from(gates).where(eq(gates.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)),
    db.select().from(edges).where(eq(edges.projectId, projectId)),
    db.select().from(evidence).where(eq(evidence.projectId, projectId)),
    db.select().from(findings).where(eq(findings.projectId, projectId))
  ]);
  const requirementById = new Map(projectRequirements.map((item) => [item.id, item]));
  const evidenceById = new Map(projectEvidence.map((item) => [item.id, item]));
  const evaluatedAt = new Date();

  return projectGates.map((gate) => {
    const acceptedRequirements = [...new Map(allEdges
      .filter((edge) => edge.fromType === "requirement" && edge.relationshipType === "AFFECTS" && edge.toType === "gate" && edge.toId === gate.id)
      .map((edge) => requirementById.get(edge.fromId))
      .filter((item): item is typeof requirements.$inferSelect => item?.reviewState === "accepted")
      .map((requirement) => [requirement.id, requirement] as const)).values()];
    const proofDetails = acceptedRequirements.map((requirement) => {
      const evidenceIds = [...new Set(allEdges.filter((edge) => edge.fromType === "evidence" && edge.relationshipType === "PROVES" && edge.toType === "requirement" && edge.toId === requirement.id).map((edge) => edge.fromId))];
      const records = evidenceIds.map((id) => evidenceById.get(id)).filter((item): item is typeof evidence.$inferSelect => Boolean(item));
      return { requirementId: requirement.id, statement: requirement.statement, state: proofState(records), evidenceIds: records.map((item) => item.id) } satisfies RequirementProofDetail;
    });
    // Two independent reasons a finding surfaces in the blocker view: severity
    // (high/critical, open) drives the readiness verdict below; overdue (past
    // dueAt, not closed) surfaces at ANY severity purely for visibility and
    // must never change `blockingFindings` — that count feeds computeReadiness
    // and must stay exactly what it was before this reason existed.
    const gateFindings = projectFindings.filter((finding) => finding.gateId === gate.id);
    const severityBlockingFindings = gateFindings.filter((finding) => ["open", "in_progress"].includes(finding.status) && ["high", "critical"].includes(finding.severity));
    const blockingFindingDetails = gateFindings
      .map((finding) => {
        const isSeverityBlocking = ["open", "in_progress"].includes(finding.status) && ["high", "critical"].includes(finding.severity);
        const overdue = isOverdueFinding(finding, evaluatedAt);
        if (!isSeverityBlocking && !overdue) return null;
        const reasons: Array<"severity" | "overdue"> = [];
        if (isSeverityBlocking) reasons.push("severity");
        if (overdue) reasons.push("overdue");
        return { id: finding.id, title: finding.title, severity: finding.severity, ownerId: finding.ownerId, dueAt: finding.dueAt, isOverdue: overdue, reasons };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (a.isOverdue === b.isOverdue ? 0 : a.isOverdue ? -1 : 1));
    const prerequisiteDetails = projectGates.filter((candidate) => candidate.systemId === gate.systemId && Number(candidate.sequenceNumber) < Number(gate.sequenceNumber) && candidate.status !== "approved").map((candidate) => ({ id: candidate.id, name: candidate.name, status: candidate.status }));
    const input = {
      acceptedRequirements: acceptedRequirements.length,
      requiredEvidence: acceptedRequirements.length,
      acceptedEvidence: proofDetails.filter((item) => item.state === "accepted").length,
      missingEvidence: proofDetails.filter((item) => item.state === "missing").length,
      unapprovedEvidence: proofDetails.filter((item) => item.state === "unapproved").length,
      staleEvidence: proofDetails.filter((item) => item.state === "stale").length,
      failedEvidence: proofDetails.filter((item) => item.state === "failed").length,
      blockingFindings: severityBlockingFindings.length,
      unmetPrerequisites: prerequisiteDetails.length
    };
    return { gateId: gate.id, state: computeReadiness(input), ...input, proofDetails, blockingFindingDetails, prerequisiteDetails, evaluatedAt, ruleVersion };
  });
}

export async function getProjectGateReadiness(projectId: string) { return evaluateProject(projectId); }

export async function getGateReadinessDetail(projectId: string, gateId: string) {
  return (await evaluateProject(projectId)).find((item) => item.gateId === gateId) ?? null;
}

export async function persistProjectGateReadiness(projectId: string) {
  const readiness = await evaluateProject(projectId);
  const currentGates = await db.select().from(gates).where(eq(gates.projectId, projectId));
  const currentById = new Map(currentGates.map((gate) => [gate.id, gate]));
  await Promise.all(readiness.map(({ gateId, state }) => {
    const current = currentById.get(gateId);
    if (current?.status === "approved" && state === "ready") return Promise.resolve();
    return db.update(gates).set({ status: state === "unknown" ? "not_started" : state, updatedAt: new Date() }).where(and(eq(gates.projectId, projectId), eq(gates.id, gateId)));
  }));
  return readiness;
}
