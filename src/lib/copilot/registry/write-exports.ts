import { z } from "zod";
import { callProjectRoute } from "@/lib/copilot/invoke";
import type { CopilotTool } from "@/lib/copilot/types";

const exportInput = z.object({ format: z.enum(["pdf", "csv"]), title: z.string().min(1).max(140), theme: z.enum(["classic", "soft-pop", "midnight", "forest"]).default("classic"), watermark: z.string().max(80).optional(), letterhead: z.string().max(2_800_000).optional(), letterheadName: z.string().max(140).optional() });

export const tools: CopilotTool[] = [
  {
    name: "export.project",
    description: "Prepare a controlled project register export as PDF or CSV. The drawer downloads the returned file automatically and keeps a fallback link.",
    permission: "audit:view", rateLimit: "export", mutating: true,
    input: exportInput,
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/export` },
    async execute(ctx, args) {
      const body = args as z.infer<typeof exportInput>;
      return { ok: true, render: "download", data: { method: "POST", path: `/api/projects/${ctx.projectId}/export`, body, filename: `${body.title}.${body.format}` } };
    }
  },
  {
    name: "export.turnover_pack",
    description: "Generate a turnover pack for an already-approved gate. Requires gate:approve; the signed download expires after 300 seconds.",
    permission: "gate:approve", rateLimit: "export", mutating: true,
    input: z.object({ gateId: z.string().uuid() }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/turnover-packs` },
    async execute(ctx, args) {
      const result = await callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/turnover-packs`, args);
      if (!result.ok) return result;
      const data = result.data as Record<string, unknown>;
      return { ...result, data: { ...data, authority: "recorded", expiresInSeconds: 300 } };
    }
  }
];
