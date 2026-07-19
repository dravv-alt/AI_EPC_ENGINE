import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  assets,
  auditEvents,
  cxTestRecords,
  documentVersions,
  documents,
  edges,
  evidence,
  findings,
  gates,
  requirements,
  scheduleTasks,
  shipments,
  sourceRegions,
  systems
} from "@/lib/db/schema";

export const graphEntityTypes = ["system", "asset", "gate", "requirement", "evidence", "finding", "schedule_task", "shipment", "cx_test"] as const;
export const graphRelationshipTypes = ["AFFECTS", "PROVES", "PRECEDES", "BLOCKS", "BELONGS_TO", "SUPERSEDES", "DUPLICATE_OF", "GENERATED_FROM"] as const;
export type GraphEntityType = (typeof graphEntityTypes)[number];

export async function graphEntityExists(projectId: string, type: GraphEntityType, id: string) {
  switch (type) {
    case "system": return Boolean(await db.query.systems.findFirst({ where: and(eq(systems.id, id), eq(systems.projectId, projectId)) }));
    case "asset": return Boolean(await db.query.assets.findFirst({ where: and(eq(assets.id, id), eq(assets.projectId, projectId)) }));
    case "gate": return Boolean(await db.query.gates.findFirst({ where: and(eq(gates.id, id), eq(gates.projectId, projectId)) }));
    case "requirement": return Boolean(await db.query.requirements.findFirst({ where: and(eq(requirements.id, id), eq(requirements.projectId, projectId)) }));
    case "evidence": return Boolean(await db.query.evidence.findFirst({ where: and(eq(evidence.id, id), eq(evidence.projectId, projectId)) }));
    case "finding": return Boolean(await db.query.findings.findFirst({ where: and(eq(findings.id, id), eq(findings.projectId, projectId)) }));
    case "schedule_task": return Boolean(await db.query.scheduleTasks.findFirst({ where: and(eq(scheduleTasks.id, id), eq(scheduleTasks.projectId, projectId)) }));
    case "shipment": return Boolean(await db.query.shipments.findFirst({ where: and(eq(shipments.id, id), eq(shipments.projectId, projectId)) }));
    case "cx_test": return Boolean(await db.query.cxTestRecords.findFirst({ where: and(eq(cxTestRecords.id, id), eq(cxTestRecords.projectId, projectId)) }));
  }
}

export async function getProjectGraph(projectId: string) {
  const [edgeRows, systemRows, assetRows, gateRows, requirementRows, evidenceRows, findingRows, taskRows, shipmentRows, testRows] = await Promise.all([
    db.select().from(edges).where(eq(edges.projectId, projectId)),
    db.select().from(systems).where(eq(systems.projectId, projectId)),
    db.select().from(assets).where(eq(assets.projectId, projectId)),
    db.select().from(gates).where(eq(gates.projectId, projectId)),
    db.select().from(requirements).where(eq(requirements.projectId, projectId)),
    db.select().from(evidence).where(eq(evidence.projectId, projectId)),
    db.select().from(findings).where(eq(findings.projectId, projectId)),
    db.select().from(scheduleTasks).where(eq(scheduleTasks.projectId, projectId)),
    db.select().from(shipments).where(eq(shipments.projectId, projectId)),
    db.select().from(cxTestRecords).where(eq(cxTestRecords.projectId, projectId))
  ]);
  const nodes = [
    ...systemRows.map((item) => ({ id: item.id, type: "system", label: item.name, state: item.systemType })),
    ...assetRows.map((item) => ({ id: item.id, type: "asset", label: item.tag, state: item.assetType })),
    ...gateRows.map((item) => ({ id: item.id, type: "gate", label: item.name, state: item.status })),
    ...requirementRows.map((item) => ({ id: item.id, type: "requirement", label: item.statement, state: item.reviewState })),
    ...evidenceRows.map((item) => ({ id: item.id, type: "evidence", label: item.evidenceType, state: item.validityState })),
    ...findingRows.map((item) => ({ id: item.id, type: "finding", label: item.title, state: item.status })),
    ...taskRows.map((item) => ({ id: item.id, type: "schedule_task", label: item.name, state: item.reviewState })),
    ...shipmentRows.map((item) => ({ id: item.id, type: "shipment", label: item.name, state: item.status })),
    ...testRows.map((item) => ({ id: item.id, type: "cx_test", label: `Cx test ${item.id.slice(0, 8)}`, state: item.overallStatus }))
  ];
  return { nodes, edges: edgeRows };
}

/**
 * Expands a single graph node: resolves the edges touching it, the entities on
 * the far side of those edges, and the linked documents / supply records / audit
 * entries that let a reviewer traverse the evidence graph from that node.
 */
export async function expandGraphNode(projectId: string, nodeId: string) {
  const { nodes } = await getProjectGraph(projectId);
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const node = byId.get(nodeId);
  if (!node) return null;

  const [edgeRows, auditRows] = await Promise.all([
    db.select().from(edges).where(and(eq(edges.projectId, projectId), or(eq(edges.fromId, nodeId), eq(edges.toId, nodeId)))),
    db.select().from(auditEvents).where(and(eq(auditEvents.projectId, projectId), eq(auditEvents.entityId, nodeId))).orderBy(desc(auditEvents.createdAt))
  ]);

  const neighbors = edgeRows
    .map((edge) => {
      const otherId = edge.fromId === nodeId ? edge.toId : edge.fromId;
      const other = byId.get(otherId);
      return other ? { edge, node: other } : null;
    })
    .filter((entry): entry is { edge: (typeof edgeRows)[number]; node: (typeof nodes)[number] } => entry !== null);

  // Linked documents: any evidence in the node's neighbourhood (the node itself
  // or a neighbour) resolves through its source region to a document version.
  const scopeNodes = [node, ...neighbors.map((entry) => entry.node)];
  const evidenceIds = scopeNodes.filter((item) => item.type === "evidence").map((item) => item.id);
  const documentRows = evidenceIds.length
    ? await db.select({
        evidenceId: evidence.id,
        documentId: documents.id,
        title: documents.title,
        documentType: documents.documentType,
        revision: documentVersions.revision
      })
      .from(evidence)
      .innerJoin(sourceRegions, eq(evidence.sourceRegionId, sourceRegions.id))
      .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
      .innerJoin(documents, eq(documentVersions.documentId, documents.id))
      .where(inArray(evidence.id, evidenceIds))
    : [];

  // Supply records: shipments in the node's neighbourhood.
  const supply = scopeNodes.filter((item) => item.type === "shipment").map((item) => ({ id: item.id, label: item.label, state: item.state }));

  return { node, neighbors, documents: documentRows, supply, audits: auditRows };
}
