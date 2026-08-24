import { z } from "zod";

/**
 * The per-iteration step the model emits in the plan -> act -> observe loop
 * (see ChatbotHarnessPlan.md Slice 4). `loop.ts` drives the iteration; this
 * file only owns the schema.
 */
export const stepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("act"),
    // `.default("")` rather than required: found live (NIM's
    // meta/llama-3.1-8b-instruct) — the model sometimes omits this field
    // entirely on an `act` step, which failed the whole step over a field
    // that's explanatory only (never read by invokeTool, which only uses
    // `tool`/`args`) and isn't load-bearing data worth losing a real tool
    // call to a repair retry over.
    thought: z.string().max(400).optional().default(""),
    tool: z.string(),
    args: z.record(z.unknown())
  }),
  z.object({
    kind: z.literal("ask"),
    question: z.string().max(400),
    // Truncate to 4 rather than rejecting a longer array: a model that lists
    // more options than the UI can show (observed in practice — smaller
    // models sometimes enumerate many tool names) should still degrade to a
    // usable `ask` step, not fail the whole turn over a display limit.
    options: z.array(z.string().max(120)).default([]).transform((options) => options.slice(0, 4))
  }),
  z.object({
    kind: z.literal("done"),
    summary: z.string().max(1200),
    detail: z.string().max(2000).nullable(),
    citationRegionIds: z.array(z.string().uuid()).max(12).default([]),
    // `.catch(undefined)` rather than a plain `.optional()`: found live once
    // the schema's own text description started mentioning this field
    // (schema budget optimization, Opus consult, 2026-08-24) — a model that
    // isn't saving anything this turn sometimes still emits an
    // empty/partial placeholder object (`{}`, or only `kind` set) instead of
    // omitting the key, which previously failed validation and took down
    // the entire `done` step over a field that was never going to be used.
    // Any invalid/incomplete object now falls back to "not provided" instead
    // of failing the whole step.
    remember: z.object({
      kind: z.enum(["preference", "fact"]),
      key: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(2000)
    }).optional().catch(undefined)
  })
]);

export type CopilotStep = z.infer<typeof stepSchema>;

/**
 * Hand-written, compact description of stepSchema for providers that embed
 * the schema as TEXT in the prompt (see ModelRequest.schemaDescription).
 * Kept in sync with stepSchema by hand — if that schema changes, update this
 * too. Two reasons this exists instead of always auto-generating one from
 * the schema: (1) token cost — the auto-generated $ref/definitions JSON dump
 * measured ~3x this size for the same information; (2) reliability — a
 * terse, example-free spec is what a smaller/hosted model actually follows,
 * empirically (Opus consult, 2026-08-24, after a natively-tool-use-trained
 * model kept ignoring a verbose schema dump and emitting its own
 * tool-call syntax instead).
 */
export const stepSchemaDescription = [
  'Respond with ONE JSON object, one of exactly these three shapes:',
  '{"kind":"act","thought":"<=400 chars","tool":"<tool name>","args":{...}} — call a tool.',
  '{"kind":"ask","question":"<=400 chars","options":["<=4 short strings"]} — ask the user; options is optional, max 4 items.',
  '{"kind":"done","summary":"<=1200 chars","detail":"<=2000 chars or null","citationRegionIds":["<uuid>", ...],"remember":{"kind":"preference|fact","key":"...","value":"..."}} — final answer; summary must be conversational prose, not a list; citationRegionIds only for sourceRegionId values a tool actually returned, omit or [] otherwise; include "remember" ONLY when the user explicitly stated a preference/fact to keep, omit otherwise.',
  "No markdown fences, no commentary, no other fields, no native function/tool-call syntax — just the plain JSON object."
].join("\n");
