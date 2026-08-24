import type { Permission } from "@/lib/auth/roles";

/**
 * Skills are advisory playbooks injected into the copilot's system prompt to help the model
 * sequence tool calls sensibly for a given user intent. They are prompt GUIDANCE ONLY — nothing
 * here is an authority check. Real enforcement (permission, rate limits, non-terminal states,
 * forbidden routes) happens in invoke.ts, the registry, and the underlying routes regardless of
 * what a skill's `steps` say. See ChatbotHarnessPlan.md §0.
 */
export type Skill = {
  /** Stable identifier, referenced in prompts and tests. */
  id: string;
  /** Short example phrases/keywords that should surface this skill for a given user turn. */
  triggers: string[];
  /** Minimum permission (from src/lib/auth/roles.ts) for this skill to be relevant/usable. */
  permission: Permission;
  /** Copilot tool name strings this skill orchestrates. Referenced as plain strings only. */
  tools: string[];
  /** Plain-language sequence describing how the model should use the tools together. */
  steps: string[];
  /** Plain-language gating notes — preconditions, degraded-mode caveats, non-final-state notes. */
  preconditions: string[];
};

export const skills: Skill[] = [
  {
    id: "answer-from-controlled-sources",
    triggers: ["what does the spec say", "according to", "find in the documents", "cite the source", "where is this documented"],
    permission: "audit:view",
    tools: ["knowledge.search"],
    steps: [
      "1. Call knowledge.search with the user's question.",
      "2. If noResults is true, say so plainly — never fill the gap from the model's own knowledge.",
      "3. Otherwise, write the connective sentence and cite the returned source regions; never retype numbers the tool already returned."
    ],
    preconditions: ["No uncited claims about project content are allowed — this skill only answers from what knowledge.search actually returns."]
  },
  {
    id: "whats-coming-up",
    triggers: ["what's coming up", "upcoming schedule", "this week", "next milestone", "recent alerts"],
    permission: "audit:view",
    tools: ["schedule.current", "events.live", "alerts.list"],
    steps: [
      "1. Call schedule.current for the active baseline/version.",
      "2. Call events.live for near-term live events.",
      "3. Call alerts.list for active alerts.",
      "4. Summarize the three together in date order, conversationally — the interface adds the relevant page link on its own, don't type one."
    ],
    preconditions: []
  },
  {
    id: "shipment-status",
    triggers: ["shipment status", "where is my shipment", "delayed shipment", "logistics", "eta"],
    permission: "audit:view",
    tools: ["shipments.list", "shipments.detail"],
    steps: [
      "1. Call shipments.list to find the shipment(s) matching the user's description.",
      "2. If a single shipment is identified, call shipments.detail for route/ETA/threat detail.",
      "3. Report plannedEta vs weatherAdjustedEta and positionSource; if routeAvailable is false, state why rather than implying a route exists."
    ],
    preconditions: []
  },
  {
    id: "assist-commissioning-test",
    triggers: ["commissioning test", "checklist", "test record", "record a reading", "cx step"],
    permission: "audit:view",
    tools: ["cx.checklists", "cx.checklist_detail", "cx.record_reading"],
    steps: [
      "1. Call cx.checklists to find the relevant checklist.",
      "2. Call cx.checklist_detail to see steps and current state.",
      "3. If the user supplies a reading for a step, call cx.record_reading with that reading only — never assert a pass/fail verdict; report the verdict the route returns."
    ],
    preconditions: ["cx.record_reading is not built yet as of this wave (Slice 11) — list it here as the full intended playbook, not a live capability."]
  },
  {
    id: "prepare-review-queue",
    triggers: ["what's waiting on my review", "review queue", "pending review", "what needs review"],
    permission: "requirement:review",
    tools: ["review.advisory"],
    steps: [
      "1. Identify the queued subjects (requirement, evidence, compliance_check, cx_checklist, schedule_task, schedule_resource, schedule_risk).",
      "2. Call review.advisory per subject to surface prior human corrections on semantically similar items, with citations.",
      "3. Present the queue plus prior rationale, conversationally — the interface adds the relevant page link on its own, don't type one.",
      "4. Never disposition anything — this is read-only, advisory guidance for a human reviewer."
    ],
    preconditions: ["GET-only, advisory. Never calls the review PATCH/POST routes — those are permanently off-limits (§0 rule 3)."]
  },
  {
    id: "raise-issue",
    triggers: ["raise an issue", "log a finding", "flag a problem", "open a finding", "report a defect"],
    permission: "finding:manage",
    tools: ["members.list", "findings.create"],
    steps: [
      "1. Resolve the owner via members.list if a name was given but no id.",
      "2. If no owner can be resolved, ask — never guess a UUID.",
      "3. Call findings.create with severity, owner, due date, and gate/system context.",
      "4. Tell the user, conversationally, that it's logged as open — the interface adds the deep link on its own, don't type one."
    ],
    preconditions: ["findings.create requires ownerId (a real project member) and dueAt."]
  },
  {
    id: "route-and-file-upload",
    triggers: ["upload this file", "attach a document", "where does this go", "file this as", "drop a file"],
    permission: "source:upload",
    tools: ["sources.upload", "sources.add_revision", "cx.upload_standard", "evidence.capture", "evidence.create_record"],
    steps: [
      "1. Use the deterministic routing rule (explicit instruction, unambiguous pathname, media type, or sha256 duplicate match) — the model does not decide routing, code does.",
      "2. If none of those conditions resolve a single destination, ask with the candidate destinations pre-filled; remember the answer for the conversation.",
      "3. Call the matching upload tool (sources.upload, sources.add_revision, cx.upload_standard, evidence.capture, or evidence.create_record).",
      "4. Poll job.status until extractionStatus is completed and report the region count, or surface the failure honestly."
    ],
    preconditions: ["Upload tools are not built yet as of this wave (Slice 9) — list per plan intent. A sha256 match to an existing documentVersions row means already controlled: report the duplicate, upload nothing."]
  },
  {
    id: "capture-evidence",
    triggers: ["capture evidence", "field capture", "photo evidence", "log a reading in the field", "site evidence"],
    permission: "evidence:capture",
    tools: ["evidence.capture", "evidence.create_record"],
    steps: [
      "1. If a file is attached, call evidence.capture (multipart) so classifyEvidenceArtifact runs and the record lands pending.",
      "2. If it's metadata-only (no file), call evidence.create_record instead.",
      "3. Report the record's pending/non-final state, conversationally — the interface adds the link on its own."
    ],
    preconditions: ["Evidence always lands in a non-final state (validityState: pending) — the copilot never approves or finalizes it."]
  },
  {
    id: "add-controlled-record",
    triggers: ["add a system", "add an asset", "create a gate", "add an edge", "create a claim"],
    permission: "configuration:manage",
    tools: ["records.create_system", "records.create_asset", "records.create_gate", "records.create_edge", "claims.create"],
    steps: [
      "1. Determine which record type the user wants (system, asset, gate, edge, or claim) and gather its required fields.",
      "2. For records.create_edge, confirm both endpoints already exist in-project before calling.",
      "3. For claims.create, note the claim lands status: proposed — never present it as accepted.",
      "4. Call the matching create tool and report the new record, conversationally — the interface adds the link on its own."
    ],
    preconditions: [
      "records.create_system is unique on (projectId, name); records.create_asset on (projectId, tag); records.create_gate on (projectId, systemId, name).",
      "records.create_edge requires graph:manage, not configuration:manage — use whichever permission matches the specific record type being created.",
      "claims.create requires evidence:capture, not configuration:manage — same note."
    ]
  },
  {
    id: "manage-shipments",
    triggers: ["create a shipment", "bulk import shipments", "update shipment eta", "approve shipment plan", "materialize shipment"],
    permission: "schedule:manage",
    tools: ["shipments.create", "shipments.bulk_import", "shipments.update", "shipment_plans.act"],
    steps: [
      "1. For a new shipment, call shipments.create with the supplied details.",
      "2. For a CSV batch, call shipments.bulk_import.",
      "3. For status/ETA/position updates, call shipments.update — status is recomputed by calculateShipmentStatus; never assert a status the tool did not return.",
      "4. For plan actions (generate/approve/reject/materialize), call shipment_plans.act; materialize requires an approved plan and 409s otherwise — surface that plainly rather than retrying."
    ],
    preconditions: ["shipments.bulk_import is unavailable in degraded mode (Redis down) — refuse with an explanation rather than attempting it."]
  },
  {
    id: "run-compliance-analysis",
    triggers: ["run compliance check", "compliance analysis", "scan for compliance", "check against precedent", "compliance verdict"],
    permission: "requirement:review",
    tools: ["compliance.scan", "compliance.check_one"],
    steps: [
      "1. For a broad scan, call compliance.scan, which enqueues candidate-pair jobs; poll for completion.",
      "2. For a single known pair, call compliance.check_one instead.",
      "3. Summarize results by verdict and flag needs_engineering_judgment for human attention.",
      "4. Never present a verdict as final — every result carries reviewState: proposed."
    ],
    preconditions: ["Unavailable in degraded mode (Redis down) — refuse with an explanation rather than attempting the scan."]
  },
  {
    id: "export-data",
    triggers: ["export the project", "download a report", "generate turnover pack", "export as pdf", "export as csv"],
    permission: "audit:view",
    tools: ["export.project", "export.turnover_pack"],
    steps: [
      "1. For a general project export, call export.project with format (pdf or csv), title, and optional theme/watermark.",
      "2. For a turnover pack, first check that the target gate is already approved — do not attempt to approve it; approval is permanently off-limits.",
      "3. Call export.turnover_pack only once an approved gate is confirmed; state that the returned downloadUrl expires in 300 seconds.",
      "4. Report the download as started; the drawer performs the actual fetch/download client-side."
    ],
    preconditions: [
      "export.turnover_pack requires gate:approve, not audit:view — flag that a viewer-only user cannot use this half.",
      "export.turnover_pack requires an already-approved gate; the route 409s otherwise. This skill only checks for approval — it never performs it."
    ]
  }
];

