/**
 * OWNED BY: A2-7 (Slice 6) — renders shipments.detail output: status, plannedEta vs
 * weatherAdjustedEta, positionSource, telemetryReason, routeAvailable (explain why when false).
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Confirmed shape (src/app/api/shipments/[shipmentId]/route.ts GET):
 * { shipment, route: RouteSegment[], routeStart?, weather?, estimate: true,
 *   routeAvailable: boolean, reason?: string }
 * `reason` (top-level) explains why routeAvailable is false — the route module fails
 * closed rather than drawing a fake great-circle (no coordinates, or no computable route).
 * `shipment.telemetryReason` is a separate field: why the current position is/isn't live
 * telemetry (e.g. "Position remains simulated until live telemetry is linked.").
 */
import type { CSSProperties } from "react";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/glass";

type Shipment = {
  id?: string;
  name?: string;
  status?: string;
  plannedEta?: string;
  weatherAdjustedEta?: string | null;
  positionSource?: string;
  telemetryReason?: string | null;
};

type ShipmentDetailData = {
  shipment?: Shipment;
  routeAvailable?: boolean;
  reason?: string;
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

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
  borderBottom: "1px solid var(--line)",
  fontSize: 12,
};

const labelStyle: CSSProperties = { color: "var(--muted)" };
const valueStyle: CSSProperties = { color: "var(--ink)", textAlign: "right" };

export function ShipmentDetail({ data }: { data: unknown }) {
  if (!data || typeof data !== "object" || !("shipment" in data)) {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }
  const { shipment, routeAvailable, reason } = data as ShipmentDetailData;
  if (!shipment) {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-control)", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ color: "var(--ink)", fontSize: 13 }}>{shipment.name ?? "Shipment"}</strong>
        {shipment.status ? <StatusPill status={shipment.status} tone={statusTone(shipment.status)} compact /> : null}
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Planned ETA</span>
        <span style={{ ...valueStyle, fontFamily: "var(--mono)" }}>{formatDate(shipment.plannedEta)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Weather-adjusted ETA</span>
        <span style={{ ...valueStyle, fontFamily: "var(--mono)" }}>{formatDate(shipment.weatherAdjustedEta)}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Position source</span>
        <span style={valueStyle}>{shipment.positionSource ?? "—"}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Telemetry reason</span>
        <span style={valueStyle}>{shipment.telemetryReason ?? "—"}</span>
      </div>
      <div style={{ ...rowStyle, borderBottom: routeAvailable === false ? "none" : rowStyle.borderBottom }}>
        <span style={labelStyle}>Route available</span>
        <span style={valueStyle}>
          {routeAvailable === undefined ? "—" : <Pill variant={routeAvailable ? "accent" : "danger"}>{routeAvailable ? "Yes" : "No"}</Pill>}
        </span>
      </div>

      {routeAvailable === false && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: "var(--radius-control)",
            background: "rgba(200, 60, 60, 0.08)",
            border: "1px solid var(--line)",
            fontSize: 12,
            color: "var(--ink)",
          }}
        >
          <strong style={{ fontSize: 11, color: "var(--muted)" }}>Why no route:</strong>{" "}
          {reason ?? "No reason was returned — the app fails closed rather than drawing a fake route."}
        </div>
      )}
    </div>
  );
}
