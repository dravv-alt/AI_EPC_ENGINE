import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { copilotMessages } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { assembleSystemPrompt } from "@/lib/copilot/context";
import { recallMemories, rememberMemory } from "@/lib/copilot/memory";
import { invokeTool } from "@/lib/copilot/invoke";
import { stepSchema, stepSchemaDescription } from "@/lib/copilot/prompts";
import { copilotTools, toolCatalogue } from "@/lib/copilot/registry";
import { selectRelevantSkills, serializeSkillsForPrompt } from "@/lib/copilot/skills";
import { selectRelevantToolNames } from "@/lib/copilot/tool-selection";
import { collectActions, collectLinks } from "@/lib/copilot/result-links";
import { matchTrivialIntent } from "@/lib/copilot/trivial-intent";
import type { CopilotCitation, CopilotContext, CopilotRender, CopilotResponseEnvelope, CopilotToolResult } from "@/lib/copilot/types";
import { getGenerationProvider } from "@/lib/model/provider";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

// Realistic shapes are done (1 step), act+done (2), act+act+done (3) — a 4th
// step is almost always a model that isn't converging, exactly the case
// worth cutting off rather than paying for. Lowered from 4 (Opus consult,
// 2026-08-24): a 25% cost cap with near-zero capability loss.
const MAX_STEPS = 3;
type Observation = { tool: string; result: CopilotToolResult };

const emptyEnvelope = (summary: string, detail: string | null = null): CopilotResponseEnvelope => ({ summary, detail, citations: [], actions: [], links: [], renders: [], authority: "advisory" });

