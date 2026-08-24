/**
 * OWNED BY: A2-7 (Slice 6) — renders cx.checklists/.checklist_detail output as checklist steps.
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Confirmed shapes:
 * - cx.checklists (src/app/api/projects/[projectId]/cx/checklists/route.ts GET):
 *     { items: [{ id, title, status, systemId, gateId, assetId, generationStatus, ... }] }
 *   `status` is the checklistStatus enum: draft | accepted | rejected (src/lib/db/schema.ts).
 * - cx.checklist_detail (src/app/api/cx/checklists/[checklistId]/route.ts GET):
 *     { checklist, steps: [{ id, sequenceNumber, instruction, modality, parameter, nominalValue,
 *       unit, tolerance, expectedBoolean, narrativeCriterion, required, reviewState, reviewNote }],
 *       citations, records, results: [{ stepId, verdict, readingValue, readingBoolean, readingText }] }
 *   `reviewState` is the reviewState enum: proposed | accepted | edited | rejected (per step).
 *   `results[].verdict` is CxVerdict: proposed_pass | proposed_fail | needs_human_review
 *   (src/lib/cx/acceptance.ts) — displayed as-is, never phrased as a final pass/fail (§0 rule 2).
 */
import { StatusPill } from "@/components/ui/status-pill";

type ChecklistSummary = { id?: string; title?: string; status?: string; generationStatus?: string };
type Step = {
  id?: string;
  sequenceNumber?: string | number;
  instruction?: string;
  modality?: string;
  parameter?: string | null;
  nominalValue?: string | number | null;
  unit?: string | null;
  tolerance?: string | number | null;
  expectedBoolean?: boolean | null;
  narrativeCriterion?: string | null;
  required?: boolean;
  reviewState?: string;
};
type StepResult = { stepId?: string; verdict?: string; readingValue?: string | number | null; readingBoolean?: boolean | null; readingText?: string | null };

function criterionText(step: Step): string {
  if (step.modality === "boolean") return step.expectedBoolean === null || step.expectedBoolean === undefined ? "—" : `expect ${step.expectedBoolean ? "true" : "false"}`;
  if (step.modality === "narrative") return step.narrativeCriterion ?? "—";
  if (step.nominalValue !== null && step.nominalValue !== undefined) {
    return `${step.nominalValue}${step.unit ? ` ${step.unit}` : ""}${step.tolerance !== null && step.tolerance !== undefined ? ` ± ${step.tolerance}` : ""}`;
  }
  return "—";
}

function verdictLabel(verdict: string | undefined): string {
  // Render the real state string as-is (spaces, not invented "pass"/"fail" prose).
  if (!verdict) return "—";
  return verdict.replace(/_/g, " ");
}

function ChecklistList({ items }: { items: ChecklistSummary[] }) {
  if (!items.length) return <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No checklists found.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div
          key={item.id ?? i}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "8px 10px" }}
        >
          <span style={{ fontSize: 12, color: "var(--ink)" }}>{item.title ?? "Untitled checklist"}</span>
          {item.status ? <StatusPill status={item.status} compact /> : null}
        </div>
      ))}
    </div>
  );
}

function ChecklistDetail({ checklist, steps, results }: { checklist: ChecklistSummary; steps: Step[]; results: StepResult[] }) {
  const resultByStep = new Map(results.filter((r) => r.stepId).map((r) => [r.stepId as string, r]));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: "var(--ink)" }}>{checklist.title ?? "Checklist"}</strong>
        {checklist.status ? <StatusPill status={checklist.status} compact /> : null}
      </div>
      {steps.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>No steps generated yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {steps
            .slice()
            .sort((a, b) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0))
            .map((step, i) => {
              const result = step.id ? resultByStep.get(step.id) : undefined;
              return (
                <div key={step.id ?? i} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--ink)" }}>
                      {step.sequenceNumber !== undefined ? `${step.sequenceNumber}. ` : ""}
                      {step.instruction ?? "—"}
                      {step.required === false && <span style={{ color: "var(--muted)" }}> (optional)</span>}
                    </span>
                    {step.reviewState ? <StatusPill status={step.reviewState} compact /> : null}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
                    <span>Criterion: {criterionText(step)}</span>
                    {result && <span>Verdict: {verdictLabel(result.verdict)}</span>}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function ChecklistSteps({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.items)) {
    return <ChecklistList items={obj.items as ChecklistSummary[]} />;
  }

  if (obj.checklist && typeof obj.checklist === "object") {
    const steps = Array.isArray(obj.steps) ? (obj.steps as Step[]) : [];
    const results = Array.isArray(obj.results) ? (obj.results as StepResult[]) : [];
    return <ChecklistDetail checklist={obj.checklist as ChecklistSummary} steps={steps} results={results} />;
  }

  return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
}
