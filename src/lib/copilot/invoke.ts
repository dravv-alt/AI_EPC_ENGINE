import { writeAuditEvent } from "@/lib/audit/write-event";
import { env } from "@/lib/env";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit, enforceExportRateLimit, enforceScheduleRateLimit, enforceUploadRateLimit } from "@/lib/redis/rate-limit";
import { copilotTools } from "@/lib/copilot/registry";
import type { CopilotContext, CopilotToolResult } from "@/lib/copilot/types";

/**
 * HTTP-dispatch convention (binding for every later HTTP-transport tool, all
 * waves): `CopilotTool.transport` is metadata only — used for introspection
 * (Slice 13's forbidden-route checks), never auto-dispatched on by invokeTool.
 * `execute()` always performs the real work, for BOTH transport kinds.
 * HTTP-kind tools call this shared helper from inside their own `execute`, so
 * their `execute` body stays a one-liner. `path()` is always invoked with the
 * parsed args merged with `{ projectId: ctx.projectId }`, so every tool's
 * `path` function can reference `a.projectId` uniformly regardless of whether
 * the tool's own input schema needs a projectId field.
 */
export async function callProjectRoute(
  ctx: CopilotContext,
  method: string,
  path: (a: any) => string,
  args: unknown,
  render?: string
): Promise<CopilotToolResult> {
  const url = `${env.APP_BASE_URL}${path({ ...(args as Record<string, unknown>), projectId: ctx.projectId })}`;
  const response = await fetch(url, {
    method,
    headers: { cookie: ctx.cookieHeader, "x-forwarded-for": ctx.clientIp, "content-type": "application/json" },
    body: method !== "GET" ? JSON.stringify(args) : undefined
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body && typeof body === "object" && "error" in body && typeof (body as any).error === "string")
      ? (body as any).error
      : response.statusText || "Request failed.";
    return { ok: false, status: response.status, error: message };
  }

  if (response.status === 202) {
    const jobId = body && typeof body === "object" ? ((body as any).jobId ?? (body as any).job?.id) : undefined;
    return { ok: true, jobId, data: body };
  }

  return { ok: true, data: body, render };
}

/**
 * invokeTool: the single entry point the agent loop uses to run a tool.
 * Order per ChatbotHarnessPlan.md Slice 2 instruction 3:
 *   1. look up the tool
 *   2. validate args against its zod schema
 *   3. assert permission — always, for both transports (§2 "the permission trap")
 *   4. enforce the tool's rate limit, if any
 *   5. dispatch — always via tool.execute (transport is metadata, not a dispatch switch)
 *   6. write an audit event for mutating tools
 */
/**
 * Every tool's `input` schema marks optional fields with `.optional()`,
 * which accepts `undefined` but not `null` — and a model asked to omit a
 * field routinely emits `explicit null` instead (an OpenAI-style JSON
 * convention; found live when `findings.create` failed twice on
 * `description: null` even though `description` is optional). Stripping
 * top-level `null` values before validation treats "the model said null"
 * the same as "the model omitted the key" for every current and future
 * tool, without touching each schema individually.
 */
function stripNullFields(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  return Object.fromEntries(Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== null));
}

export async function invokeTool(ctx: CopilotContext, name: string, rawArgs: unknown): Promise<CopilotToolResult> {
  const tool = copilotTools[name];
  if (!tool) return { ok: false, error: "Unknown tool" };

  const parsed = tool.input.safeParse(stripNullFields(rawArgs));
  if (!parsed.success) return { ok: false, error: JSON.stringify(parsed.error.flatten()) };

  try {
    await requireProjectPermission(ctx.projectId, tool.permission);
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, status: error.status, error: error.message };
    throw error;
  }

  if (tool.rateLimit) {
    const scope = `copilot:${name}:${ctx.projectId}:${ctx.userId}`;
    const limiter = {
      ai: enforceAiRateLimit,
      schedule: enforceScheduleRateLimit,
      upload: enforceUploadRateLimit,
      export: enforceExportRateLimit
    }[tool.rateLimit];
    const limited = await limiter(scope);
    if (limited) return { ok: false, status: 429, error: "Rate limit exceeded." };
  }

  const result = await tool.execute(ctx, parsed.data);

  if (tool.mutating) {
    await writeAuditEvent({
      projectId: ctx.projectId,
      actorId: ctx.userId,
      action: `copilot.${name}`,
      entityType: name,
      entityId: ctx.conversationId,
      after: { conversationId: ctx.conversationId, args: rawArgs, result: result.data }
    });
  }

  return result;
}
