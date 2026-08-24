/**
 * OWNED BY: A2-7 (Slice 6) — renders shipments.list output as a shipment table.
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Confirmed shape (src/app/api/projects/[projectId]/shipments/route.ts GET):
 * { items: Shipment[], estimate: true, pollingSeconds: 30 }
 * Shipment (src/lib/db/schema.ts): id, name, transportMode, originName, destinationName,
 * status ("green"|"amber"|"red"|"delivered"), plannedEta, weatherAdjustedEta, positionSource,
 * mmsi, requiredOnSite, portCongestion, telemetryReason.
 */
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

type Shipment = {
  id?: string;
  name?: string;
  transportMode?: string;
  originName?: string | null;
  destinationName?: string | null;
  status?: string;
  plannedEta?: string;
  weatherAdjustedEta?: string | null;
  positionSource?: string;
};

function statusTone(status: string | undefined): StatusTone | undefined {
  switch (status) {
    case "green":
      return "positive";
    case "amber":
      return "attention";
    case "red":
      return "danger";
    case "delivered":
      return "information";
    default:
      return undefined;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function ShipmentTable({ data }: { data: unknown }) {
  const items = data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
    ? ((data as { items: Shipment[] }).items)
    : null;

  if (!items) {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }

  if (items.length === 0) {
    return <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>No shipments found.</p>;
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: "var(--radius-control)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Shipment</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Mode</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Route</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Status</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Planned ETA</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Weather-adjusted ETA</th>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>Position</th>
          </tr>
        </thead>
        <tbody>
          {items.map((shipment, i) => (
            <tr key={shipment.id ?? i} style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "6px 10px", color: "var(--ink)" }}>{shipment.name ?? "—"}</td>
              <td style={{ padding: "6px 10px", color: "var(--ink)" }}>{shipment.transportMode ?? "—"}</td>
              <td style={{ padding: "6px 10px", color: "var(--ink)" }}>
                {(shipment.originName ?? "—")} → {(shipment.destinationName ?? "—")}
              </td>
              <td style={{ padding: "6px 10px" }}>
                {shipment.status
                  ? <StatusPill status={shipment.status} tone={statusTone(shipment.status)} compact />
                  : "—"}
              </td>
              <td style={{ padding: "6px 10px", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 11 }}>{formatDate(shipment.plannedEta)}</td>
              <td style={{ padding: "6px 10px", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 11 }}>{formatDate(shipment.weatherAdjustedEta)}</td>
              <td style={{ padding: "6px 10px", color: "var(--muted)" }}>{shipment.positionSource ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
