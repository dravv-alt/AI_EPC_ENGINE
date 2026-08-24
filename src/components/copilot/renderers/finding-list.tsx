/**
 * Renders both shapes this key receives (found via live testing — Slice 8's
 * findings.create/findings.update tools also render "findingList" but return
 * a single record, not a list):
 *   - GET /api/projects/{id}/findings (findings.list): { items: Finding[] }
 *   - POST .../findings (findings.create): { finding: Finding }
 *   - PATCH /api/findings/{id} (findings.update): { finding: Finding, readiness }
 * Before this fix, the single-finding shape always fell through to the
 * "No finding data available" empty state — the write tools' own results
 * never rendered. Keep the prop shape ({ data: unknown }) — do not import
 * CopilotRendererProps from "./index" here, that would create a circular
 * import with the registry file.
 */
import type { CSSProperties } from "react";
import type { Route } from "next";
import Link from "next/link";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

interface FindingRow {
  id: string;
  gateId: string | null;
  title: string;
  description?: string | null;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "in_progress" | "closed" | string;
  ownerId: string | null;
  ownerName?: string | null;
  dueAt: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
}

interface FindingListData {
  items: FindingRow[];
}

interface SingleFindingData {
  finding: FindingRow;
}

function isFindingListShape(data: unknown): data is FindingListData {
  return !!data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items);
}

function isSingleFindingShape(data: unknown): data is SingleFindingData {
  return !!data && typeof data === "object" && !!(data as { finding?: unknown }).finding && typeof (data as { finding?: unknown }).finding === "object";
}

const SEVERITY_TONE: Record<string, StatusTone> = { critical: "danger", high: "danger", medium: "attention", low: "neutral" };
const STATUS_TONE: Record<string, StatusTone> = { open: "attention", in_progress: "information", closed: "positive" };

const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };

function formatDue(dueAt: string | null) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  return Number.isNaN(date.getTime()) ? dueAt : date.toLocaleDateString();
}

function FindingRowItem({ finding }: { finding: FindingRow }) {
  const due = formatDue(finding.dueAt);
  return (
    <li style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/actions?finding=${finding.id}` as Route} style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
          {finding.title}
        </Link>
        <StatusPill status={finding.severity} tone={SEVERITY_TONE[finding.severity]} compact />
        <StatusPill status={finding.status} tone={STATUS_TONE[finding.status]} compact />
      </div>
      <div style={{ ...labelStyle, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {finding.ownerName && <span>owner: {finding.ownerName}</span>}
        {due && <span>due: {due}</span>}
      </div>
    </li>
  );
}

export function FindingList({ data }: { data: unknown }) {
  if (isSingleFindingShape(data)) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
        <FindingRowItem finding={data.finding} />
      </ul>
    );
  }
  if (!isFindingListShape(data)) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No finding data available.</p>;
  }
  if (!data.items.length) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No findings for this project.</p>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
      {data.items.map((finding) => <FindingRowItem key={finding.id} finding={finding} />)}
    </ul>
  );
}
