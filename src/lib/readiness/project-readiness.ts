import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { edges, evidence, findings, gates, requirements } from "@/lib/db/schema";
import { computeReadiness, type ReadinessState } from "@/lib/readiness/compute";

export interface GateReadiness {
  gateId: string;
  state: ReadinessState;
  acceptedRequirements: number;
  requiredEvidence: number;
  acceptedEvidence: number;
  staleEvidence: number;
  failedEvidence: number;
  blockingFindings: number;
}

export async function getProjectGateReadiness(projectId: string): Promise<GateReadiness[]> {
  const projectGates = await db.select().from(gates).where(eq(gates.projectId, projectId));
  const projectRequirements = await db.select().from(requirements).where(eq(requirements.projectId, projectId));
  const requirementIds = projectRequirements.map((item) => item.id);
  const allEdges = await db.select().from(edges).where(eq(edges.projectId, projectId));
  const projectEvidence = await db.select().from(evidence).where(eq(evidence.projectId, projectId));
  const projectFindings = await db.select().from(findings).where(eq(findings.projectId, projectId));

  return projectGates.map((gate) => {
    const gateRequirementIds = new Set(
      allEdges
        .filter((edge) => edge.fromType === "requirement" && edge.toType === "gate" && edge.toId === gate.id && requirementIds.includes(edge.fromId))
        .map((edge) => edge.fromId)
    );
    const acceptedRequirementIds = new Set(
      projectRequirements.filter((requirement) => gateRequirementIds.has(requirement.id) && requirement.reviewState === "accepted").map((requirement) => requirement.id)
    );
    const proofEdges = allEdges.filter((edge) => edge.fromType === "evidence" && edge.toType === "requirement" && acceptedRequirementIds.has(edge.toId));
    const evidenceIds = new Set(proofEdges.map((edge) => edge.fromId));
    const relevantEvidence = projectEvidence.filter((item) => evidenceIds.has(item.id));
    const blockingFindings = projectFindings.filter((finding) => finding.gateId === gate.id && finding.status !== "closed" && ["high", "critical"].includes(finding.severity)).length;
    const input = {
      acceptedRequirements: acceptedRequirementIds.size,
      requiredEvidence: acceptedRequirementIds.size,
      acceptedEvidence: relevantEvidence.filter((item) => item.validityState === "accepted").length,
      staleEvidence: relevantEvidence.filter((item) => item.validityState === "stale").length,
      failedEvidence: relevantEvidence.filter((item) => item.validityState === "failed").length,
      blockingFindings
    };

    return { gateId: gate.id, state: computeReadiness(input), ...input };
  });
}

export async function persistProjectGateReadiness(projectId: string) {
  const readiness = await getProjectGateReadiness(projectId);
  await Promise.all(readiness.map(({ gateId, state }) => db.update(gates).set({ status: state === "unknown" ? "not_started" : state }).where(and(eq(gates.projectId, projectId), eq(gates.id, gateId)))));
  return readiness;
}
