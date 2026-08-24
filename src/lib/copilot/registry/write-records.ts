import { z } from "zod";
import { callProjectRoute } from "@/lib/copilot/invoke";
import type { CopilotTool } from "@/lib/copilot/types";
import { graphEntityTypes, graphRelationshipTypes } from "@/lib/graph/entities";
import { claimTypeValues } from "@/lib/evidence/claim-taxonomy";

export const tools: CopilotTool[] = [
  {
    name: "records.create_system", description: "Create a project system. Names must be unique within the project.", permission: "configuration:manage", mutating: true,
    input: z.object({ name: z.string().trim().min(2).max(200), systemType: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9 _-]+$/) }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/systems` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/systems`, args); }
  },
  {
    name: "records.create_asset", description: "Create a project asset. Its system must belong to the active project and its tag must be unique.", permission: "configuration:manage", mutating: true,
    input: z.object({ systemId: z.string().uuid(), tag: z.string().trim().min(2).max(120), assetType: z.string().trim().min(2).max(100), vendor: z.string().trim().max(200).optional() }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/assets` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/assets`, args); }
  },
  {
    name: "records.create_gate", description: "Create a gate for an in-project system. The name must be unique for that system.", permission: "configuration:manage", mutating: true,
    input: z.object({ systemId: z.string().uuid(), name: z.string().trim().min(2).max(120), sequenceNumber: z.coerce.number().int().min(0).max(9999), approvalRole: z.enum(["admin", "commissioning_manager", "reviewer", "field_engineer", "approver", "viewer", "scheduler"]).default("approver") }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/gates` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/gates`, args, "gateReadinessTable"); }
  },
  {
    name: "records.create_edge", description: "Create a non-self-referential graph edge after confirming both endpoints are in the active project.", permission: "graph:manage", mutating: true,
    input: z.object({ fromType: z.enum(graphEntityTypes), fromId: z.string().uuid(), relationshipType: z.enum(graphRelationshipTypes), toType: z.enum(graphEntityTypes), toId: z.string().uuid() }).refine((value) => value.fromId !== value.toId, { message: "Self-referential edges are not allowed." }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/edges` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/edges`, args); }
  },
  {
    name: "claims.create", description: "Create a proposed-only evidence claim linked to one or more in-project evidence records.", permission: "evidence:capture", mutating: true,
    input: z.object({ claimType: z.enum(claimTypeValues), metricKey: z.string().trim().min(2).max(120), value: z.coerce.number().finite().optional(), unit: z.string().trim().max(40).optional(), statement: z.string().trim().min(12).max(4000), evidenceIds: z.array(z.string().uuid()).min(1).max(25) }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/claims` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/claims`, args); }
  }
];
