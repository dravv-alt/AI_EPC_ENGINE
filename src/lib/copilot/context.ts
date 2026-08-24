// Context builder for the copilot system prompt. See ChatbotHarnessPlan.md
// Slice 3.2. Three layers — app map, project context, page context — plus an
// optional memories layer, assembled and hard-trimmed to a 45 000-char cap
// (tighter than env.ts's MODEL_PROMPT_MAX_CHARS, to leave headroom under
// Ollama's smaller context window; see the guardrail note in the plan).

import { getDashboardData } from "@/lib/dashboard-data";
import { appMap } from "@/lib/copilot/app-map";
import type { ProjectRole } from "@/lib/auth/roles";

/** Hard cap on the fully assembled system prompt, in characters. */
export const SYSTEM_PROMPT_MAX_CHARS = 45_000;

/** Minimal, always-safe fallback used when assembly fails for any reason. */
const MINIMAL_FALLBACK_PROMPT =
  "You are the Pramana Copilot. Project and page context are unavailable this turn. " +
  "Answer only from tool results you invoke; if a tool returns no results, say so. " +
  "Never invent project data or write a terminal state.";

/**
 * A trimmed slice of `getDashboardData`, formatted as prompt-ready text.
 *
 * Discrepancy note: the plan asks this to include "caller role", but
 * `DashboardData` (src/lib/dashboard-data.ts) has no role field — the role
 * check inside `getDashboardData` discards the resolved `ProjectActor`
 * before returning. `role` is therefore an optional second parameter here
 * (the caller's `CopilotContext.role`, when available) rather than something
 * read off the dashboard payload; the line is simply omitted when not
 * passed. The mandated single-argument call shape `buildProjectContext(projectId)`
 * still works unchanged.
 *
 * No per-request cache: a bare in-module `Map` keyed by `projectId` would
 * persist for the lifetime of the Node process (this app is a long-lived
 * server, not one module instance per request), so it would silently serve
 * stale dashboard data across unrelated turns and requests — worse than no
 * caching. `assembleSystemPrompt` calls this once per turn, so caching is
 * skipped entirely as the simpler, equally correct option.
 */
export async function buildProjectContext(projectId: string, role?: ProjectRole): Promise<string> {
  try {
    const data = await getDashboardData(projectId);
    if (!data) return "## Project context\nNo project data available for this project.";

    const lines: string[] = [
      "## Project context",
      `Project: ${data.project} (${data.projectCode})`
    ];
    if (role) lines.push(`Caller role: ${role}`);
    lines.push(
      `Current gate: ${data.gate}`,
      `Open finding count: ${data.openIssueCount}`,
      `Latest schedule version: ${data.insights.operations.scheduleVersion ?? "none"}`,
      `Active alert count: ${data.insights.operations.activeAlerts}`,
      "Gate readiness:"
    );
    if (data.readiness.length === 0) {
      lines.push("- (no gates configured)");
    } else {
      for (const row of data.readiness) {
        lines.push(`- ${row.gate} [${row.system}]: ${row.state} — ${row.detail}`);
      }
    }
    return lines.join("\n");
  } catch {
    // getDashboardData can throw (AccessError, DB failure, etc). Degrade
    // rather than propagate — assembleSystemPrompt must never throw.
    return "## Project context\nProject context unavailable.";
  }
}

/**
 * Reverse of the deep-link shapes in `resolveAlertLinks`
 * (src/lib/dashboard-data.ts): given the pathname + query params the user is
 * currently on, describe the entity in view for the system prompt. Pure
 * string mapping — no DB call, so ids are surfaced as-is rather than
 * resolved to names (a lookup here would need its own query; not worth it
 * for a one-line prompt hint).
 */
export function buildPageContext({ pathname, searchParams }: { pathname: string; searchParams: Record<string, string | undefined> }): string {
  const get = (key: string) => searchParams?.[key];

  if (pathname === "/readiness" && get("gate")) {
    return `Currently viewing gate ${get("gate")} on the Readiness page.`;
  }
  if (pathname === "/actions" && get("finding")) {
    return `Currently viewing finding ${get("finding")} on the Actions page.`;
  }
  if (pathname === "/schedule" && get("task")) {
    return `Currently viewing task ${get("task")} on the Schedule page.`;
  }
  if (pathname === "/schedule" && get("risk")) {
    return `Currently viewing risk ${get("risk")} on the Schedule page.`;
  }
  if (pathname === "/schedule" && get("version")) {
    return `Currently viewing schedule version ${get("version")} on the Schedule page.`;
  }
  if (pathname === "/shipments" && get("shipment")) {
    return `Currently viewing shipment ${get("shipment")} on the Shipments page.`;
  }
  return `Currently on ${pathname}.`;
}

export type AssembleSystemPromptArgs = {
  projectId: string;
  pathname: string;
  searchParams: Record<string, string | undefined>;
  /** The caller's project role, if known — see buildProjectContext's note. */
  role?: ProjectRole;
  /**
   * Slice 12 (memory.ts, Wave 3 / A3-6) plugs in here: pass the recalled
   * memory strings (already formatted, newest first, pre-capped by the
   * memory layer per its own 20-entry / 2000-char budget) and they render as
   * a labeled "## Memories" section. Omit or pass `[]`/`undefined` until
   * that slice lands — this signature does not need to change.
   */
  memories?: string[];
};

/**
 * Combines the app map, project context, page context, and (optionally)
 * memories into the copilot's system prompt, hard-trimmed to
 * SYSTEM_PROMPT_MAX_CHARS. Never throws — degrades to MINIMAL_FALLBACK_PROMPT
 * on any failure.
 *
 * Drop order when over budget: page context, then project context, then
 * (last resort) hard-truncate the remaining app-map + memories string. The
 * plan calls for dropping "app-map examples" specifically, but the app map
 * this assembles from (src/lib/copilot/app-map.ts) has no separable
 * "examples" subsection — it is five joined sections (routes, roles,
 * vocabulary, state machines, authority rules), all foundational. Whole-
 * string truncation of the app-map+memories tail is used as the simplest
 * safe fallback; in practice the app map alone should sit well under the cap.
 */
export async function assembleSystemPrompt({ projectId, pathname, searchParams, role, memories }: AssembleSystemPromptArgs): Promise<string> {
  try {
    const pageContextText = `## Page context\n${buildPageContext({ pathname, searchParams })}`;
    const projectContextText = await buildProjectContext(projectId, role);
    const memoriesText = memories && memories.length > 0
      ? ["## Memories", ...memories.map((entry) => `- ${entry}`)].join("\n")
      : "";

    const full = [appMap, projectContextText, pageContextText, memoriesText].filter(Boolean).join("\n\n");
    if (full.length <= SYSTEM_PROMPT_MAX_CHARS) return full;

    const withoutPageContext = [appMap, projectContextText, memoriesText].filter(Boolean).join("\n\n");
    if (withoutPageContext.length <= SYSTEM_PROMPT_MAX_CHARS) return withoutPageContext;

    const withoutProjectContext = [appMap, memoriesText].filter(Boolean).join("\n\n");
    if (withoutProjectContext.length <= SYSTEM_PROMPT_MAX_CHARS) return withoutProjectContext;

    return withoutProjectContext.slice(0, SYSTEM_PROMPT_MAX_CHARS);
  } catch {
    return MINIMAL_FALLBACK_PROMPT;
  }
}
