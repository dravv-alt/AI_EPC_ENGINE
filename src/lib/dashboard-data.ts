import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, documents, findings, gates, requirements, scheduleRisks, scheduleTasks, scheduleVersions, shipments, sourceRegions, systems, users } from "@/lib/db/schema";
import { getProjectGateReadiness, type GateReadiness } from "@/lib/readiness/project-readiness";
import { requireProjectPermission } from "@/lib/projects/access";

export type ReadinessTone = "ready" | "review" | "blocked" | "unknown";

export interface DashboardData {
  projectId: string;
  project: string;
  gate: string;
  metrics: Array<{ label: string; value: string; detail: string; tone: "primary" | "secondary" | "tertiary" }>;
  readiness: Array<{ gateId: string; gate: string; system: string; state: ReadinessTone; detail: string }>;
  sources: Array<{ id: string; title: string; revision: string; status: string; detail: string }>;
  actions: Array<{ id: string; title: string; owner: string; due: string; severity: string }>;
  proposal: { id: string; statement: string; citation: string } | null;
}

export interface AlertLink { href: string; label: string }

export interface AlertRow { id: string; projectId: string; eventType: string; dedupKey: string; status: string; title: string; payload: unknown; createdAt: Date }

export interface ResolvedAlert { alert: AlertRow; links: AlertLink[] }

// Slice 10: resolve each Command Center alert to deep-links pointing at the real
// records it concerns. Link targets are validated against live rows so a stale
// payload never renders a dead link. Hrefs point at existing routes with a query
// param the destination can consume.
export async function resolveAlertLinks(projectId: string, alertRows: AlertRow[]): Promise<ResolvedAlert[]> {
  const findingIds = new Set<string>();
  const gateIds = new Set<string>();
  const taskIds = new Set<string>();
  const riskIds = new Set<string>();
  const shipmentIds = new Set<string>();
  const readPayload = (alert: AlertRow) => (alert.payload && typeof alert.payload === "object" ? alert.payload as Record<string, unknown> : {});
  for (const alert of alertRows) {
    const payload = readPayload(alert);
    if (alert.eventType === "TEST_FAILED") { if (typeof payload.findingId === "string") findingIds.add(payload.findingId); if (typeof payload.gateId === "string") gateIds.add(payload.gateId); }
    if (alert.eventType === "SHIPMENT_DELAYED") {
      if (typeof payload.shipmentId === "string") shipmentIds.add(payload.shipmentId);
      if (Array.isArray(payload.affectedTaskIds)) for (const id of payload.affectedTaskIds) if (typeof id === "string") taskIds.add(id);
    }
    if (alert.eventType === "predicted_risk_delay") { if (typeof payload.riskId === "string") riskIds.add(payload.riskId); if (Array.isArray(payload.affectedTaskIds)) for (const id of payload.affectedTaskIds) if (typeof id === "string") taskIds.add(id); }
  }

  const [findingRows, gateRows, taskRows, riskRows, shipmentRows, latestVersion] = await Promise.all([
    findingIds.size ? db.select({ id: findings.id, title: findings.title }).from(findings).where(eq(findings.projectId, projectId)) : Promise.resolve([]),
    gateIds.size ? db.select({ id: gates.id, name: gates.name }).from(gates).where(eq(gates.projectId, projectId)) : Promise.resolve([]),
    taskIds.size ? db.select({ id: scheduleTasks.id, name: scheduleTasks.name }).from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)) : Promise.resolve([]),
    riskIds.size ? db.select({ id: scheduleRisks.id, mitigationOptions: scheduleRisks.mitigationOptions }).from(scheduleRisks).where(eq(scheduleRisks.projectId, projectId)) : Promise.resolve([]),
    shipmentIds.size ? db.select({ id: shipments.id, name: shipments.name }).from(shipments).where(eq(shipments.projectId, projectId)) : Promise.resolve([]),
    db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, projectId), orderBy: [desc(scheduleVersions.versionNumber)] })
  ]);
  const findingById = new Map(findingRows.map((row) => [row.id, row.title]));
  const gateById = new Map(gateRows.map((row) => [row.id, row.name]));
  const taskById = new Map(taskRows.map((row) => [row.id, row.name]));
  const riskById = new Map(riskRows.map((row) => [row.id, row.mitigationOptions]));
  const shipmentById = new Map(shipmentRows.map((row) => [row.id, row.name]));

  return alertRows.map((alert) => {
    const payload = readPayload(alert);
    const links: AlertLink[] = [];
    if (alert.eventType === "TEST_FAILED") {
      if (typeof payload.findingId === "string" && findingById.has(payload.findingId)) links.push({ href: `/actions?finding=${payload.findingId}`, label: `Finding: ${findingById.get(payload.findingId)}` });
      if (typeof payload.gateId === "string" && gateById.has(payload.gateId)) links.push({ href: `/readiness?gate=${payload.gateId}`, label: `Gate: ${gateById.get(payload.gateId)}` });
    }
    if (alert.eventType === "SHIPMENT_DELAYED") {
      if (typeof payload.shipmentId === "string" && shipmentById.has(payload.shipmentId)) links.push({ href: `/shipments?shipment=${payload.shipmentId}`, label: `Shipment: ${shipmentById.get(payload.shipmentId)}` });
      if (Array.isArray(payload.affectedTaskIds)) for (const id of payload.affectedTaskIds) if (typeof id === "string" && taskById.has(id)) links.push({ href: `/schedule?task=${id}`, label: `Affected task: ${taskById.get(id)}` });
      if (latestVersion) links.push({ href: `/schedule?version=${latestVersion.id}`, label: `Current schedule v${latestVersion.versionNumber}` });
    }
    if (alert.eventType === "predicted_risk_delay") {
      if (Array.isArray(payload.affectedTaskIds)) for (const id of payload.affectedTaskIds) if (typeof id === "string" && taskById.has(id)) links.push({ href: `/schedule?task=${id}`, label: `At-risk task: ${taskById.get(id)}` });
      if (typeof payload.riskId === "string" && riskById.has(payload.riskId)) {
        const options = riskById.get(payload.riskId);
        const first = Array.isArray(options) ? (options[0] as { label?: string } | undefined) : undefined;
        links.push({ href: `/schedule?risk=${payload.riskId}`, label: `Mitigation: ${first?.label ?? "review options"}` });
      }
    }
    return { alert, links };
  });
}

