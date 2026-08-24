/**
 * OWNED BY: A2-6 (Slice 6) — renders readiness.gates / readiness.gate_detail output as a gate readiness table.
 * Placeholder until that agent replaces this body with a real component. Keep the
 * prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Two real shapes land here (ChatbotHarnessPlan.md Slice 6):
 *  - readiness.gates (GET /api/projects/{id}/gates)      -> { items: GateRow[] }
 *  - readiness.gate_detail (lib getGateReviewContext)     -> GateDetail (single gate)
 * Both are handled below; anything else falls back to an honest "no data" note
 * rather than guessing a shape.
 */
import type { CSSProperties } from "react";
import type { Route } from "next";
import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";

type GateStatus = "not_started" | "in_review" | "ready" | "blocked" | "approved" | string;

interface GateRow {
  id: string;
  name: string;
  sequenceNumber?: string | number;
  approvalRole?: string;
  status: GateStatus;
  systemId?: string;
}

interface GatesListData {
  items: GateRow[];
}

interface GateReadinessDetail {
  state: string; // unknown | blocked | in_review | ready
  acceptedRequirements?: number;
  requiredEvidence?: number;
  acceptedEvidence?: number;
  missingEvidence?: number;
  unapprovedEvidence?: number;
  staleEvidence?: number;
  failedEvidence?: number;
  blockingFindings?: number;
  unmetPrerequisites?: number;
  blockingFindingDetails?: Array<{ id: string; title: string; severity: string }>;
  prerequisiteDetails?: Array<{ id: string; name: string; status: string }>;
}

interface GateDecision {
  id: string;
  decision: string;
  reason?: string | null;
  decidedAt?: string;
  actorName?: string;
}

interface AffectingTask {
  id: string;
  name: string;
  reviewState?: string;
}

interface GateDetailData {
  gate: { id: string; name: string; status: GateStatus; sequenceNumber?: string | number; approvalRole?: string };
  systemName?: string;
  readiness?: GateReadinessDetail;
  decisions?: GateDecision[];
  affectingTasks?: AffectingTask[];
}

function isListShape(data: unknown): data is GatesListData {
  return !!data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items);
}

function isDetailShape(data: unknown): data is GateDetailData {
  return !!data && typeof data === "object" && "gate" in (data as Record<string, unknown>);
}

const cellStyle: CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--line)", textAlign: "left" };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };

export function GateReadinessTable({ data }: { data: unknown }) {
  if (isListShape(data)) {
    if (!data.items.length) {
      return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No gates found for this project.</p>;
    }
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...cellStyle, ...labelStyle }}>Gate</th>
              <th style={{ ...cellStyle, ...labelStyle }}>Status</th>
              <th style={{ ...cellStyle, ...labelStyle }}>Approval role</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((gate) => (
              <tr key={gate.id}>
                <td style={{ ...cellStyle, color: "var(--ink)" }}>
                  <Link href={`/readiness?gate=${gate.id}` as Route} style={{ color: "inherit", textDecoration: "underline" }}>
                    {gate.name}
                  </Link>
                </td>
                <td style={cellStyle}><StatusPill status={gate.status} compact /></td>
                <td style={{ ...cellStyle, color: "var(--muted)" }}>{gate.approvalRole ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isDetailShape(data)) {
    const { gate, systemName, readiness, decisions, affectingTasks } = data;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/readiness?gate=${gate.id}` as Route} style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
            {gate.name}
          </Link>
          <StatusPill status={readiness?.state ?? gate.status} compact />
          {systemName && <span style={labelStyle}>{systemName}</span>}
        </div>

        {readiness && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <span><span style={labelStyle}>accepted evidence</span> {readiness.acceptedEvidence ?? "—"}{readiness.requiredEvidence != null ? ` / ${readiness.requiredEvidence}` : ""}</span>
            {typeof readiness.blockingFindings === "number" && <span><span style={labelStyle}>blocking findings</span> {readiness.blockingFindings}</span>}
            {typeof readiness.unmetPrerequisites === "number" && <span><span style={labelStyle}>unmet prerequisites</span> {readiness.unmetPrerequisites}</span>}
            {typeof readiness.staleEvidence === "number" && readiness.staleEvidence > 0 && <span><span style={labelStyle}>stale</span> {readiness.staleEvidence}</span>}
            {typeof readiness.failedEvidence === "number" && readiness.failedEvidence > 0 && <span><span style={labelStyle}>failed</span> {readiness.failedEvidence}</span>}
          </div>
        )}

        {readiness?.blockingFindingDetails && readiness.blockingFindingDetails.length > 0 && (
          <div>
            <p style={{ ...labelStyle, margin: "0 0 4px" }}>Blocking findings</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {readiness.blockingFindingDetails.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <Link href={`/actions?finding=${f.id}` as Route} style={{ color: "var(--ink)" }}>{f.title}</Link>
                  <span style={{ ...labelStyle, marginLeft: 6 }}>{f.severity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {affectingTasks && affectingTasks.length > 0 && (
          <div>
            <p style={{ ...labelStyle, margin: "0 0 4px" }}>Affecting schedule tasks</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {affectingTasks.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <Link href={`/schedule?task=${task.id}` as Route} style={{ color: "var(--ink)" }}>{task.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {decisions && decisions.length > 0 && (
          <div>
            <p style={{ ...labelStyle, margin: "0 0 4px" }}>Recent decisions</p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {decisions.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <span>{d.decision}</span>
                  {d.actorName && <span style={{ ...labelStyle, marginLeft: 6 }}>{d.actorName}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No gate readiness data available.</p>;
}
