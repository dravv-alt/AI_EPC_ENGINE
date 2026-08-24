import { z } from "zod";
import type { CopilotTool } from "@/lib/copilot/types";
import { callProjectRoute } from "@/lib/copilot/invoke";
import { answerKnowledgeQuery } from "@/lib/knowledge/pipeline";

// ── review.advisory path maps ──────────────────────────────────────────────
// Per Slice 7's endpoint table. Split into two tracks because the two groups
// of subject types are gated by two different permissions — see the design
// note above the tool entries below.
const requirementTrackPaths = {
  requirement: (id: string) => `/api/requirements/${id}/review`,
  evidence: (id: string) => `/api/evidence/${id}/review`,
  compliance_check: (id: string) => `/api/compliance/checks/${id}/review`,
  cx_checklist: (id: string) => `/api/cx/checklists/${id}/review`
} as const;
type RequirementTrackSubject = keyof typeof requirementTrackPaths;
const requirementTrackPath = (subjectType: RequirementTrackSubject, subjectId: string) => requirementTrackPaths[subjectType](subjectId);

const scheduleTrackPaths = {
  schedule_task: (id: string) => `/api/schedule/tasks/${id}/review`,
  schedule_resource: (id: string) => `/api/schedule/resources/${id}/review`,
  schedule_risk: (id: string) => `/api/schedule/risks/${id}/review`
} as const;
type ScheduleTrackSubject = keyof typeof scheduleTrackPaths;
const scheduleTrackPath = (subjectType: ScheduleTrackSubject, subjectId: string) => scheduleTrackPaths[subjectType](subjectId);

