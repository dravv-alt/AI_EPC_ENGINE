"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";

export type MapShipment = {
  id: string;
  name: string;
  status: string;
  transportMode?: "sea" | "air" | "land";
  originName: string | null;
  originLat: string | null;
  originLng: string | null;
  destinationName: string | null;
  destinationLat: string | null;
  destinationLng: string | null;
  currentLat: string | null;
  currentLng: string | null;
  positionSource: string;
  weatherAdjustedEta: Date | string | null;
  plannedEta: Date | string;
};

type RouteSegment = { mode: "sea" | "air" | "land"; coords: [number, number][] };
type WeatherThreat = {
  lat: number;
  lng: number;
  type: string;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
  estimatedDelayHours: number;
  waypointIndex: number;
};
export type RouteThreatAssessment = {
  dataAvailable: boolean;
  source?: string;
  observedAt?: string;
  observations?: Array<{
    waypointIndex: number;
    lat: number;
    lng: number;
    windSpeed: number;
    precipitation: number;
    weatherCode: number;
    threat: WeatherThreat | null;
  }>;
  threats: WeatherThreat[];
  unavailableReasons?: string[];
  totalNewDelayHours?: number;
};

const validCoordinates = (shipment?: MapShipment) => Boolean(
  shipment?.originLat
  && shipment.originLng
  && shipment.destinationLat
  && shipment.destinationLng
  && [shipment.originLat, shipment.originLng, shipment.destinationLat, shipment.destinationLng]
    .every((value) => Number.isFinite(Number(value)))
);
const statusColor = (status: string) => status === "red" ? "#be1e2d" : status === "amber" ? "#b5651d" : "#2d6b55";
const modeColor = (mode: RouteSegment["mode"]) => mode === "sea" ? "#1677a6" : mode === "air" ? "#7656b5" : "#9a5a1f";
const threatColor = (threat: WeatherThreat) => threat.estimatedDelayHours >= 4 ? "#be1e2d" : threat.estimatedDelayHours > 0 ? "#d97706" : "#2d6b55";
const weatherCondition = (weatherCode: number, windSpeed: number, precipitation: number) => {
  if (weatherCode >= 95) return { label: "Thunderstorm", color: "#ef4444", className: "storm" };
  if (windSpeed > 50) return { label: "High wind", color: "#f97316", className: "wind" };
  if (precipitation > 2.5 || weatherCode >= 61) return { label: "Rain", color: "#38bdf8", className: "rain" };
  if (weatherCode >= 45) return { label: "Fog / low visibility", color: "#cbd5e1", className: "fog" };
  if (weatherCode >= 1) return { label: "Cloud cover", color: "#94a3b8", className: "cloud" };
  return { label: "Clear", color: "#34d399", className: "clear" };
};

function Navigator({ shipment, route }: { shipment?: MapShipment; route: RouteSegment[] }) {
  const map = useMap();
  useEffect(() => {
    const points = route.flatMap((segment) => segment.coords).map(([lat, lng]) => [lat, lng] as LatLngExpression);
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    if (points.length > 1) {
      const bounds = latLngBounds(points);
      if (shipment?.currentLat && shipment.currentLng) {
        map.flyTo([Number(shipment.currentLat), Number(shipment.currentLng)], 7, { animate: true, duration: .8 });
        revealTimer = setTimeout(() => map.flyToBounds(bounds, { padding: [42, 42], maxZoom: 8, animate: true, duration: 1.25 }), 700);
      } else {
        map.flyToBounds(bounds, { padding: [42, 42], maxZoom: 8, animate: true, duration: 1.25 });
      }
    } else if (shipment?.currentLat && shipment.currentLng) {
      map.flyTo([Number(shipment.currentLat), Number(shipment.currentLng)], 6, { animate: true, duration: 1.1 });
    }
    return () => { if (revealTimer) clearTimeout(revealTimer); };
  }, [map, route, shipment]);
  return null;
}

