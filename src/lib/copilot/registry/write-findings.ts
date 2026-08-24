import { z } from "zod";
import { callProjectRoute } from "@/lib/copilot/invoke";
import type { CopilotTool } from "@/lib/copilot/types";

export const tools: CopilotTool[] = [
  {
    name: "findings.create",
    description: "Create an open finding. Resolve ownerId with members.list first; the owner and due date are required.",
    permission: "finding:manage",
    mutating: true,
    input: z.object({ title: z.string().trim().min(3).max(250), description: z.string().trim().max(5000).optional(), severity: z.enum(["low", "medium", "high", "critical"]), gateId: z.string().uuid().optional(), ownerId: z.string().uuid(), dueAt: z.string().datetime() }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/findings` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/findings`, args, "findingList"); }
  },
  {
    name: "findings.update",
    description: "Update an existing finding using the version returned by findings.list. On a conflict, re-read once; never retry blindly.",
    permission: "finding:manage",
    mutating: true,
    input: z.object({ findingId: z.string().uuid(), expectedVersion: z.number().int().positive(), status: z.enum(["open", "in_progress", "closed"]).optional(), ownerId: z.string().uuid().optional(), dueAt: z.string().datetime().optional(), resolutionNote: z.string().trim().max(5000).optional() }).superRefine((value, context) => {
      if (value.status === "closed" && (!value.resolutionNote || value.resolutionNote.length < 5)) context.addIssue({ code: "custom", message: "Closing a finding requires a resolution note.", path: ["resolutionNote"] });
    }),
    transport: { kind: "http", method: "PATCH", path: (a) => `/api/findings/${a.findingId}` },
    async execute(ctx, args) {
      const { findingId, ...body } = args as { findingId: string; [key: string]: unknown };
      return callProjectRoute(ctx, "PATCH", () => `/api/findings/${findingId}`, body, "findingList");
    }
  }
];
