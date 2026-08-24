/**
 * OWNED BY: A2-7 (Slice 6) — renders schedule.current/.versions/.diff output as a timeline.
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Confirmed shapes (src/lib/schedule/read-model.ts, src/app/api/projects/[projectId]/schedule/versions/route.ts):
 * - schedule.current  -> a single version object with an `assignments` array (NOT `tasks`):
 *     { id, versionNumber, reason, solverStatus, ..., assignments: [{ id, taskId, taskName, startAt, endAt, isCritical }] }
 * - schedule.versions -> { versions: [ <version-with-assignments>, ... ] }
 * - schedule.diff     -> { current, against, shiftedTasks, added, removed, netDeadlineImpactHours }
 * This component detects which shape it received and renders accordingly, falling back to
 * raw JSON for anything else so it never crashes on an unrecognized shape.
 */
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/glass";

type Assignment = { id?: string; taskId?: string; taskName?: string; startAt?: string; endAt?: string; isCritical?: boolean };
type Version = { id?: string; versionNumber?: number; reason?: string; solverStatus?: string; assignments?: Assignment[] };
type DiffRow = { taskId?: string; taskName?: string; beforeStart?: string; afterStart?: string; beforeEnd?: string; afterEnd?: string; shiftHours?: number };
type DiffData = { current?: Version; against?: Version | null; shiftedTasks?: DiffRow[]; added?: Assignment[]; removed?: Assignment[]; netDeadlineImpactHours?: number };

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AssignmentTable({ assignments }: { assignments: Assignment[] }) {
  if (!assignments.length) return <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: 12 }}>No task assignments.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "4px 8px", color: "var(--muted)", fontWeight: 500 }}>Task</th>
            <th style={{ padding: "4px 8px", color: "var(--muted)", fontWeight: 500 }}>Start</th>
            <th style={{ padding: "4px 8px", color: "var(--muted)", fontWeight: 500 }}>End</th>
            <th style={{ padding: "4px 8px", color: "var(--muted)", fontWeight: 500 }}>Critical</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a, i) => (
            <tr key={a.id ?? i} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "4px 8px", color: "var(--ink)" }}>{a.taskName ?? a.taskId ?? "—"}</td>
              <td style={{ padding: "4px 8px", color: "var(--ink)", fontFamily: "var(--mono)" }}>{formatDate(a.startAt)}</td>
              <td style={{ padding: "4px 8px", color: "var(--ink)", fontFamily: "var(--mono)" }}>{formatDate(a.endAt)}</td>
              <td style={{ padding: "4px 8px" }}>{a.isCritical ? <Pill variant="danger">critical</Pill> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionBlock({ version }: { version: Version }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ fontSize: 12, color: "var(--ink)" }}>Version {version.versionNumber ?? "—"}</strong>
        {version.solverStatus ? <StatusPill status={version.solverStatus} compact /> : null}
      </div>
      {version.reason && <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--muted)" }}>{version.reason}</p>}
      <AssignmentTable assignments={version.assignments ?? []} />
    </div>
  );
}

export function ScheduleTimeline({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }
  const obj = data as Record<string, unknown>;

  // schedule.versions shape: { versions: [...] }
  if (Array.isArray(obj.versions)) {
    const versions = obj.versions as Version[];
    if (!versions.length) return <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No schedule versions yet.</p>;
    return <div>{versions.map((v, i) => <VersionBlock key={v.id ?? i} version={v} />)}</div>;
  }

  // schedule.diff shape: has shiftedTasks/added/removed
  if ("shiftedTasks" in obj || "added" in obj || "removed" in obj) {
    const diff = data as DiffData;
    return (
      <div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>Net deadline impact</span>
          <strong style={{ color: "var(--ink)" }}>
            {diff.netDeadlineImpactHours === undefined ? "—" : `${diff.netDeadlineImpactHours}h`}
          </strong>
        </div>
        {!diff.against && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>No prior version to diff against.</p>
        )}
        {diff.shiftedTasks && diff.shiftedTasks.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 11, color: "var(--muted)" }}>Shifted ({diff.shiftedTasks.length})</strong>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                <tbody>
                  {diff.shiftedTasks.map((row, i) => (
                    <tr key={row.taskId ?? i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "4px 8px", color: "var(--ink)" }}>{row.taskName ?? row.taskId ?? "—"}</td>
                      <td style={{ padding: "4px 8px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                        {formatDate(row.beforeEnd)} → {formatDate(row.afterEnd)}
                      </td>
                      <td style={{ padding: "4px 8px", color: "var(--ink)" }}>
                        {row.shiftHours === undefined ? "—" : `${row.shiftHours > 0 ? "+" : ""}${row.shiftHours}h`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {diff.added && diff.added.length > 0 && (
          <p style={{ margin: "4px 0", fontSize: 12 }}><Pill variant="accent">added</Pill> {diff.added.length} task(s)</p>
        )}
        {diff.removed && diff.removed.length > 0 && (
          <p style={{ margin: "4px 0", fontSize: 12 }}><Pill variant="danger">removed</Pill> {diff.removed.length} task(s)</p>
        )}
      </div>
    );
  }

  // schedule.current shape: a single version object with assignments
  if (Array.isArray(obj.assignments)) {
    return <VersionBlock version={data as Version} />;
  }

  return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
}
