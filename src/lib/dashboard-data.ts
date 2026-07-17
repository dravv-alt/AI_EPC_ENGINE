import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, documents, findings, gates, requirements, sourceRegions, systems, users } from "@/lib/db/schema";
import { getProjectGateReadiness, type GateReadiness } from "@/lib/readiness/project-readiness";
import { requireProjectPermission } from "@/lib/projects/access";

export type ReadinessTone = "ready" | "review" | "blocked" | "unknown";

export interface DashboardData {
  projectId: string;
  project: string;
  gate: string;
  metrics: Array<{ label: string; value: string; detail: string; tone: "primary" | "secondary" | "tertiary" }>;
  readiness: Array<{ gateId: string; gate: string; system: string; state: ReadinessTone; detail: string }>;
  sources: Array<{ title: string; revision: string; status: string; detail: string }>;
  actions: Array<{ title: string; owner: string; due: string; severity: string }>;
  proposal: { id: string; statement: string; citation: string } | null;
}

function stateTone(readiness: GateReadiness["state"]): ReadinessTone {
  return readiness === "in_review" ? "review" : readiness;
}

function readinessDetail(item: GateReadiness) {
  if (item.state === "blocked") return `${item.blockingFindings} blocking finding${item.blockingFindings === 1 ? "" : "s"}`;
  if (item.state === "unknown") return "No accepted requirements mapped";
  if (item.state === "in_review") return `${item.acceptedEvidence} / ${item.requiredEvidence} accepted evidence`;
  return `${item.acceptedEvidence} accepted evidence records`;
}

export async function getDashboardData(projectId: string): Promise<DashboardData | null> {
  await requireProjectPermission(projectId, "audit:view");
  const project = await db.query.projects.findFirst({ where: (projects, { eq }) => eq(projects.id, projectId) });
  if (!project) return null;

  const [projectGates, projectSystems, projectVersions, projectRegions, projectRequirements, projectFindings, people, gateReadiness] = await Promise.all([
    db.select().from(gates).where(eq(gates.projectId, projectId)),
    db.select().from(systems).where(eq(systems.projectId, projectId)),
    db.select().from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
    db.select().from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)),
    db.select().from(findings).where(eq(findings.projectId, projectId)).orderBy(desc(findings.createdAt)),
    db.select().from(users),
    getProjectGateReadiness(projectId)
  ]);

  const systemById = new Map(projectSystems.map((system) => [system.id, system.name]));
  const readinessByGate = new Map(gateReadiness.map((item) => [item.gateId, item]));
  const currentGate = projectGates.slice().sort((a, b) => Number(b.sequenceNumber) - Number(a.sequenceNumber))[0];
  const acceptedEvidence = gateReadiness.reduce((total, item) => total + item.acceptedEvidence, 0);
  const requiredEvidence = gateReadiness.reduce((total, item) => total + item.requiredEvidence, 0);
  const staleEvidence = gateReadiness.reduce((total, item) => total + item.staleEvidence, 0);
  const blockers = gateReadiness.reduce((total, item) => total + item.blockingFindings, 0);
  const readyGateCount = gateReadiness.filter((item) => item.state === "ready").length;
  const readinessPercent = projectGates.length === 0 ? 0 : Math.round((readyGateCount / projectGates.length) * 100);
  const regionCountByVersion = new Map<string, number>();
  projectRegions.forEach(({ source_regions }) => regionCountByVersion.set(source_regions.documentVersionId, (regionCountByVersion.get(source_regions.documentVersionId) ?? 0) + 1));
  const ownerById = new Map(people.map((person) => [person.id, person.displayName]));
  const regionsById = new Map(projectRegions.map(({ source_regions, document_versions, documents }) => [source_regions.id, { source_regions, document_versions, documents }]));
  const proposal = projectRequirements.find((requirement) => requirement.reviewState === "proposed");

  return {
    projectId,
    project: project.name,
    gate: currentGate?.name ?? "No gate configured",
    metrics: [
      { label: "Gate readiness", value: `${readinessPercent}%`, detail: blockers ? `${blockers} blocker${blockers === 1 ? "" : "s"} remain` : `${readyGateCount} gate${readyGateCount === 1 ? "" : "s"} ready`, tone: "primary" },
      { label: "Accepted evidence", value: `${acceptedEvidence} / ${requiredEvidence}`, detail: staleEvidence ? `${staleEvidence} stale record${staleEvidence === 1 ? "" : "s"}` : "No stale records", tone: "secondary" },
      { label: "Open actions", value: String(projectFindings.filter((finding) => finding.status !== "closed").length), detail: `${projectFindings.filter((finding) => ["high", "critical"].includes(finding.severity) && finding.status !== "closed").length} high-priority`, tone: "tertiary" }
    ],
    readiness: projectGates.slice().sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).map((gate) => {
      const state = readinessByGate.get(gate.id) ?? { state: "unknown", acceptedEvidence: 0, requiredEvidence: 0, staleEvidence: 0, failedEvidence: 0, blockingFindings: 0, acceptedRequirements: 0, gateId: gate.id };
      return { gateId: gate.id, gate: gate.name, system: systemById.get(gate.systemId) ?? "Unassigned system", state: stateTone(state.state), detail: readinessDetail(state) };
    }),
    sources: projectVersions.slice().sort((a, b) => b.document_versions.createdAt.getTime() - a.document_versions.createdAt.getTime()).slice(0, 5).map(({ document_versions, documents }) => ({
      title: documents.title,
      revision: document_versions.revision,
      status: document_versions.extractionStatus === "completed" ? "Processed" : document_versions.extractionStatus === "failed" ? "Needs attention" : "Processing",
      detail: `${regionCountByVersion.get(document_versions.id) ?? 0} cited region${(regionCountByVersion.get(document_versions.id) ?? 0) === 1 ? "" : "s"}`
    })),
    actions: projectFindings.filter((finding) => finding.status !== "closed").slice(0, 5).map((finding) => ({ title: finding.title, owner: finding.ownerId ? ownerById.get(finding.ownerId) ?? "Unassigned" : "Unassigned", due: finding.dueAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(finding.dueAt) : "Unscheduled", severity: finding.severity })),
    proposal: proposal ? { id: proposal.id, statement: proposal.statement, citation: (() => { const region = regionsById.get(proposal.sourceRegionId); return region ? `${region.documents.title} · p. ${region.source_regions.pageNumber}` : "Controlled source unavailable"; })() } : null
  };
}
