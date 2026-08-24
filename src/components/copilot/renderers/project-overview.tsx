/**
 * OWNED BY: A2-6 (Slice 6, bonus key from A1-1's project.overview tool) — renders getDashboardData output.
 * Placeholder until that agent replaces this body with a real component. Keep the
 * prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Real shape confirmed against `DashboardData`
 * (src/lib/dashboard-data.ts): project, projectCode, gate, openIssueCount,
 * readiness[] ({ gateId, gate, system, state, detail }), and
 * insights.operations { shipments, delayedShipments, scheduleVersion,
 * scheduleStatus, activeAlerts }. This is a compact overview render, not a
 * full field dump — only a high-level summary is shown.
 */
import type { CSSProperties } from "react";
import { StatCard } from "@/components/ui/glass";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

interface ReadinessRow {
  gateId: string;
  gate: string;
  system: string;
  state: "ready" | "review" | "blocked" | "unknown" | string;
  detail: string;
}

interface DashboardDataShape {
  project: string;
  projectCode: string;
  gate: string;
  openIssueCount: number;
  readiness: ReadinessRow[];
  insights?: {
    operations?: {
      shipments?: number;
      delayedShipments?: number;
      scheduleVersion?: number | null;
      scheduleStatus?: string;
      activeAlerts?: number;
    };
  };
}

function isDashboardShape(data: unknown): data is DashboardDataShape {
  return !!data && typeof data === "object" && typeof (data as { project?: unknown }).project === "string";
}

const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };
const READINESS_TONE: Record<string, StatusTone> = { ready: "positive", review: "attention", blocked: "danger", unknown: "neutral" };

export function ProjectOverview({ data }: { data: unknown }) {
  if (!isDashboardShape(data)) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No project overview data available.</p>;
  }

  const ops = data.insights?.operations;
  const readinessCounts = data.readiness.reduce<Record<string, number>>((acc, row) => {
    acc[row.state] = (acc[row.state] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--ink)", fontSize: 13 }}>{data.project}</strong>
        <span style={labelStyle}>{data.projectCode}</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{data.gate}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Open issues" value={data.openIssueCount} />
        {ops?.shipments != null && (
          <StatCard
            label="Shipments"
            value={ops.shipments}
            detail={ops.delayedShipments ? `${ops.delayedShipments} delayed` : undefined}
          />
        )}
        {ops?.activeAlerts != null && <StatCard label="Active alerts" value={ops.activeAlerts} />}
        {ops?.scheduleVersion != null && (
          <StatCard label="Schedule" value={`v${ops.scheduleVersion}`} detail={ops.scheduleStatus} />
        )}
      </div>

      {data.readiness.length > 0 && (
        <div>
          <p style={{ ...labelStyle, margin: "0 0 4px" }}>Gate readiness</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(readinessCounts).map(([state, count]) => (
              <StatusPill key={state} status={`${count} ${state}`} tone={READINESS_TONE[state]} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
