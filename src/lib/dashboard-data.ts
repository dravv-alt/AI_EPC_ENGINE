import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, assets, auditEvents, documentVersions, documents, evidence, findings, gates, projectMembers, requirements, scheduleRisks, scheduleTasks, scheduleVersions, shipments, sourceRegions, systems, users } from "@/lib/db/schema";
import { getProjectGateReadiness, type GateReadiness } from "@/lib/readiness/project-readiness";
import { requireProjectPermission } from "@/lib/projects/access";

export type ReadinessTone = "ready" | "review" | "blocked" | "unknown";

export interface DashboardData {
  projectId: string;
  project: string;
  projectCode: string;
  projectTimezone: string;
  projectUpdatedAt: string;
  gate: string;
  openIssueCount: number;
  systems: Array<{ id: string; name: string; type: string; assetCount: number; gateCount: number; state: ReadinessTone }>;
  metrics: Array<{ label: string; value: string; detail: string; tone: "primary" | "secondary" | "tertiary" }>;
  readiness: Array<{ gateId: string; gate: string; system: string; state: ReadinessTone; detail: string }>;
  sources: Array<{ id: string; title: string; revision: string; status: string; detail: string; firstRegionId: string | null }>;
  actions: Array<{ id: string; title: string; owner: string; due: string; severity: string; status: string; gate: string }>;
  members: Array<{ id: string; name: string; role: string }>;
  timelineTasks: Array<{ id: string; name: string; durationHours: number; earliestStart: string | null; deadline: string | null; reviewState: string }>;
  proposal: { id: string; statement: string; citation: string } | null;
  insights: {
    gateBars: Array<{ id: string; label: string; state: ReadinessTone; percent: number; evidence: string }>;
    evidence: Array<{ label: string; value: number; tone: string }>;
    requirements: Array<{ label: string; value: number; tone: string }>;
    actionSeverity: Array<{ label: string; value: number; tone: string }>;
    operations: {
      shipments: number;
      delayedShipments: number;
      acceptedTasks: number;
      scheduleVersion: number | null;
      scheduleStatus: string;
      activeAlerts: number;
    };
    activity: Array<{ label: string; value: number }>;
    recentActivity: Array<{ id: string; action: string; entityType: string; actor: string; at: string }>;
  };
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