/**
 * Simple case-insensitive substring/word matching of userMessage against each skill's triggers.
 * No model call, no fuzzy matching. Returns at most 3 skills, prioritized by trigger-match count
 * (skills with zero matches are excluded; ties keep registry order).
 */
export function selectRelevantSkills(userMessage: string, allSkills: Skill[] = skills): Skill[] {
  const haystack = userMessage.toLowerCase();
  const scored = allSkills
    .map((skill) => {
      const matchCount = skill.triggers.reduce(
        (count, trigger) => (haystack.includes(trigger.toLowerCase()) ? count + 1 : count),
        0
      );
      return { skill, matchCount };
    })
    .filter((entry) => entry.matchCount > 0);

  scored.sort((a, b) => b.matchCount - a.matchCount);
  return scored.slice(0, 3).map((entry) => entry.skill);
}

/** Serializes a list of skills into compact text suitable for injection into the system prompt. */
export function serializeSkillsForPrompt(skillsToSerialize: Skill[]): string {
  return skillsToSerialize
    .map((skill) => {
      const lines = [
        `## ${skill.id}`,
        `permission: ${skill.permission}`,
        `tools: ${skill.tools.join(", ")}`,
        `steps:`,
        ...skill.steps.map((step) => `  ${step}`)
      ];
      if (skill.preconditions.length > 0) {
        lines.push(`preconditions:`, ...skill.preconditions.map((p) => `  - ${p}`));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}
