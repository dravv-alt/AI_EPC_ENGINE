/**
 * OWNED BY: A2-7 (Slice 6) — renders compliance.checks output as a compliance summary.
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Confirmed shape (src/app/api/projects/[projectId]/compliance/checks/route.ts GET):
 * { items: [{ id, requirementId, targetSourceRegionId, comparisonType, verdict, reviewState,
 *   confidence, reason, findingDisposition, reviewedBy, reviewedAt, reviewerName,
 *   requirementCitation, targetCitation }] }
 * `reviewState` is the reviewState enum: proposed | accepted | edited | rejected
 * (src/lib/db/schema.ts). `verdict` is a free-text string produced by createComplianceCheck
 * (e.g. "match"/"mismatch"/"needs_engineering_judgment" per plan Slice 11). Per §0 rule 2,
 * an AI-created check always lands reviewState="proposed" — displayed as-is, never phrased
 * as a final "Passed"/"Approved".
 */
import { StatusPill } from "@/components/ui/status-pill";

type ComplianceCheck = {
  id?: string;
  comparisonType?: string;
  verdict?: string;
  reviewState?: string;
  confidence?: string | number;
  reason?: string;
  findingDisposition?: string;
};

function confidencePct(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

export function ComplianceSummary({ data }: { data: unknown }) {
  const items = data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
    ? ((data as { items: ComplianceCheck[] }).items)
    : null;

  if (!items) {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }

  if (items.length === 0) {
    return <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No compliance checks found.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((check, i) => (
        <div key={check.id ?? i} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: "8px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink)" }}>
              {check.verdict ? check.verdict.replace(/_/g, " ") : "—"}
              {check.comparisonType && <span style={{ color: "var(--muted)" }}> · {check.comparisonType}</span>}
            </span>
            {check.reviewState ? <StatusPill status={check.reviewState} compact /> : null}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
            <span>{check.reason ?? "—"}</span>
            <span style={{ whiteSpace: "nowrap", marginLeft: 8 }}>confidence {confidencePct(check.confidence)}</span>
          </div>
          {check.findingDisposition && check.findingDisposition !== "not_applicable" && (
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)" }}>
              Finding: {check.findingDisposition.replace(/_/g, " ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
