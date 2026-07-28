"use client";

import { FormEvent, useEffect, useState } from "react";
import { LocateFixed, RefreshCw, Ship, AlertTriangle } from "lucide-react";
import { ShipmentMapLoader } from "@/components/shipment-map-loader";
import type { MapShipment, RouteThreatAssessment } from "@/components/shipment-map";
import { LocationSearch } from "@/components/location-search";
import { assessRouteThreats } from "@/lib/weather/route-threats";
import { getShipmentRoute } from "@/lib/routing";

type Shipment = MapShipment & { equipmentId: string | null; destinationName: string | null; mmsi: string | null; transportMode: "sea" | "air" | "land"; assessedThreats?: unknown; requiredOnSite: Date | string; portCongestion: boolean; weatherDelayFactor: string; telemetryReason: string | null; lastPolledAt: Date | string | null };
type Asset = { id: string; tag: string; assetType: string };

export function ShipmentWorkbench({ projectId, initialShipments, assets, initialShipmentId }: { projectId: string; initialShipments: Shipment[]; assets: Asset[]; initialShipmentId?: string }) {
  const [shipments, setShipments] = useState(initialShipments);
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [threatAssessments, setThreatAssessments] = useState<Record<string, RouteThreatAssessment>>({});

  // State for Location Search selections
  const [origin, setOrigin] = useState<{name: string, lat: number, lng: number} | null>(null);
  const [destination, setDestination] = useState<{name: string, lat: number, lng: number} | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!initialShipmentId || !shipments.some((shipment) => shipment.id === initialShipmentId)) return;
    setSelectedId(initialShipmentId);
    requestAnimationFrame(() => document.getElementById(`shipment-${initialShipmentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [initialShipmentId, shipments]);

  async function refresh() {
    const response = await fetch(`/api/projects/${projectId}/shipments`); const body = await response.json();
    if (response.ok) setShipments(body.items);
  }
  useEffect(() => { const interval = setInterval(refresh, 30_000); return () => clearInterval(interval); }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin || !destination) {
      setMessage("Please select both origin and destination from the dropdowns.");
      return;
    }
    const form = event.currentTarget; const values = new FormData(form); setSaving(true);
    const response = await fetch(`/api/projects/${projectId}/shipments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.get("name"),
        equipmentId: values.get("equipmentId"),
        transportMode: values.get("transportMode") || "sea",
        origin: { name: origin.name, lat: origin.lat, lng: origin.lng },
        destination: { name: destination.name, lat: destination.lat, lng: destination.lng },
        mmsi: values.get("mmsi") || undefined,
        plannedEta: new Date(String(values.get("plannedEta"))).toISOString(),
        requiredOnSite: new Date(String(values.get("requiredOnSite"))).toISOString(),
        portCongestion: values.get("portCongestion") === "on",
        weatherDelayFactor: 0
      })
    });
    const result = await response.json(); setSaving(false); setMessage(response.ok ? `Shipment registered as ${result.shipment.status.toUpperCase()} estimated status.${result.eventWarning ? ` Event warning: ${result.eventWarning}` : ""}` : result.error ?? "Could not register shipment.");
    if (response.ok) {
      form.reset();
      setOrigin(null);
      setDestination(null);
      await refresh();
      setSelectedId(result.shipment.id);
    }
  }

  async function update(shipment: Shipment, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget); setSaving(true);
    const response = await fetch(`/api/shipments/${shipment.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ plannedEta: new Date(String(values.get("plannedEta"))).toISOString(), portCongestion: values.get("portCongestion") === "on" }) });
    const body = await response.json(); setSaving(false); setMessage(response.ok ? body.transition ? `Transition ${body.transition.replaceAll("_", " ")} recorded server-side.` : "ETA updated; no status transition was emitted." : body.error); if (response.ok) await refresh();
  }

  async function markDelivered(shipment: Shipment) {
    setSaving(true);
    const response = await fetch(`/api/shipments/${shipment.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "delivered" }) });
    const body = await response.json(); setSaving(false); setMessage(response.ok ? "Shipment marked as delivered." : body.error); if (response.ok) await refresh();
  }

  async function assessRoute(shipment: Shipment) {
    setSaving(true);
    setMessage("Computing route and sampling weather...");
    try {
      const segments = await getShipmentRoute(
        Number(shipment.originLat),
        Number(shipment.originLng),
        Number(shipment.destinationLat),
        Number(shipment.destinationLng),
        shipment.transportMode as any
      );
      if (!segments.length) {
        setMessage("No verified route is available for this shipment. Check the origin, destination, or road-routing service before assessing weather.");
        return;
      }

      const polyline = segments.flatMap(s => s.coords);

      // @ts-ignore
      const assessedFingerprints = Array.isArray(shipment.assessedThreats) ? shipment.assessedThreats : [];
      const assessment = await assessRouteThreats(polyline as [number, number][], assessedFingerprints);

      setThreatAssessments(prev => ({ ...prev, [shipment.id]: assessment }));

      if (!assessment.dataAvailable) {
        setMessage(`Route weather is unavailable; no ETA change was made. ${assessment.unavailableReasons[0] ?? ""}`.trim());
        return;
      }

      if (assessment.totalNewDelayHours > 0) {
        const newFingerprints = assessment.newThreats.map((t: any) => t.fingerprint);

        const response = await fetch(`/api/shipments/${shipment.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            weatherDelayFactor: String(Number(shipment.weatherDelayFactor || 0) + assessment.totalNewDelayHours),
            // @ts-ignore
            assessedThreats: [...assessedFingerprints, ...newFingerprints]
          })
        });

        if (response.ok) {
          setMessage(`Threats found! Added ${assessment.totalNewDelayHours}h delay to ETA.`);
          await refresh();
        } else {
          setMessage("Threats found but failed to update ETA in DB.");
        }
      } else if (assessment.threats.length > 0) {
        setMessage("Threats found, but no new delays added (already assessed).");
      } else {
        setMessage("✅ Route clear — no weather threats detected");
      }
    } catch (err) {
      console.error(err);
      setMessage("Failed to assess route threats.");
    } finally {
      setSaving(false);
    }
  }

  // Keep completed records in the navigator. Command Center links must always
  // resolve to their exact shipment; delivery is history, not disappearance.
  const visibleShipments = shipments;

  return <div className="workflow-stack">
    <details className="surface history-panel"><summary>Register single-leg shipment</summary>
      <form className="shipment-registration" onSubmit={submit}>
        <label>Shipment name<input name="name" minLength={3} required /></label>
        <label>Equipment
          <select name="equipmentId" required>
            <option value="">Select registered asset</option>
            {assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.tag} · {asset.assetType}</option>)}
          </select>
        </label>
        <label>Transport Mode
          <select name="transportMode" required>
            <option value="sea">🚢 Sea (Nautical Route)</option>
            <option value="air">✈️ Air (Great Circle)</option>
            <option value="land">🚛 Land (Road)</option>
          </select>
        </label>
        <label>MMSI<input name="mmsi" inputMode="numeric" pattern="[0-9]{7,9}" placeholder="Optional 7–9 digits (sea only)" /></label>

        <fieldset style={{ position: 'relative', zIndex: 100 }}>
          <legend>Origin</legend>
          <LocationSearch
            placeholder="Search origin port, airport, city..."
            value={origin?.name || ""}
            onSelect={(place) => setOrigin({ name: place.name, lat: place.lat, lng: place.lng })}
          />
        </fieldset>

        <fieldset style={{ position: 'relative', zIndex: 90 }}>
          <legend>Destination</legend>
          <LocationSearch
            placeholder="Search destination port, airport, city..."
            value={destination?.name || ""}
            onSelect={(place) => setDestination({ name: place.name, lat: place.lat, lng: place.lng })}
          />
        </fieldset>

        <label>Planned ETA<input name="plannedEta" type="datetime-local" required /></label>
        <label>Required on site<input name="requiredOnSite" type="datetime-local" required /></label>
        <label className="check-label"><input name="portCongestion" type="checkbox" /> Manual port congestion</label>
        <button className="button button-primary" disabled={saving || !assets.length} aria-busy={saving}><Ship size={16} />{saving ? "Working…" : "Register shipment"}</button>
      </form>
    </details>

    <details className="surface history-panel">
      <summary>Bulk import shipments (CSV / ERP)</summary>
      <form className="shipment-registration" style={{ gridTemplateColumns: "1fr auto" }} onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        setSaving(true);
        const response = await fetch(`/api/projects/${projectId}/shipments/bulk`, { method: "POST", body: formData });
        const result = await response.json();
        setSaving(false);
        setMessage(response.ok ? `Bulk import successful. Inserted: ${result.insertedCount}. Skipped (invalid tags): ${result.skippedCount}.` : result.error ?? "Bulk import failed.");
        if (response.ok) { form.reset(); await refresh(); }
      }}>
        <label style={{ gridColumn: "1 / -1" }}>
          CSV Manifest
          <input type="file" name="csv" accept=".csv" required />
        </label>
        <p style={{ gridColumn: "1 / -1", fontSize: "10px", color: "var(--muted)" }}>
          The CSV must include an <code>Equipment Tag</code> matching a registered asset. <a href="/sample-shipments.csv" download style={{ textDecoration: "underline" }}>Download sample template</a>.
        </p>
        <button className="button button-primary" disabled={saving} aria-busy={saving}>
          <Ship size={16} /> {saving ? "Importing…" : "Bulk import"}
        </button>
      </form>
    </details>

    {message && <p className="surface inline-feedback" role="status">{message}</p>}

    <section className="shipment-layout">
      <div className="surface map-surface" style={{ zIndex: 0 }}>
        <ShipmentMapLoader shipments={shipments} selectedId={selectedId} threatAssessments={threatAssessments} />
        <p className="map-attribution-note">Select Monitor both to watch the dynamic route and sampled weather side by side. Sea: nautical waterway routing · Air: great-circle arc · Land: OSRM road route. OpenStreetMap tiles © contributors, ODbL.</p>
      </div>

      <aside className="surface shipment-navigator">
        <div className="section-heading">
          <div><p className="eyebrow">30-second polling</p><h2>Shipment navigator</h2></div>
          <button type="button" className="icon-button" aria-label="Refresh shipments" disabled={saving} onClick={refresh}><RefreshCw size={16} /></button>
        </div>
        {visibleShipments.map((shipment) =>
          <article id={`shipment-${shipment.id}`} className={`shipment-row ${selectedId === shipment.id ? "is-selected" : ""}`} key={shipment.id}>
            <button type="button" onClick={() => setSelectedId(shipment.id)}>
              <LocateFixed size={16} />
              <div>
                <b>{shipment.transportMode === "air" ? "✈️" : shipment.transportMode === "land" ? "🚛" : "🚢"} {shipment.name}</b>
                <span>{shipment.originName ?? "Unknown origin"} → {shipment.destinationName ?? "Unknown destination"}</span>
              </div>
              <span className={`shipment-status ${shipment.status}`}>{shipment.status}</span>
            </button>

            <div className="shipment-metadata">
              <span>{shipment.positionSource === "live" ? "Live AIS fix" : "Simulated position"}</span>
              <span>ETA estimate {mounted ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(shipment.weatherAdjustedEta ?? shipment.plannedEta)) : ""}</span>
              <span>Weather factor {Number(shipment.weatherDelayFactor).toFixed(2)} · {shipment.portCongestion ? "manual congestion on" : "congestion off"}</span>
              {shipment.telemetryReason && <span>{shipment.telemetryReason}</span>}
            </div>

            <form className="shipment-update" onSubmit={(event) => update(shipment, event)}>
              <input name="plannedEta" aria-label={`Updated planned ETA for ${shipment.name}`} type="datetime-local" defaultValue={mounted ? new Date(shipment.plannedEta).toISOString().slice(0, 16) : ""} />
              <label><input name="portCongestion" type="checkbox" defaultChecked={shipment.portCongestion} /> congestion</label>
              <button className="button button-secondary" disabled={saving}>{saving ? "Working…" : "Recalculate"}</button>
              <button type="button" className="button button-secondary" onClick={() => assessRoute(shipment)} disabled={saving} style={{ marginLeft: 6 }}>{saving ? "Working…" : "Assess route"}</button>
              {shipment.status !== "delivered" && <button type="button" className="button button-secondary" onClick={() => markDelivered(shipment)} disabled={saving} style={{ marginLeft: 6, borderColor: "#16a34a", color: "#16a34a" }}>{saving ? "Working…" : "Complete"}</button>}
            </form>

            {threatAssessments[shipment.id] && (
              <div className="threat-panel" style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-sunken, #f8fafc)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <h4 style={{ color: !threatAssessments[shipment.id].dataAvailable ? '#b45309' : threatAssessments[shipment.id].threats.length ? '#ef4444' : '#16a34a', marginBottom: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /> {!threatAssessments[shipment.id].dataAvailable ? "WEATHER DATA UNAVAILABLE" : threatAssessments[shipment.id].threats.length ? "THREATS DETECTED" : "ROUTE ASSESSED"}</h4>
                {!threatAssessments[shipment.id].dataAvailable ? (
                  <p style={{ color: '#b45309', fontSize: '0.85rem' }}>⚠️ Route weather is unavailable. No “clear route” conclusion or ETA update was recorded.</p>
                ) : threatAssessments[shipment.id].threats.length === 0 ? (
                  <p style={{ color: '#16a34a', fontSize: '0.85rem' }}>✅ Route clear — no weather threats detected.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {threatAssessments[shipment.id].threats.map((t: any, i: number) => {
                      // Check if it's a new threat
                      // @ts-ignore
                      const assessedFingerprints = Array.isArray(shipment.assessedThreats) ? shipment.assessedThreats : [];
                      const isNew = !assessedFingerprints.includes(t.fingerprint);
                      return (
                      <div key={i} style={{ fontSize: '0.8rem', color: isNew ? 'var(--text)' : 'var(--muted)', paddingLeft: '8px', borderLeft: `2px solid ${isNew ? '#ef4444' : '#cbd5e1'}` }}>
                        <strong>📍 Waypoint {t.waypointIndex}/10</strong> ({t.lat.toFixed(2)}°, {t.lng.toFixed(2)}°)<br />
                        🌪 Weather: {t.type} (Code {t.weatherCode})<br />
                        💨 Wind speed: {t.windSpeed} km/h<br />
                        🌧 Precip: {t.precipitation} mm/h<br />
                        ⏱ Delay: +{t.estimatedDelayHours} hours<br />
                        {isNew ? <span style={{ color: '#2563eb', fontWeight: 500 }}>🆕 NEW — not previously assessed</span> : <span>⚪ PREVIOUSLY ASSESSED (delay factored in)</span>}
                      </div>
                    )})}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px', fontSize: '0.85rem' }}>
                      <strong>New delay from NEW threats only: +{threatAssessments[shipment.id].totalNewDelayHours} hours</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

          </article>
        )}
        {!shipments.length && <div className="empty-state"><h2>No shipments</h2><p>Register equipment movement to begin transparent simulated/live tracking.</p></div>}
      </aside>
    </section>
  </div>;
}
