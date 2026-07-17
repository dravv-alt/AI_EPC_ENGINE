"use client";

import { FormEvent, useEffect, useState } from "react";
import { LocateFixed, RefreshCw, Ship } from "lucide-react";
import { ShipmentMapLoader } from "@/components/shipment-map-loader";
import type { MapShipment } from "@/components/shipment-map";

type Shipment = MapShipment & { equipmentId: string | null; destinationName: string | null; mmsi: string | null; requiredOnSite: Date | string; portCongestion: boolean; weatherDelayFactor: string; telemetryReason: string | null; lastPolledAt: Date | string | null };
type Asset = { id: string; tag: string; assetType: string };

export function ShipmentWorkbench({ projectId, initialShipments, assets }: { projectId: string; initialShipments: Shipment[]; assets: Asset[] }) {
  const [shipments, setShipments] = useState(initialShipments);
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/projects/${projectId}/shipments`); const body = await response.json();
    if (response.ok) setShipments(body.items);
  }
  useEffect(() => { const interval = setInterval(refresh, 30_000); return () => clearInterval(interval); }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setSaving(true);
    const response = await fetch(`/api/projects/${projectId}/shipments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: values.get("name"), equipmentId: values.get("equipmentId"), origin: { name: values.get("originName"), lat: Number(values.get("originLat")), lng: Number(values.get("originLng")) }, destination: { name: values.get("destinationName"), lat: Number(values.get("destinationLat")), lng: Number(values.get("destinationLng")) }, mmsi: values.get("mmsi") || undefined, plannedEta: new Date(String(values.get("plannedEta"))).toISOString(), requiredOnSite: new Date(String(values.get("requiredOnSite"))).toISOString(), portCongestion: values.get("portCongestion") === "on", weatherDelayFactor: 0 }) });
    const result = await response.json(); setSaving(false); setMessage(response.ok ? `Shipment registered as ${result.shipment.status.toUpperCase()} estimated status.${result.eventWarning ? ` Event warning: ${result.eventWarning}` : ""}` : result.error ?? "Could not register shipment.");
    if (response.ok) { form.reset(); await refresh(); setSelectedId(result.shipment.id); }
  }

  async function update(shipment: Shipment, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setSaving(true);
    const response = await fetch(`/api/shipments/${shipment.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ plannedEta: new Date(String(values.get("plannedEta"))).toISOString(), portCongestion: values.get("portCongestion") === "on" }) });
    const body = await response.json(); setSaving(false); setMessage(response.ok ? body.transition ? `Transition ${body.transition.replaceAll("_", " ")} recorded server-side.` : "ETA updated; no status transition was emitted." : body.error); if (response.ok) await refresh();
  }

  return <div className="workflow-stack">
    <details className="surface history-panel"><summary>Register single-leg shipment</summary><form className="shipment-registration" onSubmit={submit}><label>Shipment name<input name="name" minLength={3} required /></label><label>Equipment<select name="equipmentId" required><option value="">Select registered asset</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.tag} · {asset.assetType}</option>)}</select></label><label>MMSI<input name="mmsi" inputMode="numeric" pattern="[0-9]{7,9}" placeholder="Optional 7–9 digits" /></label><fieldset><legend>Origin</legend><input name="originName" defaultValue="Mumbai Port" required /><input name="originLat" type="number" step="any" min="-90" max="90" defaultValue="18.95" required /><input name="originLng" type="number" step="any" min="-180" max="180" defaultValue="72.93" required /></fieldset><fieldset><legend>Destination</legend><input name="destinationName" defaultValue="Project site" required /><input name="destinationLat" type="number" step="any" min="-90" max="90" defaultValue="19.08" required /><input name="destinationLng" type="number" step="any" min="-180" max="180" defaultValue="73.02" required /></fieldset><label>Planned ETA<input name="plannedEta" type="datetime-local" required /></label><label>Required on site<input name="requiredOnSite" type="datetime-local" required /></label><label className="check-label"><input name="portCongestion" type="checkbox" /> Manual port congestion</label><button className="button button-primary" disabled={saving || !assets.length}><Ship size={16} />Register shipment</button></form></details>
    {message && <p className="surface inline-feedback" role="status">{message}</p>}
    <section className="shipment-layout"><div className="surface map-surface"><ShipmentMapLoader shipments={shipments} selectedId={selectedId} /><p className="map-attribution-note">Routes are great-circle estimates. OpenStreetMap tiles © contributors, ODbL. Positions are explicitly labelled live AIS or simulated.</p></div><aside className="surface shipment-navigator"><div className="section-heading"><div><p className="eyebrow">30-second polling</p><h2>Shipment navigator</h2></div><button className="icon-button" aria-label="Refresh shipments" onClick={refresh}><RefreshCw size={16} /></button></div>{shipments.map((shipment) => <article className={`shipment-row ${selectedId === shipment.id ? "is-selected" : ""}`} key={shipment.id}><button onClick={() => setSelectedId(shipment.id)}><LocateFixed size={16} /><div><b>{shipment.name}</b><span>{shipment.originName ?? "Unknown origin"} → {shipment.destinationName ?? "Unknown destination"}</span></div><span className={`shipment-status ${shipment.status}`}>{shipment.status}</span></button><div className="shipment-metadata"><span>{shipment.positionSource === "live" ? "Live AIS fix" : "Simulated position"}</span><span>ETA estimate {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(shipment.weatherAdjustedEta ?? shipment.plannedEta))}</span><span>Weather factor {Number(shipment.weatherDelayFactor).toFixed(2)} · {shipment.portCongestion ? "manual congestion on" : "congestion off"}</span>{shipment.telemetryReason && <span>{shipment.telemetryReason}</span>}</div><form className="shipment-update" onSubmit={(event) => update(shipment, event)}><input name="plannedEta" aria-label={`Updated planned ETA for ${shipment.name}`} type="datetime-local" defaultValue={new Date(shipment.plannedEta).toISOString().slice(0, 16)} /><label><input name="portCongestion" type="checkbox" defaultChecked={shipment.portCongestion} /> congestion</label><button className="button button-secondary" disabled={saving}>Recalculate</button></form></article>)}{!shipments.length && <div className="empty-state"><h2>No shipments</h2><p>Register equipment movement to begin transparent simulated/live tracking.</p></div>}</aside></section>
  </div>;
}
