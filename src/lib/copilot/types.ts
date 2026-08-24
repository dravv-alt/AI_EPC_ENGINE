import type { z } from "zod";
import type { Permission, ProjectRole } from "@/lib/auth/roles";

/**
 * Per-request context threaded through the tool registry and invoker.
 * Built once per copilot turn from the caller's session + the page they were on.
 */
export type CopilotContext = {
  projectId: string;
  userId: string;
  role: ProjectRole;
  conversationId: string;
  cookieHeader: string;
  clientIp: string;
  pathname: string;
  searchParams: Record<string, string | undefined>;
};

/** A single tool the copilot loop can invoke. */
export type CopilotTool = {
  /** e.g. "project.overview" */
  name: string;
  /** One line, shown to the model. */
  description: string;
  /** Same permission string the underlying route/function enforces. */
  permission: Permission;
  rateLimit?: "ai" | "schedule" | "upload" | "export";
  mutating: boolean;
  input: z.ZodType<unknown>;
  transport: { kind: "lib" } | { kind: "http"; method: string; path: (a: any) => string };
  execute(ctx: CopilotContext, args: unknown): Promise<CopilotToolResult>;
};

export type CopilotToolResult = {
  ok: boolean;
  /** Structured — the drawer renders this. */
  data?: unknown;
  /** Renderer key, e.g. "gateReadinessTable". */
  render?: string;
  error?: string;
  status?: number;
  /** Set when the underlying route returned 202. */
  jobId?: string;
  /**
   * Present only when the model attempted a tool call without information
   * required by that tool. The loop turns this into a direct question instead
   * of treating it as an execution failure or retrying blindly.
   */
  needsInput?: { fields: string[] };
};

/** The shape `toolCatalogue()` returns for each tool, for the prompt. */
export type CopilotToolCatalogueEntry = {
  name: string;
  description: string;
  inputJsonSchema: unknown;
};

/** A citation grounding a claim in a specific source region. */
export type CopilotCitation = {
  sourceRegionId: string;
  documentTitle: string;
  revision: string;
  pageNumber: number;
  excerpt: string;
};

/** A mutating action the copilot performed (or attempted) during the turn. */
export type CopilotAction = {
  tool: string;
  status: string;
  entityType: string;
  entityId: string;
  href: string;
};

/** A navigational deep-link surfaced alongside the answer. */
export type CopilotLink = {
  href: string;
  label: string;
};

/** A structured tool result to be rendered by a named React renderer. */
export type CopilotRender = {
  key: string;
  data: unknown;
};

/**
 * The response envelope returned by every copilot turn — identical shape from
 * the loop, the conversations API, and the drawer UI.
 */
export type CopilotResponseEnvelope = {
  summary: string;
  detail: string | null;
  citations: CopilotCitation[];
  actions: CopilotAction[];
  links: CopilotLink[];
  renders: CopilotRender[];
  authority: "advisory" | "proposed_only" | "recorded";
  /** Only set on an `ask` step — real clickable choices, not baked into `detail` as text (Opus consult, 2026-08-24). */
  options?: string[];
};
