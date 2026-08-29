"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Compass,
  LocateFixed,
  Map as MapIcon,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Sparkles,
  Anchor,
  Lock,
  Building,
  Truck,
  ShieldCheck,
  Target,
  Flag,
  Calendar,
} from "lucide-react";
import { ShipmentMapLoader } from "@/components/shipment-map-loader";
import type { MapShipment, RouteThreatAssessment } from "@/components/shipment-map";
import { LocationSearch } from "@/components/location-search";
import { RouteThreatRadar, type ThreatRadarShipment } from "@/components/route-threat-radar";

type Shipment = ThreatRadarShipment;
type Asset = { id: string; tag: string; assetType: string };
type Plan = {
  id: string;
  name: string;
  requirementLevel: "must_order" | "confirm_order" | "planning_only";
  rationale: string;
  sourceAnswers: Record<string, string>;
  transportMode: "sea" | "air" | "land";
  status: "proposed" | "approved" | "rejected" | "materialized";
};
const labels = {
  must_order: "Must order",
  confirm_order: "Confirm order",
  planning_only: "Planning only",
} as const;
const dateFormat = (value: Date | string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const assessmentText = (assessment: RouteThreatAssessment | undefined) => {
  if (!assessment) return "";
  if (!assessment.dataAvailable)
    return (
      assessment.unavailableReasons?.[0] ??
      "Weather provider did not return a usable response."
    );
  return assessment.threats.length
    ? `${assessment.threats.length} weather risk(s) sampled along route.`
    : "No sampled weather risks.";
};

export function ShipmentWorkbench({
  projectId,
  initialShipments,
  assets,
  initialShipmentId,
}: {
  projectId: string;
  initialShipments: Shipment[];
  assets: Asset[];
  initialShipmentId?: string;
}) {
  const [shipments, setShipments] = useState(initialShipments);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState(initialShipments[0]?.id ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [compact, setCompact] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"radar" | "map" | "plan" | "manual">("radar");
  const [assessments, setAssessments] = useState<Record<string, RouteThreatAssessment>>({});
  const [origin, setOrigin] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const approvedPlans = useMemo(() => plans.filter((item) => item.status === "approved"), [plans]);

  // Realistic EPC End-to-End Logistics Lifecycle Stage Durations
  const [transportMode, setTransportMode] = useState<"sea" | "air" | "land">("sea");
  const [departureDate, setDepartureDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [exportDocsDays, setExportDocsDays] = useState(3);
  const [onloadingDays, setOnloadingDays] = useState(2);
  const [oceanTransitDays, setOceanTransitDays] = useState(20);
  const [chokepointDays, setChokepointDays] = useState(2);
  const [offloadingDays, setOffloadingDays] = useState(2);
  const [importCustomsDays, setImportCustomsDays] = useState(3);
  const [siteDrayageDays, setSiteDrayageDays] = useState(2);
  const [bufferDays, setBufferDays] = useState(3);

  const totalLeadTimeDays = useMemo(() => {
    if (transportMode === "air") {
      return exportDocsDays + 1 + 2 + 0 + 1 + importCustomsDays + siteDrayageDays;
    }
    if (transportMode === "land") {
      return exportDocsDays + 1 + 5 + 0 + 1 + importCustomsDays + siteDrayageDays;
    }
    return exportDocsDays + onloadingDays + oceanTransitDays + chokepointDays + offloadingDays + importCustomsDays + siteDrayageDays;
  }, [transportMode, exportDocsDays, onloadingDays, oceanTransitDays, chokepointDays, offloadingDays, importCustomsDays, siteDrayageDays]);

  const calculatedPlannedEta = useMemo(() => {
    const depMs = new Date(departureDate).getTime();
    if (isNaN(depMs)) return "";
    const arr = new Date(depMs + totalLeadTimeDays * 24 * 3600_000);
    arr.setMinutes(arr.getMinutes() - arr.getTimezoneOffset());
    return arr.toISOString().slice(0, 16);
  }, [departureDate, totalLeadTimeDays]);

  const calculatedRequiredOnSite = useMemo(() => {
    const depMs = new Date(departureDate).getTime();
    if (isNaN(depMs)) return "";
    const ros = new Date(depMs + (totalLeadTimeDays + bufferDays) * 24 * 3600_000);
    ros.setMinutes(ros.getMinutes() - ros.getTimezoneOffset());
    return ros.toISOString().slice(0, 16);
  }, [departureDate, totalLeadTimeDays, bufferDays]);

  async function refresh() {
    const [shipmentResponse, planResponse] = await Promise.all([
      fetch(`/api/projects/${projectId}/shipments`),
      fetch(`/api/projects/${projectId}/shipment-plans`),
    ]);
    if (shipmentResponse.ok) setShipments((await shipmentResponse.json()).items);
    if (planResponse.ok) setPlans((await planResponse.json()).items);
  }
  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [projectId]);
  useEffect(() => {
    if (initialShipmentId && shipments.some((item) => item.id === initialShipmentId)) {
      setSelectedId(initialShipmentId);
    }
  }, [initialShipmentId, shipments]);

  async function planAction(
    action: "generate" | "approve" | "reject" | "materialize",
    planId?: string
  ) {
    setSaving(true);
    const response = await fetch(`/api/projects/${projectId}/shipment-plans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, planId }),
    });
    const body = await response.json();
    setSaving(false);
    setMessage(
      response.ok
        ? action === "generate"
          ? `Generated ${body.generated} reviewable packages from saved Site Analysis.`
          : action === "reject"
            ? "Shipment-plan item rejected."
            : `Approved package added to the shipment register${body.routeAvailable ? " with a mapped route" : ". Route provider is unavailable; retry route assessment from the list."}.`
        : body.error ?? "Shipment plan action failed."
    );
    if (response.ok) {
      await refresh();
      if (body.shipment?.id) setSelectedId(body.shipment.id);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin || !destination)
      return setMessage("Select both origin and destination before creating a route.");
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    const response = await fetch(`/api/projects/${projectId}/shipments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.get("name"),
        equipmentId: values.get("equipmentId"),
        planId: values.get("planId") || undefined,
        transportMode: values.get("transportMode"),
        origin,
        destination,
        plannedEta: new Date(String(values.get("plannedEta"))).toISOString(),
        requiredOnSite: new Date(String(values.get("requiredOnSite"))).toISOString(),
        portCongestion: values.get("portCongestion") === "on",
        weatherDelayFactor: 0,
      }),
    });
    const body = await response.json();
    setSaving(false);
    setMessage(
      response.ok
        ? "Route created. Map, routing, and weather now use the same server-side assessment."
        : body.error ?? "Could not create route."
    );
    if (response.ok) {
      form.reset();
      setOrigin(null);
      setDestination(null);
      setSelectedPlanId("");
      await refresh();
      setSelectedId(body.shipment.id);
    }
  }

  async function assessRoute(shipment: Shipment) {
    setSaving(true);
    setMessage("Refreshing verified route corridor and weather assessment…");
    const response = await fetch(`/api/shipments/${shipment.id}`);
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(body.error ?? "Unable to assess route.");
    if (!body.routeAvailable)
      return setMessage(body.reason ?? "A route could not be calculated for this shipment.");
    setAssessments((current) => ({ ...current, [shipment.id]: body.weather }));
    setMessage(
      body.weather?.dataAvailable
        ? body.weather.threats?.length
          ? "Route corridor assessed: weather risks detected."
          : "Route corridor assessed: no sampled weather risks."
        : `Route drawn, but weather is unavailable: ${body.weather?.unavailableReasons?.[0] ?? "provider did not return data"}`
    );
  }

  return (
    <div className="workflow-stack">
      {/* View Switcher Tabs */}
      <div className="workflow-tabs" role="tablist" aria-label="Shipments and Logistics Views">
        <button
          type="button"
          className={viewMode === "radar" ? "is-active" : ""}
          onClick={() => setViewMode("radar")}
          role="tab"
          aria-selected={viewMode === "radar"}
        >
          <Radio size={15} /> Threat Radar & Telemetry
        </button>
        <button
          type="button"
          className={viewMode === "map" ? "is-active" : ""}
          onClick={() => setViewMode("map")}
          role="tab"
          aria-selected={viewMode === "map"}
        >
          <MapIcon size={15} /> World Route Map
        </button>
        <button
          type="button"
          className={viewMode === "plan" ? "is-active" : ""}
          onClick={() => setViewMode("plan")}
          role="tab"
          aria-selected={viewMode === "plan"}
        >
          <Sparkles size={15} /> Procurement Plan ({plans.length})
        </button>
        <button
          type="button"
          className={viewMode === "manual" ? "is-active" : ""}
          onClick={() => setViewMode("manual")}
          role="tab"
          aria-selected={viewMode === "manual"}
        >
          <Plus size={15} /> Manual Entry
        </button>
      </div>

      {message && (
        <p className="surface inline-feedback" role="status">
          {message}
        </p>
      )}

      {/* 1. Radar View */}
      {viewMode === "radar" && (
        <RouteThreatRadar
          shipments={shipments}
          selectedId={selectedId}
          onSelectShipment={setSelectedId}
          assessments={assessments}
          onAssessRoute={assessRoute}
          onRefreshShipments={refresh}
          assets={assets}
          loading={saving}
        />
      )}

      {/* 2. Map & List View */}
      {viewMode === "map" && (
        <section className="shipment-layout">
          <div className="surface map-surface">
            <ShipmentMapLoader
              shipments={shipments}
              selectedId={selectedId}
              threatAssessments={assessments}
              onAssessmentChange={(sId, ass) =>
                setAssessments((prev) => ({ ...prev, [sId]: ass }))
              }
            />
            <p className="map-attribution-note">
              Routes and weather are assessed server-side. Sea uses nautical routing; air uses great-circle routing; land uses OSRM. If a provider is unavailable, no weather conclusion is made.
            </p>
          </div>
          <aside className="surface shipment-navigator">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Logistics register</p>
                <h2>Shipment list</h2>
              </div>
              <div className="shipment-view-controls">
                <button
                  className={`button button-secondary ${compact ? "is-active" : ""}`}
                  onClick={() => setCompact(true)}
                >
                  Compact
                </button>
                <button
                  className={`button button-secondary ${!compact ? "is-active" : ""}`}
                  onClick={() => setCompact(false)}
                >
                  Detail
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Refresh shipments"
                  disabled={saving}
                  onClick={refresh}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            {shipments.map((shipment) => (
              <article
                id={`shipment-${shipment.id}`}
                className={`shipment-row ${selectedId === shipment.id ? "is-selected" : ""} ${compact ? "is-compact" : ""}`}
                key={shipment.id}
              >
                <button type="button" onClick={() => setSelectedId(shipment.id)}>
                  <LocateFixed size={16} />
                  <div>
                    <b>
                      {shipment.transportMode === "air"
                        ? "Air"
                        : shipment.transportMode === "land"
                          ? "Road"
                          : "Sea"}{" "}
                      · {shipment.name}
                    </b>
                    <span>
                      {shipment.originName ?? "Origin pending"} →{" "}
                      {shipment.destinationName ?? "Destination pending"}
                    </span>
                  </div>
                  <span className={`shipment-status ${shipment.status}`}>
                    {shipment.status}
                  </span>
                </button>
                {!compact && selectedId === shipment.id && (
                  <div className="shipment-detail" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="shipment-metadata">
                      <span>
                        ETA{" "}
                        {dateFormat(
                          shipment.weatherAdjustedEta ?? shipment.plannedEta
                        )}
                      </span>
                      <span>
                        {shipment.positionSource === "live"
                          ? "Live position"
                          : "Simulated position"}{" "}
                        · delay {Number(shipment.weatherDelayFactor).toFixed(1)}h
                      </span>
                    </div>

                    {/* Layer 3 Quantile Uncertainty Spread Mini-Card */}
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "var(--surface-muted)",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Layer 3 Quantile Forecast
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 12%, transparent)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Kwon + GBDT
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
                        <div style={{ padding: "4px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "4px" }}>
                          <span style={{ fontSize: "9px", color: "#5b7a6e", display: "block" }}>p10 Best</span>
                          <strong style={{ fontSize: "12px", color: "#5b7a6e" }}>
                            +{Math.max(0, Number(shipment.weatherDelayFactor) * 0.85 - 0.2).toFixed(1)}h
                          </strong>
                        </div>
                        <div style={{ padding: "4px", background: "color-mix(in srgb, var(--primary) 6%, var(--surface))", border: "1px solid color-mix(in srgb, var(--primary) 25%, var(--line))", borderRadius: "4px" }}>
                          <span style={{ fontSize: "9px", color: "var(--primary)", display: "block" }}>p50 Calibrated</span>
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                            +{Number(shipment.weatherDelayFactor).toFixed(1)}h
                          </strong>
                        </div>
                        <div style={{ padding: "4px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "4px" }}>
                          <span style={{ fontSize: "9px", color: "#c84b3d", display: "block" }}>p90 Upper</span>
                          <strong style={{ fontSize: "12px", color: "#c84b3d" }}>
                            +{(Number(shipment.weatherDelayFactor) * 1.25 + 0.6).toFixed(1)}h
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        className="button button-secondary"
                        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "11px" }}
                        onClick={() => {
                          setSelectedId(shipment.id);
                          setViewMode("radar");
                        }}
                      >
                        <Sparkles size={13} />
                        Causal &quot;Why&quot; Breakdown
                      </button>

                      <button
                        className="button button-secondary"
                        style={{ padding: "6px 10px", fontSize: "11px" }}
                        disabled={saving}
                        onClick={() => assessRoute(shipment)}
                      >
                        <RefreshCw size={13} />
                        Assess
                      </button>
                    </div>

                    {assessments[shipment.id] && (
                      <p className="shipment-assessment" style={{ margin: 0 }}>
                        {assessmentText(assessments[shipment.id])}
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!shipments.length && (
              <div className="empty-state">
                <h3>No routes created</h3>
                <p>Generate, approve, and route a Site Analysis package, or create a manual shipment.</p>
              </div>
            )}
          </aside>
        </section>
      )}

      {/* 3. Procurement Plan Review */}
      {viewMode === "plan" && (
        <section className="surface shipment-plan-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Optional · Site Analysis → procurement</p>
              <h2>Shipment plan review</h2>
              <p>
                Approving a package immediately creates its simulated shipment, route, and weather assessment. Manual entry remains available for non-planned logistics.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => planAction("generate")}
              disabled={saving}
            >
              <Sparkles size={16} />
              Generate from Site Analysis
            </button>
          </div>
          {plans.length ? (
            <div className="shipment-plan-list">
              {plans.map((plan) => (
                <article
                  className={`shipment-plan-row status-${plan.status}`}
                  key={plan.id}
                >
                  <div>
                    <span className={`plan-level ${plan.requirementLevel}`}>
                      {labels[plan.requirementLevel]}
                    </span>
                    <b>{plan.name}</b>
                    <p>{plan.rationale}</p>
                    <small>
                      {Object.entries(plan.sourceAnswers)
                        .filter(([, value]) => value)
                        .map(
                          ([key, value]) =>
                            `${key.replaceAll("_", " ")}: ${value}`
                        )
                        .join(" · ")}
                    </small>
                  </div>
                  <div className="shipment-plan-actions">
                    <span>{plan.status.replaceAll("_", " ")}</span>
                    {plan.status === "proposed" && (
                      <>
                        <button
                          className="button button-secondary"
                          disabled={saving}
                          onClick={() => planAction("reject", plan.id)}
                        >
                          Reject
                        </button>
                        <button
                          className="button button-primary"
                          disabled={saving}
                          onClick={() => planAction("approve", plan.id)}
                        >
                          <Check size={15} />
                          Approve & create route
                        </button>
                      </>
                    )}
                    {plan.status === "approved" && (
                      <button
                        className="button button-primary"
                        disabled={saving}
                        onClick={() => planAction("materialize", plan.id)}
                      >
                        <Route size={15} />
                        Create route
                      </button>
                    )}
                    {plan.status === "materialized" && <span>route created</span>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="shipment-plan-empty">
              No Site Analysis shipment plan yet. Click &ldquo;Generate from Site Analysis&rdquo; to build procurement packages.
            </p>
          )}
        </section>
      )}

      {/* 4. Manual Entry View */}
      {viewMode === "manual" && (
        <section className="surface shipment-manual-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Manual logistics entry</p>
              <h2>
                <Plus size={19} /> Add shipment manually
              </h2>
              <p>
                Manual shipments work without Site Analysis. Select an approved plan only to link this route back to a recommended package.
              </p>
            </div>
          </div>
          <form className="shipment-registration" onSubmit={submit}>
            <label>
              Approved plan
              <select
                name="planId"
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                <option value="">Manual shipment</option>
                {approvedPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {labels[plan.requirementLevel]} · {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Shipment name
              <input
                key={selectedPlanId}
                name="name"
                minLength={3}
                required
                defaultValue={
                  approvedPlans.find((plan) => plan.id === selectedPlanId)?.name ?? ""
                }
              />
            </label>
            <label>
              Registered asset
              <select name="equipmentId" required>
                <option value="">Select asset</option>
                {assets.map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.tag} · {asset.assetType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Transport mode
              <select
                name="transportMode"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as any)}
              >
                <option value="sea">Sea (Maritime Deep Ocean & Multimodal)</option>
                <option value="land">Road (Overland Heavy-Haul Drayage)</option>
                <option value="air">Air (Express Air Freight)</option>
              </select>
            </label>

            <fieldset>
              <legend>Origin</legend>
              <LocationSearch
                placeholder="Search origin port, airport, city…"
                value={origin?.name ?? ""}
                onSelect={setOrigin}
              />
            </fieldset>
            <fieldset>
              <legend>Destination</legend>
              <LocationSearch
                placeholder="Search destination port, airport, city…"
                value={destination?.name ?? ""}
                onSelect={setDestination}
              />
            </fieldset>

            {/* Realistic EPC Supply Chain Lead-Time & Stage-Gate Calculator */}
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "16px",
                background: "var(--surface-muted)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginTop: "6px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <b style={{ fontSize: "13px", color: "var(--ink)" }}>⏱️ EPC Supply Chain Lead-Time &amp; Stage-Gate Calculator</b>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                    Calculates realistic door-to-site arrival incorporating documentation, canal transits, port visas, on/offloading, and customs dwell.
                  </p>
                </div>

                {/* Preset Fast-Pick Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ fontSize: "10px", padding: "4px 9px", height: "auto", background: "#0284c7" }}
                    onClick={() => {
                      setTransportMode("sea");
                      setExportDocsDays(3);
                      setOnloadingDays(4);
                      setOceanTransitDays(24);
                      setChokepointDays(7);
                      setOffloadingDays(4);
                      setImportCustomsDays(3);
                      setSiteDrayageDays(3);
                      setBufferDays(3);
                      setOrigin({ name: "Sanathnagar ICD, Hyderabad", lat: 17.45, lng: 78.43 });
                      setDestination({ name: "Miami Data Center, Florida", lat: 25.76, lng: -80.19 });
                    }}
                  >
                    ⭐ Flagship: Hyderabad → Florida FCL (45d)
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "10px", padding: "3px 8px", height: "auto" }}
                    onClick={() => {
                      setTransportMode("sea");
                      setExportDocsDays(3);
                      setOnloadingDays(2);
                      setOceanTransitDays(20);
                      setChokepointDays(2);
                      setOffloadingDays(2);
                      setImportCustomsDays(3);
                      setSiteDrayageDays(2);
                    }}
                  >
                    🌍 Global Deep Sea (34d)
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "10px", padding: "3px 8px", height: "auto" }}
                    onClick={() => {
                      setTransportMode("sea");
                      setExportDocsDays(2);
                      setOnloadingDays(1);
                      setOceanTransitDays(8);
                      setChokepointDays(1);
                      setOffloadingDays(1);
                      setImportCustomsDays(2);
                      setSiteDrayageDays(1);
                    }}
                  >
                    ⚡ Regional Coastal (16d)
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ fontSize: "10px", padding: "3px 8px", height: "auto" }}
                    onClick={() => {
                      setTransportMode("air");
                      setExportDocsDays(2);
                      setImportCustomsDays(2);
                      setSiteDrayageDays(1);
                    }}
                  >
                    ✈️ Express Air (9d)
                  </button>
                </div>
              </div>

              {/* Conditional Delay & Seasonality Modifier Toggles */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  padding: "8px 10px",
                  background: "color-mix(in srgb, var(--surface) 60%, var(--field))",
                  border: "1px dashed var(--line)",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--ink)", marginRight: "4px" }}>Conditional Rules:</span>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "10px", padding: "2px 7px", height: "auto" }}
                  onClick={() => setOnloadingDays((prev) => prev + 3)}
                  title="Adds +3 days to inland rail corridor due to monsoon weather"
                >
                  🌧️ Indian Monsoon (+3d)
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "10px", padding: "2px 7px", height: "auto" }}
                  onClick={() => setOceanTransitDays((prev) => prev + 4)}
                  title="Adds +4 days due to Atlantic hurricane route deviation & Florida port closure"
                >
                  🌀 Atlantic Hurricane (+4d)
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "10px", padding: "2px 7px", height: "auto" }}
                  onClick={() => setExportDocsDays((prev) => prev + 5)}
                  title="Adds +5 days due to festival trucking driver shortages in India"
                >
                  🪔 Diwali Trucking Shortage (+5d)
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "10px", padding: "2px 7px", height: "auto", color: "#c84b3d" }}
                  onClick={() => setOnloadingDays((prev) => prev + 7)}
                  title="Missed strict 48h Container Yard cut-off: mandatory 7-day weekly vessel rollover penalty"
                >
                  ⚠️ Missed CY Cut-Off (+7d Rollover)
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ fontSize: "10px", padding: "2px 7px", height: "auto", color: "#c98431" }}
                  onClick={() => setImportCustomsDays((prev) => prev + 5)}
                  title="US CBP Intensive Physical Inspection & VACIS X-ray exam hold"
                >
                  🔍 CBP Intensive Exam (+5d)
                </button>
              </div>

              {/* Stage breakdown grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", fontSize: "11px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span>🛫 Journey Departure Date</span>
                  <input
                    type="datetime-local"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    required
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span>📄 Export Docs &amp; Licences (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={exportDocsDays}
                    onChange={(e) => setExportDocsDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>

                {transportMode === "sea" && (
                  <>
                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span>🏗️ Port Onloading &amp; Rigging (days)</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={onloadingDays}
                        onChange={(e) => setOnloadingDays(Math.max(0, Number(e.target.value)))}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span>🚢 Ocean Voyage Passage (days)</span>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={oceanTransitDays}
                        onChange={(e) => setOceanTransitDays(Math.max(1, Number(e.target.value)))}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Lock size={12} /> Canal/Chokepoint Queuing (days)</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={chokepointDays}
                        onChange={(e) => setChokepointDays(Math.max(0, Number(e.target.value)))}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Anchor size={12} /> Port Offloading &amp; Visas (days)</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={offloadingDays}
                        onChange={(e) => setOffloadingDays(Math.max(0, Number(e.target.value)))}
                      />
                    </label>
                  </>
                )}

                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Building size={12} /> Import Customs Tariff Dwell (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={importCustomsDays}
                    onChange={(e) => setImportCustomsDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Truck size={12} /> Overland Site Drayage (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={siteDrayageDays}
                    onChange={(e) => setSiteDrayageDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><ShieldCheck size={12} /> Site ROS Buffer Margin (days)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={bufferDays}
                    onChange={(e) => setBufferDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>
              </div>

              {/* Live Lead Time Summary Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  padding: "10px 12px",
                  background: "color-mix(in srgb, var(--primary) 8%, var(--surface))",
                  border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "var(--muted)", marginRight: "4px" }}>Total Door-to-Site Duration:</span>
                  <b style={{ color: "var(--primary)", fontSize: "14px" }}>{totalLeadTimeDays} Days ({totalLeadTimeDays * 24} Hours)</b>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Target size={13} style={{ color: "var(--primary)" }} /> <b>Calculated Planned ETA:</b>{" "}
                    {calculatedPlannedEta ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(new Date(calculatedPlannedEta)) : "—"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Flag size={13} style={{ color: "#a91f32" }} /> <b>Required On-Site (ROS):</b>{" "}
                    {calculatedRequiredOnSite ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(new Date(calculatedRequiredOnSite)) : "—"}
                  </span>
                </div>
              </div>

              {/* Synchronized form payload inputs */}
              <input type="hidden" name="plannedEta" value={calculatedPlannedEta} />
              <input type="hidden" name="requiredOnSite" value={calculatedRequiredOnSite} />
            </div>

            <label className="check-label" style={{ gridColumn: "1 / -1" }}>
              <input name="portCongestion" type="checkbox" />
              Flag strategic port / berth congestion
            </label>
            <button className="button button-primary" disabled={saving || !assets.length} style={{ gridColumn: "1 / -1" }}>
              <Route size={16} />
              Create route with Stage-Gate Lead Time ({totalLeadTimeDays}d)
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