function collectRenders(observations: Observation[]): CopilotRender[] {
  // Dedupe by (render key + data): found via live testing — a model that
  // loops without converging to `done` (common with a small model on a
  // ~50-tool catalogue) often re-invokes the same read tool with identical
  // args, and every prior call's redundant, byte-identical result was
  // rendering again in the drawer.
  const seen = new Set<string>();
  const renders: CopilotRender[] = [];
  for (const { result } of observations) {
    if (!result.ok || !result.render || result.data === undefined) continue;
    const fingerprint = `${result.render}:${JSON.stringify(result.data)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    renders.push({ key: result.render, data: result.data });
  }
  return renders;
}

function collectCitations(observations: Observation[], requestedIds: string[]): CopilotCitation[] {
  const requested = new Set(requestedIds);
  const found = new Map<string, CopilotCitation>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return void value.forEach(visit);
    const record = value as Record<string, unknown>;
    const id = typeof record.sourceRegionId === "string" ? record.sourceRegionId : undefined;
    if (id && requested.has(id) && typeof record.documentTitle === "string" && typeof record.revision === "string" && typeof record.pageNumber === "number" && typeof record.excerpt === "string") {
      found.set(id, { sourceRegionId: id, documentTitle: record.documentTitle, revision: record.revision, pageNumber: record.pageNumber, excerpt: record.excerpt });
    }
    Object.values(record).forEach(visit);
  };
  observations.forEach(({ result }) => visit(result.data));
  return requestedIds.flatMap((id) => found.get(id) ? [found.get(id)!] : []);
}

function authorityFor(observations: Observation[]): CopilotResponseEnvelope["authority"] {
  return observations.some(({ tool, result }) => result.ok && copilotTools[tool]?.mutating) ? "recorded" : "advisory";
}

/**
 * Every string here is harness-authored (zero model cost) and user-facing —
 * kept conversational and free of internals (Opus consult, 2026-08-24: the
 * raw reason text used to leak straight into `detail`, e.g. a provider's own
 * error body or "MODEL_DAILY_TOKEN_BUDGET"). The real reason is logged
 * server-side via `rawReason` for debugging; the user only ever sees a
 * plain sentence.
 */
function forceDone(observations: Observation[], kind: "step-limit" | "repeated-failure" | "generation-failed" = "step-limit", rawReason?: string): CopilotResponseEnvelope {
  if (rawReason) console.warn(`[copilot] forceDone(${kind}): ${rawReason}`);
  const anySuccess = observations.some(({ result }) => result.ok);
  const summary = {
    "step-limit": anySuccess ? "Here's what I found before I ran out of steps for this question." : "I wasn't able to pull that up just now.",
    "repeated-failure": "I tried that twice and it kept failing, so I've stopped rather than keep retrying.",
    "generation-failed": "Something went wrong on my side working out a reply — mind asking that again?"
  }[kind];
  return { ...emptyEnvelope(summary, null), renders: collectRenders(observations), actions: collectActions(observations), links: collectLinks(observations), authority: authorityFor(observations) };
}

function clarificationForToolInput(tool: string, fields: string[]): CopilotResponseEnvelope {
  const action = copilotTools[tool]?.description.replace(/\.$/, "") ?? "complete that task";
  const requested = fields.length === 1 ? fields[0] : fields.slice(0, 5).join(", ");
  return emptyEnvelope(`I can ${action.charAt(0).toLowerCase()}${action.slice(1)}, but I need ${requested} first. What should I use?`);
}

// A current-work question is only useful when grounded in the live project
// register. Some smaller models otherwise emit the user's wording as `done`.
function requiredReadToolFor(userMessage: string): string | null {
  return /\b(to[ -]?do(?:s)?|open (?:items|work|issues|findings)|current (?:work|tasks|priorities)|what(?:'s| is) (?:left|pending))\b/i.test(userMessage)
    ? "findings.list"
    : null;
}

async function persistAssistant(conversationId: string, envelope: CopilotResponseEnvelope, provider?: string, model?: string, usage?: { inputTokens?: number; outputTokens?: number }) {
  await db.insert(copilotMessages).values({ conversationId, role: "assistant", content: envelope.summary, citations: envelope.citations, response: envelope, modelProvider: provider, modelVersion: model, modelInputTokens: usage?.inputTokens, modelOutputTokens: usage?.outputTokens });
}

// Compact, not pretty-printed: this only ever feeds a char-budgeted model
// prompt (never shown to a human), and 2-space indentation on the full tool
// catalogue + conversation history + observations was measured to cost
// ~40-50% extra characters for zero benefit to the model.
function serialize(value: unknown) { return JSON.stringify(value); }

// How many of the most recent copilot_messages rows to embed as history.
// Found via live testing: with no cap, a conversation of even a handful of
// turns re-hit the 60,000-char prompt limit on every later turn, because
// `history` included every message (and every full tool result) ever sent
// in the conversation — unbounded growth, not a one-time cost like the tool
// catalogue. A fixed recent-message window keeps this bounded regardless of
// how long the conversation runs. Lowered from 20 back to 10 once past tool
// *results* stopped being embedded at all (see historyForPrompt below) — the
// model needs to know a past turn called a tool and whether it succeeded,
// not re-see that tool's full payload, so the remaining per-message cost is
// small enough that 10 messages of real conversational context comfortably
// fits inside a hosted provider's tight per-minute token budget (Opus
// consult, 2026-08-24: Groq's account-tier 8,000 TPM ceiling made a 4-step
// turn resending 20 full-payload messages on every iteration untestable).
const HISTORY_MESSAGE_LIMIT = 10;

/**
 * Past-turn history the model needs is "what happened," not "what the tool
 * returned" — that data is only actionable within the turn that fetched it
 * (this turn's own `observations` still carries full results). Stripping
 * `toolResult`/`toolArgs` down to just `toolStatus` cuts the dominant cost of
 * embedding history at all, on every iteration, for every provider.
 */
function historyForPrompt(rows: { role: string; content: string | null; toolName: string | null; toolStatus: string | null }[]) {
  return rows.map((row) => row.role === "tool" ? { role: row.role, toolName: row.toolName, toolStatus: row.toolStatus } : { role: row.role, content: row.content });
}

/**
 * Sums real usage already persisted on copilot_messages (see ModelResult.usage)
 * for the currently active provider over the last 24 rolling hours, against
 * MODEL_DAILY_TOKEN_BUDGET. A no-op (never blocks) when that env var is
 * unset — this only activates once a budget is explicitly configured, e.g.
 * for a metered provider on a small credit balance.
 */
async function dailyTokenBudgetExceeded(): Promise<boolean> {
  if (!env.MODEL_DAILY_TOKEN_BUDGET) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db.select({ total: sql<string>`coalesce(sum(coalesce(${copilotMessages.modelInputTokens}, 0) + coalesce(${copilotMessages.modelOutputTokens}, 0)), 0)` })
    .from(copilotMessages)
    .where(and(eq(copilotMessages.modelProvider, env.MODEL_PROVIDER), gte(copilotMessages.createdAt, since)));
  return Number(row?.total ?? 0) >= env.MODEL_DAILY_TOKEN_BUDGET;
}

/** Runs one bounded, project-scoped copilot turn. */
export async function runCopilotTurn({ ctx, conversationId, userMessage }: { ctx: CopilotContext; conversationId: string; userMessage: string }): Promise<CopilotResponseEnvelope> {
  const limited = await enforceAiRateLimit(`copilot:${ctx.projectId}:${ctx.userId}`);
  if (limited) return emptyEnvelope("You've asked a few things in quick succession — give me a moment and try again.", null);
  if (await dailyTokenBudgetExceeded()) {
    console.warn(`[copilot] daily token budget exceeded for provider ${env.MODEL_PROVIDER} (limit ${env.MODEL_DAILY_TOKEN_BUDGET})`);
    return emptyEnvelope("I've hit my model usage cap for today. It resets on a rolling window, so try again a bit later.", null);
  }

  const trivial = matchTrivialIntent(userMessage);
  if (trivial) {
    const envelope = emptyEnvelope(trivial.summary, trivial.detail);
    await persistAssistant(conversationId, envelope);
    return envelope;
  }

  const memories = await recallMemories(ctx.projectId, ctx.userId);
  const system = await assembleSystemPrompt({ projectId: ctx.projectId, pathname: ctx.pathname, searchParams: ctx.searchParams, role: ctx.role, memories });
  const [recentHistory, recentUserTurns, lastAssistantRows] = await Promise.all([
    db.select({ role: copilotMessages.role, content: copilotMessages.content, toolName: copilotMessages.toolName, toolStatus: copilotMessages.toolStatus }).from(copilotMessages).where(eq(copilotMessages.conversationId, conversationId)).orderBy(desc(copilotMessages.createdAt)).limit(HISTORY_MESSAGE_LIMIT),
    // Keep the task specification across clarification turns without
    // reintroducing the old unbounded all-message prompt growth.
    db.select({ content: copilotMessages.content }).from(copilotMessages).where(and(eq(copilotMessages.conversationId, conversationId), eq(copilotMessages.role, "user"))).orderBy(desc(copilotMessages.createdAt)).limit(8),
    // Fetch the last assistant message to detect if we are in an ask-answer
    // state. The model correctly calls members.list on follow-up turns but then
    // generates another kind=ask instead of kind=act findings.create because it
    // has no signal that the user's current message IS the answer to its own
    // previous question.
    db.select({ content: copilotMessages.content, response: copilotMessages.response }).from(copilotMessages).where(and(eq(copilotMessages.conversationId, conversationId), eq(copilotMessages.role, "assistant"))).orderBy(desc(copilotMessages.createdAt)).limit(1)
  ]);
  const history = historyForPrompt(recentHistory.reverse());
  const observations: Observation[] = [];
  const failuresByTool = new Map<string, number>();
  // The visible reply often contains only a short value such as "Bhavik".
  // Route tools from the recent user turns as a whole, so a follow-up retains
  // the capability required by its original request (e.g. members.list to
  // resolve that owner name before findings.create).
  const taskContext = recentUserTurns
    .reverse()
    .map((entry) => entry.content ?? "")
    .concat(userMessage)
    .join("\n")
    .slice(-3_000);
  const skills = serializeSkillsForPrompt(selectRelevantSkills(taskContext));

  // Detect ask-answer state: if the previous assistant turn was a clarifying
  // question (has options presented to user, OR content ends with "?"), the
  // current userMessage is the user's direct answer. Inject an explicit note
  // so the model does not generate another kind=ask for the same information.
  const lastAsst = lastAssistantRows[0];
  const lastResponse = lastAsst?.response as CopilotResponseEnvelope | null | undefined;
  const lastWasAsk = (Array.isArray(lastResponse?.options) && (lastResponse?.options as string[]).length > 0) || lastAsst?.content?.trimEnd().endsWith("?") === true;
  const prevAnswerNote = lastWasAsk && lastAsst?.content
    ? `The previous assistant message was a clarifying question: "${lastAsst.content}". The current user message is the direct answer to that question. Do NOT ask the same question again. Use the answer immediately to call the appropriate tool (e.g. match the name to a member from members.list and call findings.create).`
    : "";

  for (let iteration = 0; iteration < MAX_STEPS; iteration += 1) {
    // History is only useful for orienting the FIRST step of a turn ("what
    // has this conversation covered so far") — steps 2+ have this turn's own
    // `observations` for what just happened, and resending the identical
    // history block on every iteration was pure waste (Opus consult,
    // 2026-08-24: the single biggest cost in a multi-step turn).
    const prompt = [
      "You are executing one bounded copilot turn. Respond only with a JSON step matching the supplied schema.",
      "Use tools for project facts and requested operations. Never invent project data, citations, or action results. Never answer a project-status, to-do, task, finding, schedule, shipment, alert, or readiness question by repeating or paraphrasing the user's question: call an appropriate read tool first. If a user gives an owner name, resolve it with members.list before using an ownerId. If a user gives an unambiguous calendar date with a year, convert it to an ISO-8601 timestamp for a datetime field instead of asking for it again. Before an action tool needs information that is not in the message or observations, return kind=ask and request only the missing fields; do not call the tool with guessed IDs, dates, owners, or values. When enough information is available, return kind=done.",
      "Write summary as one to three sentences of plain, warm, conversational English — how a knowledgeable colleague would say it out loud. Lead with the answer, not with what you did. Do not narrate your tool calls. Do not write bullet lists, headings, or markdown; the interface renders tables, links, and citations itself, so never retype data a tool already returned. Use detail only for a genuine caveat or next step, and leave it null otherwise.",
      `User message:\n${userMessage}`,
      `Relevant user task context:\n${taskContext}`,
      prevAnswerNote,
      iteration === 0 ? `Conversation history:\n${serialize(history)}` : "",
      `Available tools:\n${serialize(toolCatalogue(selectRelevantToolNames(taskContext, observations.map((o) => o.tool))))}`,
      skills ? `Relevant playbooks:\n${skills}` : "",
      observations.length ? `Observations from this turn:\n${serialize(observations)}` : ""
    ].filter(Boolean).join("\n\n");
    // A model can produce output that fails schema validation even after the
    // provider's own repair retry (e.g. an `ask` step with more than 4
    // options) — that is a model-quality failure, not a caller error, and
    // must degrade the same way a failed tool call does (Slice 4's guard),
    // never crash the whole HTTP turn with a raw 500.
    const generated = await getGenerationProvider().generateStructured({ system, prompt, schema: stepSchema, schemaDescription: stepSchemaDescription, mock: { kind: "done", summary: "I'm ready to help once tools are connected.", detail: null, citationRegionIds: [] }, limits: { outputMaxTokens: 1024, contextTokens: 16384 } }).catch((error: unknown) => ({ failure: error instanceof Error ? error.message : "unknown error" }));
    if ("failure" in generated) {
      const envelope = forceDone(observations, "generation-failed", generated.failure);
      await persistAssistant(conversationId, envelope);
      return envelope;
    }
    const step = generated.data;

    if (step.kind === "ask") {
      // Real options, not baked into `detail` as text — the old
      // "Options:\n- X\n- Y" string rendered through a plain <p>, which
      // collapses newlines into a run-on line the user actually saw as
      // "Options: - X - Y" (found live, Opus consult, 2026-08-24).
      const envelope: CopilotResponseEnvelope = { ...emptyEnvelope(step.question, null), options: step.options?.length ? step.options : undefined };
      await persistAssistant(conversationId, envelope, generated.provider, generated.model, generated.usage);
      return envelope;
    }
    if (step.kind === "done") {
      const requiredReadTool = observations.length === 0 ? requiredReadToolFor(taskContext) : null;
      if (requiredReadTool) {
        const result = await invokeTool(ctx, requiredReadTool, {});
        observations.push({ tool: requiredReadTool, result });
        await db.insert(copilotMessages).values({ conversationId, role: "tool", toolName: requiredReadTool, toolArgs: {}, toolResult: result.data ?? result.error ?? null, toolStatus: result.ok ? "executed" : "failed", modelProvider: generated.provider, modelVersion: generated.model, modelInputTokens: generated.usage?.inputTokens, modelOutputTokens: generated.usage?.outputTokens });
        continue;
      }
      // Runtime shape is guaranteed correct here — stepSchema's `.catch(undefined)`
      // on `remember` (prompts.ts) already normalized any incomplete object to
      // `undefined`, so a truthy value always has all three fields. The `as`
      // below only works around a cosmetic zod/TS inference quirk on that
      // schema (an object().optional().catch() chain widens the STATIC type
      // to all-optional fields, which does not reflect the real runtime
      // guarantee) — not a runtime assumption.
      if (step.remember && /\b(remember|always|prefer|preference|default|keep in mind)\b/i.test(userMessage)) {
        await rememberMemory(ctx.projectId, ctx.userId, step.remember as { kind: "preference" | "fact"; key: string; value: string }).catch(() => undefined);
      }
      const envelope: CopilotResponseEnvelope = { ...emptyEnvelope(step.summary, step.detail), citations: collectCitations(observations, step.citationRegionIds ?? []), renders: collectRenders(observations), actions: collectActions(observations), links: collectLinks(observations), authority: authorityFor(observations) };
      await persistAssistant(conversationId, envelope, generated.provider, generated.model, generated.usage);
      return envelope;
    }

    const result = await invokeTool(ctx, step.tool, step.args);
    observations.push({ tool: step.tool, result });
    await db.insert(copilotMessages).values({ conversationId, role: "tool", toolName: step.tool, toolArgs: step.args, toolResult: result.data ?? result.error ?? null, toolStatus: result.ok ? "executed" : "failed", modelProvider: generated.provider, modelVersion: generated.model, modelInputTokens: generated.usage?.inputTokens, modelOutputTokens: generated.usage?.outputTokens });
    if (!result.ok) {
      if (result.needsInput?.fields.length) {
        const envelope = clarificationForToolInput(step.tool, result.needsInput.fields);
        await persistAssistant(conversationId, envelope, generated.provider, generated.model, generated.usage);
        return envelope;
      }
      const failures = (failuresByTool.get(step.tool) ?? 0) + 1;
      failuresByTool.set(step.tool, failures);
      if (failures >= 2) {
        const envelope = forceDone(observations, "repeated-failure", `${step.tool}: ${result.error ?? "request failed"}`);
        await persistAssistant(conversationId, envelope, generated.provider, generated.model, generated.usage);
        return envelope;
      }
    }
  }
  const envelope = forceDone(observations);
  await persistAssistant(conversationId, envelope);
  return envelope;
}
