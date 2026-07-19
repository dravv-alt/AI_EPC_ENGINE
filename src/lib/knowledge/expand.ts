import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evidence, requirements } from "@/lib/db/schema";
import { getProjectGraph } from "@/lib/graph/entities";
import type { SemanticCitation } from "@/lib/knowledge/query";

export interface GraphContextEntry {
  id: string;
  type: string;
  label: string;
  state: string;
  relationshipType: string;
  anchorType: "requirement" | "evidence";
  anchorId: string;
}

const MAX_CONTEXT_PER_CHUNK = 5;

// Deterministic, no LLM. A retrieved chunk's source_region_id is not itself a
// graph node, but a requirement or evidence record citing that exact region is
// — so those records are the anchors, and edges touching them (AFFECTS,
// PROVES, etc.) surface one hop of project-scoped context per citation,
// capped at MAX_CONTEXT_PER_CHUNK. The whole project graph is fetched once
// per call (not once per citation) since getProjectGraph is already
// project-scoped and citations here always belong to one project.
export async function expandWithGraphContext(projectId: string, citations: SemanticCitation[]): Promise<Map<string, GraphContextEntry[]>> {
  const result = new Map<string, GraphContextEntry[]>();
  const sourceRegionIds = [...new Set(citations.map((citation) => citation.sourceRegionId).filter((id): id is string => Boolean(id)))];
  if (!sourceRegionIds.length) return result;

  const [requirementRows, evidenceRows, graph] = await Promise.all([
    db.select({ id: requirements.id, sourceRegionId: requirements.sourceRegionId }).from(requirements).where(and(eq(requirements.projectId, projectId), inArray(requirements.sourceRegionId, sourceRegionIds))),
    db.select({ id: evidence.id, sourceRegionId: evidence.sourceRegionId }).from(evidence).where(and(eq(evidence.projectId, projectId), inArray(evidence.sourceRegionId, sourceRegionIds))),
    getProjectGraph(projectId)
  ]);

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const anchorsByRegion = new Map<string, Array<{ id: string; type: "requirement" | "evidence" }>>();
  const addAnchor = (sourceRegionId: string | null, id: string, type: "requirement" | "evidence") => {
    if (!sourceRegionId) return;
    const list = anchorsByRegion.get(sourceRegionId) ?? [];
    list.push({ id, type });
    anchorsByRegion.set(sourceRegionId, list);
  };
  for (const row of requirementRows) addAnchor(row.sourceRegionId, row.id, "requirement");
  for (const row of evidenceRows) addAnchor(row.sourceRegionId, row.id, "evidence");

  for (const citation of citations) {
    const anchors = anchorsByRegion.get(citation.sourceRegionId) ?? [];
    const entries: GraphContextEntry[] = [];
    outer: for (const anchor of anchors) {
      const relatedEdges = graph.edges.filter((edge) => edge.fromId === anchor.id || edge.toId === anchor.id);
      for (const edge of relatedEdges) {
        if (entries.length >= MAX_CONTEXT_PER_CHUNK) break outer;
        const otherId = edge.fromId === anchor.id ? edge.toId : edge.fromId;
        const otherNode = nodeById.get(otherId);
        if (!otherNode) continue;
        entries.push({ id: otherNode.id, type: otherNode.type, label: otherNode.label, state: otherNode.state, relationshipType: edge.relationshipType, anchorType: anchor.type, anchorId: anchor.id });
      }
    }
    result.set(citation.chunkId, entries);
  }
  return result;
}