function MapPanel({
  kind,
  selected,
  route,
  assessment,
  routeMessage
}: {
  kind: "route" | "weather";
  selected?: MapShipment;
  route: RouteSegment[];
  assessment?: RouteThreatAssessment;
  routeMessage: string;
}) {
  const center = useMemo<LatLngExpression>(
    () => selected?.currentLat && selected.currentLng
      ? [Number(selected.currentLat), Number(selected.currentLng)]
      : validCoordinates(selected)
        ? [Number(selected!.originLat), Number(selected!.originLng)]
        : [20.5937, 78.9629],
    [selected]
  );
  const current = selected?.currentLat && selected.currentLng
    ? [Number(selected.currentLat), Number(selected.currentLng)] as LatLngExpression
    : null;
  const origin = validCoordinates(selected)
    ? [Number(selected!.originLat), Number(selected!.originLng)] as LatLngExpression
    : null;
  const destination = validCoordinates(selected)
    ? [Number(selected!.destinationLat), Number(selected!.destinationLng)] as LatLngExpression
    : null;
  const threats = assessment?.dataAvailable ? assessment.threats ?? [] : [];
  const observations = assessment?.observations ?? [];
  const maxWind = observations.reduce((max, item) => Math.max(max, item.windSpeed), 0);
  const maxRain = observations.reduce((max, item) => Math.max(max, item.precipitation), 0);
  const observedAt = assessment?.observedAt
    ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(assessment.observedAt))
    : "—";
  const weatherMessage = !assessment
    ? "Loading live waypoint weather…"
    : !assessment.dataAvailable
      ? assessment.unavailableReasons?.[0] ?? "Weather data is currently unavailable."
      : threats.length
        ? `${threats.length} weather threat${threats.length === 1 ? "" : "s"} overlaid on this route.`
        : "Weather assessment complete: no route threats detected.";

  return <section className={`shipment-map-frame shipment-map-panel shipment-map-panel-${kind}`} aria-label={`${kind === "route" ? "Shipment route" : "Route weather"} map`}>
    <header className="shipment-map-panel-heading">
      <div>
        <span>{kind === "route" ? "Dynamic route overlay" : "Waypoint weather overlay"}</span>
        <b>{kind === "route" ? "Route monitor" : "Weather monitor"}</b>
      </div>
      {kind === "route"
        ? <span className="map-live-chip">{selected?.positionSource === "live" || selected?.positionSource === "aisstream" ? "Live AIS" : "Simulated position"}</span>
        : <span className={`map-live-chip ${assessment?.dataAvailable ? "is-ready" : "is-waiting"}`}>{assessment?.dataAvailable ? "Open-Meteo live" : "Loading weather"}</span>}
    </header>
    <MapContainer className={`shipment-map ${kind === "weather" ? "shipment-weather-map" : ""}`} center={center} zoom={5} scrollWheelZoom>
      {kind === "route"
        ? <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        : <TileLayer attribution='&copy; OpenStreetMap contributors · &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />}
      <Navigator shipment={selected} route={route} />
      {route.map((segment, index) => <Polyline
        positions={segment.coords}
        pathOptions={{
          color: kind === "route" ? modeColor(segment.mode) : "#7dd3fc",
          weight: kind === "route" ? 6 : 3,
          opacity: kind === "route" ? .95 : .8,
          className: "shipment-route"
        }}
        key={`${kind}-${selected?.id}-${segment.mode}-${index}`}
      />)}
      {origin && <CircleMarker center={origin} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}><Popup><b>Origin</b><br />{selected?.originName}</Popup></CircleMarker>}
      {destination && <CircleMarker center={destination} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }}><Popup><b>Destination</b><br />{selected?.destinationName}</Popup></CircleMarker>}
      {current && <CircleMarker center={current} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: statusColor(selected?.status ?? "green"), fillOpacity: 1, className: "shipment-position-marker" }}><Popup><b>{selected?.name}</b><br />{selected?.positionSource === "live" || selected?.positionSource === "aisstream" ? "Live AIS position" : "Simulated position"}</Popup></CircleMarker>}
      {kind === "weather" && observations.map((observation, index) => {
        const condition = weatherCondition(observation.weatherCode, observation.windSpeed, observation.precipitation);
        const overlayColor = observation.threat ? threatColor(observation.threat) : condition.color;
        const radius = observation.threat
          ? Math.max(120_000, Math.min(280_000, 120_000 + observation.threat.estimatedDelayHours * 24_000))
          : 95_000 + Math.min(70_000, observation.windSpeed * 1_200 + observation.precipitation * 4_000);
        return <Fragment key={`${selected?.id}-weather-${observation.waypointIndex}-${index}`}>
          <Circle
            center={[observation.lat, observation.lng]}
            radius={radius}
            pathOptions={{ color: overlayColor, weight: 1.5, fillColor: overlayColor, fillOpacity: observation.threat ? .3 : .2, className: `weather-zone weather-${condition.className} ${observation.threat ? "is-threat" : "is-clear"}` }}
          />
          <CircleMarker
            center={[observation.lat, observation.lng]}
            radius={6}
            pathOptions={{ color: "#f8fafc", weight: 1.5, fillColor: overlayColor, fillOpacity: 1, className: "weather-sample-marker" }}
          ><Popup><b>{condition.label}</b><br />Waypoint {observation.waypointIndex}/{observations.length}<br />Wind {observation.windSpeed} km/h · rain {observation.precipitation} mm/h<br />WMO code {observation.weatherCode}<br />{observation.threat ? `Operational delay estimate +${observation.threat.estimatedDelayHours} h` : "Below delay threshold"}</Popup></CircleMarker>
        </Fragment>;
      })}
    </MapContainer>
    {kind === "route" && routeMessage && <div className="map-route-notice" role="status">{routeMessage}</div>}
    {kind === "weather" && <div className={`map-weather-status ${assessment?.dataAvailable ? "is-ready" : ""}`} role="status">{weatherMessage}</div>}
    {kind === "weather" && assessment?.dataAvailable && <div className="weather-map-metrics" aria-label="Live route weather summary">
      <span><small>Peak wind</small><b>{maxWind.toFixed(0)} km/h</b></span>
      <span><small>Peak rain</small><b>{maxRain.toFixed(1)} mm/h</b></span>
      <span><small>Updated</small><b>{observedAt}</b></span>
    </div>}
    <div className="shipment-map-legend" aria-label="Map legend">
      {kind === "route"
        ? <><span><i style={{ background: modeColor("sea") }} />Sea</span><span><i style={{ background: modeColor("air") }} />Air</span><span><i style={{ background: modeColor("land") }} />Land</span></>
        : <><span><i style={{ background: "#34d399" }} />Clear</span><span><i style={{ background: "#94a3b8" }} />Cloud / fog</span><span><i style={{ background: "#38bdf8" }} />Rain</span><span><i style={{ background: "#f97316" }} />High wind</span><span><i style={{ background: "#ef4444" }} />Severe</span></>}
    </div>
  </section>;
}