function stateTone(readiness: GateReadiness["state"]): ReadinessTone {
  return readiness === "in_review" ? "review" : readiness;
}

function readinessDetail(item: GateReadiness) {
  if (item.state === "blocked") return item.blockingFindings ? `${item.blockingFindings} blocking finding${item.blockingFindings === 1 ? "" : "s"}` : item.unmetPrerequisites ? `${item.unmetPrerequisites} prerequisite gate${item.unmetPrerequisites === 1 ? "" : "s"} incomplete` : `${item.failedEvidence} failed proof record${item.failedEvidence === 1 ? "" : "s"}`;
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
  const actionableFindings = projectFindings.filter((finding) => ["open", "in_progress"].includes(finding.status));

  return {
    projectId,
    project: project.name,
    gate: currentGate?.name ?? "No gate configured",
    metrics: [
      { label: "Gate readiness", value: `${readinessPercent}%`, detail: blockers ? `${blockers} blocker${blockers === 1 ? "" : "s"} remain` : `${readyGateCount} gate${readyGateCount === 1 ? "" : "s"} ready`, tone: "primary" },
      { label: "Accepted evidence", value: `${acceptedEvidence} / ${requiredEvidence}`, detail: staleEvidence ? `${staleEvidence} stale record${staleEvidence === 1 ? "" : "s"}` : "No stale records", tone: "secondary" },
      { label: "Open actions", value: String(actionableFindings.length), detail: `${actionableFindings.filter((finding) => ["high", "critical"].includes(finding.severity)).length} high-priority`, tone: "tertiary" }
    ],
    readiness: projectGates.slice().sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).map((gate) => {
      const state = readinessByGate.get(gate.id) ?? { state: "unknown", acceptedEvidence: 0, requiredEvidence: 0, missingEvidence: 0, unapprovedEvidence: 0, staleEvidence: 0, failedEvidence: 0, blockingFindings: 0, unmetPrerequisites: 0, acceptedRequirements: 0, gateId: gate.id, proofDetails: [], blockingFindingDetails: [], prerequisiteDetails: [], evaluatedAt: new Date(), ruleVersion: "readiness-v2.1" };
      return { gateId: gate.id, gate: gate.name, system: systemById.get(gate.systemId) ?? "Unassigned system", state: stateTone(state.state), detail: readinessDetail(state) };
    }),
    sources: projectVersions.slice().sort((a, b) => b.document_versions.createdAt.getTime() - a.document_versions.createdAt.getTime()).slice(0, 5).map(({ document_versions, documents }) => ({
      id: document_versions.id,
      title: documents.title,
      revision: document_versions.revision,
      status: document_versions.extractionStatus === "completed" ? "Processed" : document_versions.extractionStatus === "failed" ? "Needs attention" : "Processing",
      detail: `${regionCountByVersion.get(document_versions.id) ?? 0} cited region${(regionCountByVersion.get(document_versions.id) ?? 0) === 1 ? "" : "s"}`
    })),
    actions: actionableFindings.slice(0, 5).map((finding) => ({ id: finding.id, title: finding.title, owner: finding.ownerId ? ownerById.get(finding.ownerId) ?? "Unassigned" : "Unassigned", due: finding.dueAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(finding.dueAt) : "Unscheduled", severity: finding.severity })),
    proposal: proposal ? { id: proposal.id, statement: proposal.statement, citation: (() => { const region = regionsById.get(proposal.sourceRegionId); return region ? `${region.documents.title} · p. ${region.source_regions.pageNumber}` : "Controlled source unavailable"; })() } : null
  };
}