  const [projectGates, projectSystems, projectAssets, projectVersions, projectRegions, projectRequirements, projectFindings, people, memberRows, gateReadiness, projectEvidence, projectShipments, projectTasks, latestSchedule, activeAlerts, recentAudit] = await Promise.all([
    db.select().from(gates).where(eq(gates.projectId, projectId)),
    db.select().from(systems).where(eq(systems.projectId, projectId)),
    db.select().from(assets).where(eq(assets.projectId, projectId)),
    db.select().from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
    db.select().from(sourceRegions).innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id)).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)),
    db.select().from(findings).where(eq(findings.projectId, projectId)).orderBy(desc(findings.createdAt)),
    db.select().from(users),
    db.select({ id: users.id, name: users.displayName, role: projectMembers.role }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId)),
    getProjectGateReadiness(projectId),
    db.select().from(evidence).where(eq(evidence.projectId, projectId)),
    db.select().from(shipments).where(eq(shipments.projectId, projectId)),
    db.select().from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)),
    db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.projectId, projectId), orderBy: [desc(scheduleVersions.versionNumber)] }),
    db.select().from(alerts).where(eq(alerts.projectId, projectId)),
    db.select().from(auditEvents).where(eq(auditEvents.projectId, projectId)).orderBy(desc(auditEvents.createdAt)).limit(200)
  ]);

  const systemById = new Map(projectSystems.map((system) => [system.id, system.name]));
  const readinessByGate = new Map(gateReadiness.map((item) => [item.gateId, item]));
  const gateNameById = new Map(projectGates.map((gate) => [gate.id, gate.name]));
  const currentGate = projectGates.slice().sort((a, b) => Number(b.sequenceNumber) - Number(a.sequenceNumber))[0];
  const acceptedEvidence = gateReadiness.reduce((total, item) => total + item.acceptedEvidence, 0);
  const requiredEvidence = gateReadiness.reduce((total, item) => total + item.requiredEvidence, 0);
  const staleEvidence = gateReadiness.reduce((total, item) => total + item.staleEvidence, 0);
  const blockers = gateReadiness.reduce((total, item) => total + item.blockingFindings, 0);
  const readyGateCount = gateReadiness.filter((item) => item.state === "ready").length;
  const readinessPercent = projectGates.length === 0 ? 0 : Math.round((readyGateCount / projectGates.length) * 100);
  const regionCountByVersion = new Map<string, number>();
  const firstRegionByVersion = new Map<string, string>();
  projectRegions.forEach(({ source_regions }) => regionCountByVersion.set(source_regions.documentVersionId, (regionCountByVersion.get(source_regions.documentVersionId) ?? 0) + 1));
  projectRegions.forEach(({ source_regions }) => {
    if (!firstRegionByVersion.has(source_regions.documentVersionId)) firstRegionByVersion.set(source_regions.documentVersionId, source_regions.id);
  });
  const ownerById = new Map(people.map((person) => [person.id, person.displayName]));
  const regionsById = new Map(projectRegions.map(({ source_regions, document_versions, documents }) => [source_regions.id, { source_regions, document_versions, documents }]));
  const proposal = projectRequirements.find((requirement) => requirement.reviewState === "proposed");
  const actionableFindings = projectFindings.filter((finding) => ["open", "in_progress"].includes(finding.status));
  const countBy = <T,>(items: T[], read: (item: T) => string, value: string) => items.filter((item) => read(item) === value).length;
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return {
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      value: recentAudit.filter((event) => event.createdAt >= date && event.createdAt < next).length
    };
  });

  return {
    projectId,
    project: project.name,
    projectCode: project.code,
    projectTimezone: project.timezone,
    projectUpdatedAt: project.updatedAt.toISOString(),
    gate: currentGate?.name ?? "No gate configured",
    openIssueCount: actionableFindings.length,
    systems: projectSystems.map((system) => {
      const systemGates = projectGates.filter((gate) => gate.systemId === system.id);
      const states = systemGates.map((gate) => gateReadiness.find((item) => item.gateId === gate.id)?.state);
      const state: ReadinessTone = states.includes("blocked") ? "blocked" : states.includes("in_review") ? "review" : states.length > 0 && states.every((item) => item === "ready") ? "ready" : "unknown";
      return { id: system.id, name: system.name, type: system.systemType, assetCount: projectAssets.filter((asset) => asset.systemId === system.id).length, gateCount: systemGates.length, state };
    }).sort((a, b) => a.name.localeCompare(b.name)),
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
      detail: `${regionCountByVersion.get(document_versions.id) ?? 0} cited region${(regionCountByVersion.get(document_versions.id) ?? 0) === 1 ? "" : "s"}`,
      firstRegionId: firstRegionByVersion.get(document_versions.id) ?? null
    })),
    actions: actionableFindings.slice(0, 8).map((finding) => ({ id: finding.id, title: finding.title, owner: finding.ownerId ? ownerById.get(finding.ownerId) ?? "Unassigned" : "Unassigned", due: finding.dueAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(finding.dueAt) : "Unscheduled", severity: finding.severity, status: finding.status, gate: finding.gateId ? gateNameById.get(finding.gateId) ?? "Linked gate" : "Project-wide" })),
    members: memberRows,
    timelineTasks: projectTasks.slice().sort((a, b) => (a.earliestStart?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.earliestStart?.getTime() ?? Number.MAX_SAFE_INTEGER)).map((task) => ({ id: task.id, name: task.name, durationHours: task.durationHours, earliestStart: task.earliestStart?.toISOString() ?? null, deadline: task.deadline?.toISOString() ?? null, reviewState: task.reviewState })),
    proposal: proposal ? { id: proposal.id, statement: proposal.statement, citation: (() => { const region = regionsById.get(proposal.sourceRegionId); return region ? `${region.documents.title} · p. ${region.source_regions.pageNumber}` : "Controlled source unavailable"; })() } : null,
    insights: {
      gateBars: projectGates.slice().sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).map((gate) => {
        const state = readinessByGate.get(gate.id);
        const percent = !state?.requiredEvidence ? state?.state === "ready" ? 100 : 0 : Math.min(100, Math.round((state.acceptedEvidence / state.requiredEvidence) * 100));
        return { id: gate.id, label: gate.name, state: state ? stateTone(state.state) : "unknown", percent, evidence: `${state?.acceptedEvidence ?? 0}/${state?.requiredEvidence ?? 0}` };
      }),
      evidence: [
        { label: "Accepted", value: countBy(projectEvidence, (item) => item.validityState, "accepted"), tone: "ready" },
        { label: "Pending", value: countBy(projectEvidence, (item) => item.validityState, "pending"), tone: "review" },
        { label: "Stale / failed", value: projectEvidence.filter((item) => ["stale", "failed", "rejected"].includes(item.validityState)).length, tone: "blocked" }
      ],
      requirements: [
        { label: "Accepted", value: countBy(projectRequirements, (item) => item.reviewState, "accepted"), tone: "ready" },
        { label: "Proposed", value: countBy(projectRequirements, (item) => item.reviewState, "proposed"), tone: "review" },
        { label: "Edited / rejected", value: projectRequirements.filter((item) => ["edited", "rejected"].includes(item.reviewState)).length, tone: "unknown" }
      ],
      actionSeverity: ["critical", "high", "medium", "low"].map((severity) => ({ label: severity, value: actionableFindings.filter((item) => item.severity === severity).length, tone: severity })),
      operations: {
        shipments: projectShipments.length,
        delayedShipments: projectShipments.filter((item) => ["amber", "red"].includes(item.status)).length,
        acceptedTasks: projectTasks.filter((item) => item.reviewState === "accepted").length,
        scheduleVersion: latestSchedule?.versionNumber ?? null,
        scheduleStatus: latestSchedule?.solverStatus ?? "No baseline",
        activeAlerts: activeAlerts.filter((item) => item.status === "active").length
      },
      activity: activityDays,
      recentActivity: recentAudit.slice(0, 6).map((event) => ({
        id: event.id,
        action: event.action.replaceAll("_", " ").replaceAll(".", " · "),
        entityType: event.entityType.replaceAll("_", " "),
        actor: event.actorId ? ownerById.get(event.actorId) ?? "Project member" : "System",
        at: event.createdAt.toISOString()
      }))
    }
  };
}