export default function ShipmentMap({
  shipments,
  selectedId,
  threatAssessments = {}
}: {
  shipments: MapShipment[];
  selectedId?: string;
  threatAssessments?: Record<string, RouteThreatAssessment>;
}) {
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? shipments[0];
  const [route, setRoute] = useState<RouteSegment[]>([]);
  const [routeMessage, setRouteMessage] = useState("");
  const [liveAssessment, setLiveAssessment] = useState<RouteThreatAssessment>();
  const [view, setView] = useState<"both" | "route" | "weather">("both");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!selected) { setRoute([]); setLiveAssessment(undefined); setRouteMessage("Register a shipment to view a route."); return; }
    if (!validCoordinates(selected)) { setRoute([]); setLiveAssessment(undefined); setRouteMessage("Route unavailable: this shipment has no saved origin and destination coordinates."); return; }

    const refreshRouteAndWeather = async (initial: boolean) => {
      if (initial) {
        setRoute([]);
        setLiveAssessment(undefined);
        setRouteMessage("Calculating the live remaining route and weather…");
      }
      try {
        const response = await fetch(`/api/shipments/${selected.id}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !body.routeAvailable) {
          setRoute([]);
          setLiveAssessment(body.weather);
          setRouteMessage(body.reason ?? "A verified route is unavailable for this shipment.");
          return;
        }
        setRoute(body.route);
        setLiveAssessment(body.weather);
        setRouteMessage(`Remaining route recalculated from ${body.routeStart?.source ?? "latest position"} · refreshes every 30 seconds.`);
      } catch {
        if (!cancelled) setRouteMessage("Live route or weather service is unavailable; the last verified overlay remains visible.");
      }
    };
    void refreshRouteAndWeather(true);
    timer = setInterval(() => { void refreshRouteAndWeather(false); }, 30_000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [selected?.id]);

  const assessment = selected ? threatAssessments[selected.id] ?? liveAssessment : liveAssessment;
  return <div className="shipment-map-workspace">
    <div className="shipment-map-tabs" role="tablist" aria-label="Shipment map views">
      <button type="button" role="tab" aria-selected={view === "both"} onClick={() => setView("both")}>Monitor both</button>
      <button type="button" role="tab" aria-selected={view === "route"} onClick={() => setView("route")}>Route map</button>
      <button type="button" role="tab" aria-selected={view === "weather"} onClick={() => setView("weather")}>Weather map</button>
    </div>
    <div className={`shipment-map-grid ${view === "both" ? "is-split" : ""}`}>
      {(view === "both" || view === "route") && <MapPanel kind="route" selected={selected} route={route} assessment={assessment} routeMessage={routeMessage} />}
      {(view === "both" || view === "weather") && <MapPanel kind="weather" selected={selected} route={route} assessment={assessment} routeMessage={routeMessage} />}
    </div>
  </div>;
}
