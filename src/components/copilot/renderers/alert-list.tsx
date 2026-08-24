/**
 * OWNED BY: A2-6 (Slice 6) — renders alerts.list output as an alert list.
 * Placeholder until that agent replaces this body with a real component. Keep the
 * prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Real shape confirmed against GET /api/projects/{id}/alerts
 * (src/app/api/projects/[projectId]/alerts/route.ts): { items: AlertRow[] }
 * where AlertRow is the raw `alerts` table row (id, projectId, eventType,
 * dedupKey, status, title, payload, createdAt) — see AlertRow in
 * src/lib/dashboard-data.ts. `status` is the `alert_status` enum
 * (src/lib/db/schema.ts): only "active" | "cleared".
 */
import type { CSSProperties } from "react";
import { Pill } from "@/components/ui/glass";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

interface AlertRow {
  id: string;
  eventType: string;
  dedupKey?: string;
  status: string;
  title: string;
  payload?: unknown;
  createdAt: string;
}

interface AlertListData {
  items: AlertRow[];
}

function isAlertListShape(data: unknown): data is AlertListData {
  return !!data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items);
}

const STATUS_TONE: Record<string, StatusTone> = { active: "attention", cleared: "positive" };

const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AlertList({ data }: { data: unknown }) {
  if (!isAlertListShape(data)) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No alert data available.</p>;
  }
  if (!data.items.length) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No alerts for this project.</p>;
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
      {data.items.map((alert) => (
        <li key={alert.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Pill variant="neutral">{alert.eventType}</Pill>
            <span style={{ color: "var(--ink)" }}>{alert.title}</span>
            <StatusPill status={alert.status} tone={STATUS_TONE[alert.status]} compact />
          </div>
          <div style={{ ...labelStyle, marginTop: 2 }}>{formatDate(alert.createdAt)}</div>
        </li>
      ))}
    </ul>
  );
}
