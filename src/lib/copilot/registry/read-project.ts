import { z } from "zod";
import { getDashboardData } from "@/lib/dashboard-data";
import type { CopilotTool } from "@/lib/copilot/types";
import { callProjectRoute } from "@/lib/copilot/invoke";
import { expandGraphNode } from "@/lib/graph/entities";
import { computeEvidenceEntropy } from "@/lib/evidence/entropy";
import { getGateReviewContext } from "@/lib/readiness/gate-context";

/**
 * Wave 2 (A2-2) adds more tools to THIS file: findings.list, members.list,
 * sources.list, graph.node, entropy.score, job.status, readiness.gate_detail.
 * Keep this a plain `export const tools: CopilotTool[] = [ ... ]` array so
 * appending is a one-line addition, not a restructure.
 */
export const tools: CopilotTool[] = [
  {
    name: "project.overview",
    description: "Project name, caller role, gate readiness rows, open finding count, latest schedule version, active alerts.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "lib" },
    async execute(ctx) {
      const data = await getDashboardData(ctx.projectId);
      return { ok: true, data, render: "projectOverview" };
    }
  },
  {
    name: "readiness.gates",
    description: "List every gate in the project with its readiness state.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/gates` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/gates`, args, "gateReadinessTable");
    }
  },
  {
    name: "findings.list",
    description: "List the project's open, in-progress, and closed findings with owner and severity.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/findings` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/findings`, args, "findingList");
    }
  },
  {
    name: "members.list",
    description: "List the project's members with their role — use to resolve a finding owner by name before findings.create.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/members` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/members`, args);
    }
  },
  {
    name: "sources.list",
    description: "List the project's controlled source documents with revision and extraction status.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/sources` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/sources`, args);
    }
  },
  {
    name: "graph.node",
    description: "Expand one project graph node: its neighbors, linked documents, supply records, and audit history.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ nodeId: z.string().uuid() }),
    transport: { kind: "lib" },
    async execute(ctx, args) {
      const { nodeId } = args as { nodeId: string };
      const data = await expandGraphNode(ctx.projectId, nodeId);
      if (!data) return { ok: false, status: 404, error: "Graph node not found in this project." };
      return { ok: true, data };
    }
  },
  {
    name: "entropy.score",
    description: "Advisory evidence-entropy score — NOT a readiness signal. Flags structurally weak evidence (over-reuse, stale/unsigned records, missing calibration, circular edges, low-confidence extraction, overloaded approver). Always label it advisory when presenting it.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "lib" },
    async execute(ctx) {
      const data = await computeEvidenceEntropy(ctx.projectId);
      return { ok: true, data, render: "entropyPanel" };
    }
  },
  {
    name: "job.status",
    description: "Check the status of a background job (e.g. document extraction) by job id.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ jobId: z.string().uuid() }),
    transport: { kind: "http", method: "GET", path: (a) => `/api/jobs/${a.jobId}` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/jobs/${a.jobId}`, args);
    }
  },
  {
    name: "readiness.gate_detail",
    description: "Detailed readiness context for one gate: decision history, affecting schedule tasks, and latest schedule version.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ gateId: z.string().uuid() }),
    transport: { kind: "lib" },
    async execute(ctx, args) {
      const { gateId } = args as { gateId: string };
      const data = await getGateReviewContext(ctx.projectId, gateId);
      if (!data) return { ok: false, status: 404, error: "Gate not found in this project." };
      return { ok: true, data, render: "gateReadinessTable" };
    }
  }
];
