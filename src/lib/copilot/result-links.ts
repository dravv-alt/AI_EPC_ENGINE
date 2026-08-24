import type { CopilotAction, CopilotLink, CopilotToolResult } from "@/lib/copilot/types";
import { copilotTools } from "@/lib/copilot/registry";

/**
 * Deterministic (harness, zero model cost) mapping from a tool name to the
 * real workspace page its results live on — hrefs copied verbatim from
 * src/lib/workspace-routes.ts, never invented. `skills.ts` used to instruct
 * the model to type these into prose ("link to /schedule…"); the model
 * doing that in text is exactly the "list of things instead of a
 * conversation" complaint, and it cost real output tokens on every turn
 * that touched one of these tools. This is a static fact of the app, not a
 * judgment call, so the harness owns it entirely (Opus consult, 2026-08-24).
 */
const TOOL_ROUTES: Record<string, CopilotLink> = {
  "readiness.gates": { href: "/readiness", label: "Readiness" },
  "readiness.gate_detail": { href: "/readiness", label: "Readiness" },
  "findings.list": { href: "/actions", label: "Issues" },
  "findings.create": { href: "/actions", label: "Issues" },
  "findings.update": { href: "/actions", label: "Issues" },
  "schedule.current": { href: "/schedule", label: "Schedule" },
  "schedule.versions": { href: "/schedule", label: "Schedule" },
  "schedule.diff": { href: "/schedule", label: "Schedule" },
  "schedule.risks": { href: "/schedule", label: "Schedule" },
  "schedule.solve_baseline": { href: "/schedule", label: "Schedule" },
  "events.live": { href: "/schedule", label: "Schedule" },
  "shipments.list": { href: "/shipments", label: "Shipments & Logistics" },
  "shipments.detail": { href: "/shipments", label: "Shipments & Logistics" },
  "shipments.create": { href: "/shipments", label: "Shipments & Logistics" },
  "shipments.update": { href: "/shipments", label: "Shipments & Logistics" },
  "shipments.bulk_import": { href: "/shipments", label: "Shipments & Logistics" },
  "shipment_plans.act": { href: "/shipments", label: "Shipments & Logistics" },
  "alerts.list": { href: "/command-center", label: "Alert Center" },
  "knowledge.search": { href: "/sources", label: "Documents" },
  "knowledge.similar_rfi": { href: "/sources", label: "Documents" },
  "sources.list": { href: "/sources", label: "Documents" },
  "sources.upload": { href: "/sources", label: "Documents" },
  "sources.add_revision": { href: "/sources", label: "Documents" },
  "cx.checklists": { href: "/cx", label: "Commissioning Tests" },
  "cx.checklist_detail": { href: "/cx", label: "Commissioning Tests" },
  "cx.generate_checklist": { href: "/cx", label: "Commissioning Tests" },
  "cx.record_reading": { href: "/cx", label: "Commissioning Tests" },
  "cx.draft_report": { href: "/cx", label: "Commissioning Tests" },
  "cx.upload_standard": { href: "/cx", label: "Commissioning Tests" },
  "compliance.checks": { href: "/compliance", label: "Compliance" },
  "compliance.scan": { href: "/compliance", label: "Compliance" },
  "compliance.check_one": { href: "/compliance", label: "Compliance" },
  "review.advisory_requirement_track": { href: "/requirements", label: "Requirements" },
  "review.advisory_schedule_track": { href: "/schedule", label: "Schedule" },
  "records.create_system": { href: "/systems", label: "Systems & Assets" },
  "records.create_asset": { href: "/systems", label: "Systems & Assets" },
  "records.create_gate": { href: "/readiness", label: "Readiness" },
  "records.create_edge": { href: "/graph", label: "Traceability" },
  "claims.create": { href: "/evidence", label: "Evidence" },
  "evidence.capture": { href: "/evidence", label: "Evidence" },
  "evidence.create_record": { href: "/evidence", label: "Evidence" },
  "site_analysis.save": { href: "/site-analysis", label: "Site Analysis" },
  "site_analysis.insights": { href: "/site-analysis", label: "Site Analysis" },
  "graph.node": { href: "/graph", label: "Traceability" },
  "entropy.score": { href: "/evidence", label: "Evidence" }
};

/** Deep-link query shapes already established for this app (context.ts, deep-link scripts). */
type ActionRule = { entityType: string; extract: (data: unknown) => string | undefined; hrefFor: (id: string) => string };

const ACTION_RULES: Record<string, ActionRule> = {
  "findings.create": { entityType: "finding", extract: (d) => idAt(d, ["finding", "id"]), hrefFor: (id) => `/actions?finding=${id}` },
  "findings.update": { entityType: "finding", extract: (d) => idAt(d, ["finding", "id"]), hrefFor: (id) => `/actions?finding=${id}` },
  "shipments.create": { entityType: "shipment", extract: (d) => idAt(d, ["shipment", "id"]), hrefFor: (id) => `/shipments?shipment=${id}` },
  "shipments.update": { entityType: "shipment", extract: (d) => idAt(d, ["shipment", "id"]), hrefFor: (id) => `/shipments?shipment=${id}` },
  "records.create_gate": { entityType: "gate", extract: (d) => idAt(d, ["gate", "id"]), hrefFor: (id) => `/readiness?gate=${id}` }
};

function idAt(data: unknown, path: [string, string]): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const inner = (data as Record<string, unknown>)[path[0]];
  if (!inner || typeof inner !== "object") return undefined;
  const id = (inner as Record<string, unknown>)[path[1]];
  return typeof id === "string" ? id : undefined;
}

/** Up to 3 real, deduplicated page links for the tools that actually ran this turn. */
export function collectLinks(observations: { tool: string; result: CopilotToolResult }[]): CopilotLink[] {
  const seen = new Set<string>();
  const links: CopilotLink[] = [];
  for (const { tool, result } of observations) {
    if (!result.ok) continue;
    const link = TOOL_ROUTES[tool];
    if (!link || seen.has(link.href)) continue;
    seen.add(link.href);
    links.push(link);
    if (links.length >= 3) break;
  }
  return links;
}

/**
 * Deep-linkable actions for tools that actually mutated something this turn
 * — only when a real id can be read back from the tool's own response.
 * Never fabricates an id or a link: a tool without a matching, verified
 * ACTION_RULES entry is silently skipped rather than guessed (found live,
 * this session: a fabricated finding link 500'd the /actions page — that
 * failure mode must never be reachable from real data again).
 */
export function collectActions(observations: { tool: string; result: CopilotToolResult }[]): CopilotAction[] {
  const actions: CopilotAction[] = [];
  for (const { tool, result } of observations) {
    if (!result.ok || !copilotTools[tool]?.mutating) continue;
    const rule = ACTION_RULES[tool];
    if (!rule) continue;
    const entityId = rule.extract(result.data);
    if (!entityId) continue;
    actions.push({ tool, status: "executed", entityType: rule.entityType, entityId, href: rule.hrefFor(entityId) });
  }
  return actions;
}
