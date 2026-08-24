import { copilotTools } from "@/lib/copilot/registry";
import { selectRelevantSkills } from "@/lib/copilot/skills";

/**
 * Narrows the full ~50-tool catalogue down to what one turn plausibly needs.
 *
 * Found necessary live, not just as a token-budget nicety: the full
 * catalogue costs ~6,000 tokens per request even after Slice 13's
 * compact-JSON fix (measured), which alone exceeds some hosted providers'
 * per-request/per-minute token budget (e.g. Groq's on-demand tier: 8,000
 * TPM for every text model on the account, confirmed via response headers).
 * A vague message ("hi") calling the full catalogue could 429 before the
 * model ever gets to answer.
 *
 * Selection sources, unioned:
 *   - CORE_TOOL_NAMES: always available, cheapest/most broadly useful reads,
 *     so an ambiguous message still gives the model *some* real capability
 *     rather than stranding it with zero tools.
 *   - The tools named by selectRelevantSkills(userMessage)'s matched skills
 *     (already-curated "what tools does this intent need" data — reusing it
 *     here avoids a second, drifting heuristic).
 *   - alreadyUsedToolNames: tools this SAME turn's earlier iterations already
 *     invoked (loop.ts passes `observations` tool names) — keeps a
 *     multi-step turn from losing access to a tool it's already using
 *     partway through, e.g. calling readiness.gates then wanting
 *     readiness.gate_detail on iteration 2.
 *
 * Falls back to the full catalogue only if selection somehow yields nothing
 * usable (defensive — should not happen given CORE_TOOL_NAMES is always
 * included) rather than ever silently giving the model zero tools.
 */
// Deliberately broader than just "project.overview" + "knowledge.search":
// skills.ts's 12 skills have no trigger at all for plain status questions
// ("gate readiness", "what issues are open") — found live, this dropped
// readiness.gates entirely for the exact phrasing that had been working
// reliably. Rather than patch skills.ts's trigger list (a second, drifting
// heuristic to keep in sync), keep the cheap, most commonly needed read
// tools always in the prompt regardless of skill matching.
const CORE_TOOL_NAMES = ["project.overview", "knowledge.search", "readiness.gates", "findings.list", "schedule.current", "shipments.list", "alerts.list"];
const MAX_SELECTED_TOOLS = 14;

// Exact sentence triggers in skills.ts are intentionally conservative, but
// users naturally phrase operations in many equivalent ways. These aliases
// make the relevant action playbook available without exposing the entire
// write-tool catalogue (which would exceed smaller providers' prompt budget).
const ACTION_ALIASES: Array<{ pattern: RegExp; tools: string[] }> = [
  { pattern: /\b(create|add|open|report|log|raise)\b.*\b(issue|finding|defect|problem)\b|\b(issue|finding|defect|problem)\b.*\b(create|add|open|report|log|raise)\b/i, tools: ["members.list", "findings.create"] },
  { pattern: /\b(create|add|new)\b.*\bsystem\b/i, tools: ["records.create_system"] },
  { pattern: /\b(create|add|new)\b.*\basset\b/i, tools: ["records.create_asset"] },
  { pattern: /\b(create|add|new)\b.*\bgate\b/i, tools: ["records.create_gate"] },
  { pattern: /\b(create|add|new)\b.*\b(shipment|delivery)\b/i, tools: ["shipments.create"] },
  { pattern: /\b(update|change|edit)\b.*\b(shipment|eta|delivery)\b/i, tools: ["shipments.list", "shipments.update"] },
  { pattern: /\b(generate|solve|create)\b.*\b(schedule|baseline)\b/i, tools: ["schedule.solve_baseline"] },
  { pattern: /\b(export|download|generate)\b.*\b(report|project|csv|pdf|turnover)\b/i, tools: ["export.project", "export.turnover_pack"] }
];

export function selectRelevantToolNames(userMessage: string, alreadyUsedToolNames: string[] = []): string[] {
  const fromSkills = selectRelevantSkills(userMessage).flatMap((skill) => skill.tools);
  const fromActionAliases = ACTION_ALIASES.filter(({ pattern }) => pattern.test(userMessage)).flatMap(({ tools }) => tools);
  const candidates = [...CORE_TOOL_NAMES, ...fromSkills, ...fromActionAliases, ...alreadyUsedToolNames].filter((name) => name in copilotTools);
  const selected = [...new Set(candidates)].slice(0, MAX_SELECTED_TOOLS);
  return selected.length ? selected : Object.keys(copilotTools);
}
