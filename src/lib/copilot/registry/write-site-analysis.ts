import { z } from "zod";
import { callProjectRoute } from "@/lib/copilot/invoke";
import type { CopilotTool } from "@/lib/copilot/types";
const siteInput = z.object({ answers: z.record(z.string().max(80), z.string().max(2000)), completedSections: z.array(z.string().max(60)).max(16), sourceMetadata: z.object({ csvFileName: z.string().max(300).optional(), importedRows: z.number().int().nonnegative().optional(), importedAt: z.string().datetime().optional() }).default({}), status: z.enum(["draft", "review"]).default("draft") });
export const tools: CopilotTool[] = [
  { name: "site_analysis.save", description: "Save Site Analysis answers as a draft or review package.", permission: "configuration:manage", mutating: true, input: siteInput, transport: { kind: "http", method: "PUT", path: (a) => `/api/projects/${a.projectId}/site-analysis` }, async execute(ctx, args) { return callProjectRoute(ctx, "PUT", (a) => `/api/projects/${a.projectId}/site-analysis`, args); } },
  { name: "site_analysis.insights", description: "Generate deterministic Site Analysis planning insights; AI summary is advisory when requested.", permission: "audit:view", rateLimit: "ai", mutating: true, input: z.object({ includeAi: z.boolean().default(true) }), transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/site-analysis/insights` }, async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/site-analysis/insights`, args, "projectOverview"); } }
];