export const tools: CopilotTool[] = [
  {
    name: "cx.checklists",
    description: "List the project's Cx checklists with generation and review status.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/cx/checklists` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/cx/checklists`, args, "checklistSteps");
    }
  },
  {
    name: "cx.checklist_detail",
    description: "One Cx checklist's steps, clause citations, and test records.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ checklistId: z.string().uuid() }),
    transport: { kind: "http", method: "GET", path: (a) => `/api/cx/checklists/${a.checklistId}` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/cx/checklists/${a.checklistId}`, args, "checklistSteps");
    }
  },
  {
    name: "compliance.checks",
    description: "List the project's compliance checks with verdicts and requirement/target citations.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/compliance/checks` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/compliance/checks`, args, "complianceSummary");
    }
  },
  {
    name: "knowledge.search",
    description: "Answer a question from controlled project sources with citations; says so rather than guessing when nothing controlled matches.",
    permission: "audit:view",
    rateLimit: "ai",
    mutating: false,
    input: z.object({
      query: z.string().trim().min(3),
      documentType: z.string().trim().optional(),
      documentId: z.string().uuid().optional(),
      systemId: z.string().uuid().optional(),
      assetId: z.string().uuid().optional(),
      gateId: z.string().uuid().optional(),
      revision: z.string().trim().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional()
    }),
    // "lib" transport wrapping answerKnowledgeQuery, which does NOT
    // self-enforce (§2) — permission "audit:view" and rateLimit "ai" above
    // are asserted generically by invokeTool before execute runs; this
    // execute body does its own permission/rate-limit check for neither.
    transport: { kind: "lib" },
    async execute(ctx, args) {
      const a = args as {
        query: string;
        documentType?: string;
        documentId?: string;
        systemId?: string;
        assetId?: string;
        gateId?: string;
        revision?: string;
        dateFrom?: string;
        dateTo?: string;
      };
      const result = await answerKnowledgeQuery({
        projectId: ctx.projectId,
        query: a.query,
        documentType: a.documentType,
        documentId: a.documentId,
        systemId: a.systemId,
        assetId: a.assetId,
        gateId: a.gateId,
        revision: a.revision,
        dateFrom: a.dateFrom ? new Date(a.dateFrom) : undefined,
        dateTo: a.dateTo ? new Date(a.dateTo) : undefined
      });
      // §0 rule 6: `noResults` is passed through exactly as returned — never
      // swallowed or reshaped — so the loop/model can say "no results"
      // instead of fabricating an answer.
      return { ok: true, data: result, render: "citationList" };
    }
  },
  {
    name: "knowledge.similar_rfi",
    description: "Given RFI text, find semantically similar past RFIs, separating resolved precedent from unresolved matches.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ text: z.string().trim().min(3) }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/knowledge/rfi-similar` },
    async execute(ctx, args) {
      // No dedicated renderer key exists for this tool in the plan's Slice 6
      // table (it's a Slice-9-adjacent RFI-matching endpoint, not listed
      // among the 10 Slice 6 renderer keys). Its output — resolved/unresolved
      // citation-shaped suggestions with sourceRegionId/similarity — is
      // structurally the same shape as knowledge.search's, so it reuses
      // "citationList" rather than going unrendered.
      return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/knowledge/rfi-similar`, args, "citationList");
    }
  },

  // ── review.advisory ────────────────────────────────────────────────────
  // §0 rule 3 / Slice 7 instruction 2: review routes are write-forbidden.
  // Only the GET halves below (which return surfaceTeachbackAdvisory output)
  // may ever be wired into the copilot tool surface. The mutating
  // counterparts —
  //   PATCH /api/requirements/{id}/review
  //   POST  /api/evidence/{id}/review
  //   PATCH /api/compliance/checks/{id}/review
  //   POST  /api/cx/checklists/{id}/review
  //   POST  /api/schedule/tasks/{id}/review
  //   POST  /api/schedule/resources/{id}/review
  //   PATCH /api/schedule/risks/{id}/review
  // — each dispositions (accepts/edits/rejects) a proposed record. They are
  // PERMANENTLY EXCLUDED from this registry per §0 rule 3. Do not add them,
  // here or anywhere else, regardless of how convenient a future "let the
  // copilot just accept it" request sounds.
  //
  // Design note — the §2 permission trap, applied to a per-argument
  // permission requirement (documented per this wave's build instructions):
  // Slice 7's table gives what is conceptually one capability,
  // review.advisory({ subjectType, subjectId }), a permission that VARIES by
  // subjectType: requirement / evidence / compliance_check / cx_checklist
  // need "requirement:review"; schedule_task / schedule_resource /
  // schedule_risk need "schedule:manage". But `CopilotTool.permission` is a
  // single static field, and invokeTool asserts only that one field, once,
  // before calling execute — it never re-checks per-argument.
  //
  // Registering this as ONE tool with either permission as the single
  // declared value would silently widen access exactly as §2 warns:
  //   - declaring "schedule:manage" would let a scheduler-only user (who
  //     lacks requirement:review) successfully read a *requirement*'s
  //     advisory context, because invokeTool only ever checks the one
  //     declared string against the caller's role — it has no way to know
  //     the real requirement depends on the subjectType argument.
  //   - declaring "requirement:review" would symmetrically let a
  //     reviewer-only user (who lacks schedule:manage) read a
  //     *schedule_task*'s advisory context.
  // Having `execute` perform an extra internal permission check does not fix
  // this either: invokeTool has already run the tool's real work by the time
  // execute's own check could fire, and a bug or omission in that ad hoc
  // internal check would fail open with no test in Slice 13 able to catch it
  // (Slice 13 only checks the registry's declared `permission` field).
  //
  // Resolution: split into two registry entries, each with its own narrower
  // `subjectType` enum and its own fixed, correctly-scoped `permission`. For
  // each variant, invokeTool's single generic permission assertion is then a
  // complete and sufficient gate — not just a first line of defense — because
  // every subjectType a given tool accepts shares that tool's one declared
  // permission by construction (enforced at the type level via the narrowed
  // zod enum, not just by convention).
  {
    name: "review.advisory_requirement_track",
    description: "Prior human review corrections on a semantically similar requirement, evidence record, compliance check, or Cx checklist, with citations. Read-only.",
    permission: "requirement:review",
    mutating: false,
    input: z.object({
      subjectType: z.enum(["requirement", "evidence", "compliance_check", "cx_checklist"]),
      subjectId: z.string().uuid()
    }),
    transport: { kind: "http", method: "GET", path: (a) => requirementTrackPath(a.subjectType, a.subjectId) },
    async execute(ctx, args) {
      const { subjectType, subjectId } = args as { subjectType: RequirementTrackSubject; subjectId: string };
      // See "no dedicated key" note on knowledge.similar_rfi above —
      // surfaceTeachbackAdvisory output (prior corrections + citations) is
      // reused as "citationList" for the same reason.
      return callProjectRoute(ctx, "GET", () => requirementTrackPath(subjectType, subjectId), args, "citationList");
    }
  },
  {
    name: "review.advisory_schedule_track",
    description: "Prior human review corrections on a semantically similar schedule task, resource, or risk, with citations. Read-only.",
    permission: "schedule:manage",
    mutating: false,
    input: z.object({
      subjectType: z.enum(["schedule_task", "schedule_resource", "schedule_risk"]),
      subjectId: z.string().uuid()
    }),
    transport: { kind: "http", method: "GET", path: (a) => scheduleTrackPath(a.subjectType, a.subjectId) },
    async execute(ctx, args) {
      const { subjectType, subjectId } = args as { subjectType: ScheduleTrackSubject; subjectId: string };
      return callProjectRoute(ctx, "GET", () => scheduleTrackPath(subjectType, subjectId), args, "citationList");
    }
  }
];
