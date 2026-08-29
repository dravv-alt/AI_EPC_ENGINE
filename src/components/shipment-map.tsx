"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";
import { AlertTriangle, CloudRain, Compass, Eye, Layers, LocateFixed, Radio, RefreshCw, Wind } from "lucide-react";

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

export type WeatherThreat = {
  lat: number;
  lng: number;
  type: string;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
  estimatedDelayHours: number;
  waypointIndex: number;
  region?: string;
  summary?: string;
  severity?: string;
};

export type WeatherObservation = {
  waypointIndex: number;
  lat: number;
  lng: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  threat: WeatherThreat | null;
  region?: string;
  summary?: string;
};

export type RouteThreatAssessment = {
  dataAvailable: boolean;
  source?: string;
  observedAt?: string;
  observations?: WeatherObservation[];
  threats: WeatherThreat[];
  unavailableReasons?: string[];
  totalNewDelayHours?: number;
};

const validCoordinates = (shipment?: MapShipment) =>
  Boolean(
    shipment?.originLat &&
      shipment.originLng &&
      shipment.destinationLat &&
      shipment.destinationLng &&
      [
        shipment.originLat,
        shipment.originLng,
        shipment.destinationLat,
        shipment.destinationLng,
      ].every((value) => Number.isFinite(Number(value)))
  );

const statusColor = (status: string) =>
  status === "red" || status === "critical"
    ? "#be1e2d"
    : status === "amber" || status === "delayed"
      ? "#b5651d"
      : "#2d6b55";

const modeColor = (mode: RouteSegment["mode"]) =>
  mode === "sea" ? "#1677a6" : mode === "air" ? "#7656b5" : "#9a5a1f";

const threatColor = (threat: WeatherThreat) =>
  threat.estimatedDelayHours >= 4
    ? "#be1e2d"
    : threat.estimatedDelayHours > 0
      ? "#d97706"
      : "#2d6b55";

const weatherCondition = (weatherCode: number, windSpeed: number, precipitation: number) => {
  if (weatherCode >= 95) return { label: "Thunderstorm", color: "#ef4444", className: "storm" };
  if (windSpeed > 50) return { label: "High wind", color: "#f97316", className: "wind" };
  if (precipitation > 2.5 || weatherCode >= 61)
    return { label: "Rain", color: "#38bdf8", className: "rain" };
  if (weatherCode >= 45)
    return { label: "Fog / low visibility", color: "#cbd5e1", className: "fog" };
  if (weatherCode >= 1) return { label: "Cloud cover", color: "#94a3b8", className: "cloud" };
  return { label: "Clear", color: "#34d399", className: "clear" };
};

/**
 * Controller to position the map.
 * STOPS unwanted 30s auto-snapping: Only pans when target shipment ID changes or on explicit user request.
 */
function MapCameraController({
  shipmentId,
  route,
  currentPos,
  manualCenterTrigger,
}: {
  shipmentId?: string;
  route: RouteSegment[];
  currentPos: [number, number] | null;
  manualCenterTrigger: number;
}) {
  const map = useMap();
  const lastTargetShipmentIdRef = useRef<string | null>(null);
  const lastManualTriggerRef = useRef(0);

  useEffect(() => {
    if (!shipmentId) return;

    const isInitialOrNewSelection = lastTargetShipmentIdRef.current !== shipmentId;
    const isManualTrigger = manualCenterTrigger !== lastManualTriggerRef.current;

    // Do NOT pan or resize if this is just a 30s polling update for the same shipment
    if (!isInitialOrNewSelection && !isManualTrigger) {
      return;
    }

    lastTargetShipmentIdRef.current = shipmentId;
    lastManualTriggerRef.current = manualCenterTrigger;

    const points = route
      .flatMap((segment) => segment.coords)
      .map(([lat, lng]) => [lat, lng] as LatLngExpression);

    if (points.length > 1) {
      const bounds = latLngBounds(points);
      map.flyToBounds(bounds, {
        padding: [50, 50],
        maxZoom: 7,
        animate: true,
        duration: isManualTrigger ? 0.8 : 1.2,
      });
    } else if (currentPos) {
      map.flyTo(currentPos, 6, { animate: true, duration: 0.8 });
    }
  }, [map, shipmentId, route, currentPos, manualCenterTrigger]);

  return null;
}

function DynamicWeatherWaypoints({
  observations,
  selected,
}: {
  observations: WeatherObservation[];
  selected?: MapShipment;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom() || 4);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  // Dynamic zoom scaling:
  // Core marker radius: zoom 2-3 => 5px; zoom 4-6 => 7px; zoom 7-9 => 9px; zoom 10+ => 11px
  const coreRadius = Math.max(5, Math.min(12, 4 + Math.round(zoom * 0.8)));

  // Dynamic Outer Radar Aura Halo:
  // Smoothly scales with zoom level so it never dominates screen when zooming in
  const baseAuraRadius = Math.max(12, Math.min(55, 6 + Math.round(Math.pow(zoom, 1.35) * 1.8)));

  return (
    <>
      {observations.map((observation, index) => {
        const condition = weatherCondition(
          observation.weatherCode,
          observation.windSpeed,
          observation.precipitation
        );
        const overlayColor = observation.threat
          ? threatColor(observation.threat)
          : condition.color;

        // Threats have a slightly wider radar halo for high contrast
        const auraRadius = observation.threat
          ? Math.round(baseAuraRadius * 1.4)
          : baseAuraRadius;

        const iconEmoji =
          condition.label === "Thunderstorm"
            ? "⚡"
            : condition.label === "High wind"
              ? "💨"
              : condition.label === "Rain"
                ? "🌧️"
                : condition.label === "Fog / low visibility"
                  ? "🌫️"
                  : condition.label === "Cloud cover"
                    ? "☁️"
                    : "☀️";

        return (
          <Fragment key={`${selected?.id}-weather-${observation.waypointIndex}-${index}`}>
            {/* Dynamic Zoom-Responsive Outer Radar Aura Halo */}
            <CircleMarker
              center={[observation.lat, observation.lng]}
              radius={auraRadius}
              pathOptions={{
                color: overlayColor,
                weight: observation.threat ? 2 : 1,
                fillColor: overlayColor,
                fillOpacity: observation.threat ? 0.35 : 0.15,
                interactive: false,
                className: `weather-zone weather-${condition.className} ${
                  observation.threat ? "is-threat" : "is-clear"
                }`,
              }}
            />

            {/* Extra Outer Radar Pulse Ring for Active Disruption Threats */}
            {observation.threat && (
              <CircleMarker
                center={[observation.lat, observation.lng]}
                radius={Math.round(auraRadius * 1.35)}
                pathOptions={{
                  color: "#ef4444",
                  weight: 1.5,
                  dashArray: "4, 4",
                  fillColor: "transparent",
                  fillOpacity: 0,
                  interactive: false,
                  className: "threat-radar-pulse",
                }}
              />
            )}

            {/* Center Interactive Waypoint Marker: Data displayed immediately on click */}
            <CircleMarker
              center={[observation.lat, observation.lng]}
              radius={coreRadius}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: overlayColor,
                fillOpacity: 1,
                className: "weather-sample-marker",
              }}
            >
              <Popup autoPan={true}>
                <div style={{ minWidth: "200px", lineHeight: "1.4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "16px" }}>{iconEmoji}</span>
                    <b>{condition.label}</b>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--theme-text-accent, #38bdf8)", fontWeight: 600, marginBottom: "2px" }}>
                    📍 {observation.region || `Corridor (${observation.lat.toFixed(2)}°, ${observation.lng.toFixed(2)}°)`}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--muted)", marginBottom: "6px" }}>
                    Waypoint #{observation.waypointIndex} of {observations.length} ({observation.lat.toFixed(2)}°, {observation.lng.toFixed(2)}°)
                  </div>
                  <div style={{ fontSize: "12px", borderTop: "1px solid var(--line)", paddingTop: "6px" }}>
                    💨 Sustained Wind: <b>{observation.windSpeed} km/h</b>
                    <br />
                    🌧️ Precipitation: <b>{observation.precipitation} mm/h</b>
                    <br />
                    📡 WMO Code: <b>{observation.weatherCode}</b>
                  </div>
                  {observation.threat ? (
                    <div style={{ marginTop: "6px", borderTop: "1px dashed rgba(239, 68, 68, 0.4)", paddingTop: "4px" }}>
                      <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "bold", display: "block" }}>
                        ⚠️ Delay Impact: +{observation.threat.estimatedDelayHours} hrs
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                        {observation.threat.summary}
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: "6px", color: "#10b981", fontSize: "11px" }}>
                      ✅ Operational conditions normal
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}

function MapPanel({
  kind,
  selected,
  route,
  assessment,
  routeMessage,
  radarPath,
  satellitePath,
  weatherLayerType = "radar",
  centerTrigger = 0,
}: {
  kind: "route" | "weather";
  selected?: MapShipment;
  route: RouteSegment[];
  assessment?: RouteThreatAssessment;
  routeMessage: string;
  radarPath: string | null;
  satellitePath: string | null;
  weatherLayerType?: "radar" | "satellite";
  centerTrigger?: number;
}) {
  const center = useMemo<LatLngExpression>(
    () =>
      selected?.currentLat && selected.currentLng
        ? [Number(selected.currentLat), Number(selected.currentLng)]
        : validCoordinates(selected)
          ? [Number(selected!.originLat), Number(selected!.originLng)]
          : [20.5937, 78.9629],
    [selected]
  );

  const current =
    selected?.currentLat && selected.currentLng
      ? ([Number(selected.currentLat), Number(selected.currentLng)] as [number, number])
      : null;

  const origin = validCoordinates(selected)
    ? ([Number(selected!.originLat), Number(selected!.originLng)] as LatLngExpression)
    : null;

  const destination = validCoordinates(selected)
    ? ([Number(selected!.destinationLat), Number(selected!.destinationLng)] as LatLngExpression)
    : null;

  const threats = assessment?.dataAvailable ? assessment.threats ?? [] : [];
  const observations = assessment?.observations ?? [];
  const maxWind = observations.reduce((max, item) => Math.max(max, item.windSpeed), 0);
  const maxRain = observations.reduce((max, item) => Math.max(max, item.precipitation), 0);
  const observedAt = assessment?.observedAt
    ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
        new Date(assessment.observedAt)
      )
    : "—";

  // Dynamic Tile URL: RainViewer Doppler Precipitation OR NASA GIBS Global Satellite TrueColor Imagery
  const activeWeatherTileUrl = useMemo(() => {
    if (weatherLayerType === "satellite") {
      return "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg";
    }
    if (radarPath) {
      return `https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`;
    }
    return null;
  }, [weatherLayerType, radarPath]);

  return (
    <section
      className={`shipment-map-frame shipment-map-panel shipment-map-panel-${kind}`}
      aria-label={`${kind === "route" ? "Shipment route" : "Route weather"} map`}
      style={{ position: "relative" }}
    >
      {/* Sleek Sub-Header: Zero Clutter */}
      <header className="shipment-map-panel-heading">
        <div className="map-heading-left">
          <div className="map-panel-title">
            <span className="map-panel-dot" style={{ background: kind === "route" ? "#0284c7" : "#38bdf8" }} />
            <b>
              {kind === "route"
                ? "Multimodal Route Monitor"
                : weatherLayerType === "satellite"
                  ? "Infrared Satellite Cloud Cover"
                  : "Live Doppler Rain Radar"}
            </b>
          </div>
          <span className="map-panel-subtitle">
            {kind === "route"
              ? `${selected?.originName ?? "Origin"} → ${selected?.destinationName ?? "Site"}`
              : weatherLayerType === "satellite"
                ? `${observations.length} Waypoints · Full Global Ocean & Land Orbital Satellite Coverage`
                : `${observations.length} Waypoints · Doppler Precipitation (Coastal/Land; switch to Satellite for open oceans)`}
          </span>
        </div>

        <div className="map-heading-right">
          {kind === "route" ? (
            <span className="map-status-pill">
              <span className="live-dot" />
              {selected?.positionSource === "live" || selected?.positionSource === "aisstream"
                ? "Live AIS Position"
                : "Simulated Telemetry"}
            </span>
          ) : (
            <span
              className={`map-status-pill ${assessment?.dataAvailable ? "is-ready" : "is-waiting"}`}
            >
              <span className="live-dot" />
              {assessment?.dataAvailable ? "Atmospheric Radar Live" : "Connecting Radar"}
            </span>
          )}
        </div>
      </header>

      <MapContainer
        className={`shipment-map ${kind === "weather" ? "shipment-weather-map" : ""}`}
        center={center}
        zoom={4}
        scrollWheelZoom
      >
        {/* Crisp Dark Basemap without any watermarks or API keys */}
        {kind === "route" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <>
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> &middot; HERE, Garmin, NGA, USGS'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxZoom={16}
            />
            {/* Dynamic Live Global RainViewer Radar / NASA GIBS Satellite Tile Layer */}
            {activeWeatherTileUrl && (
              <TileLayer
                key={`${weatherLayerType}-${activeWeatherTileUrl}`}
                opacity={weatherLayerType === "satellite" ? 0.85 : 0.75}
                maxZoom={weatherLayerType === "satellite" ? 9 : 16}
                zIndex={4}
                attribution={
                  weatherLayerType === "satellite"
                    ? '&copy; <a href="https://earthdata.nasa.gov/">NASA GIBS</a> / NOAA VIIRS Live Satellite'
                    : '&copy; <a href="https://www.rainviewer.com/">RainViewer</a> Live Radar'
                }
                url={activeWeatherTileUrl}
              />
            )}
          </>
        )}

        {/* Camera controller that respects user manual panning without 30s auto-resets */}
        <MapCameraController
          shipmentId={selected?.id}
          route={route}
          currentPos={current}
          manualCenterTrigger={centerTrigger}
        />

        {/* Route Polylines: Exact multi-modal distinction */}
        {route.map((segment, index) => {
          const isSea = segment.mode === "sea";
          const isLand = segment.mode === "land";
          return (
            <Polyline
              positions={segment.coords}
              pathOptions={{
                color: isSea ? "#0284c7" : isLand ? "#ea580c" : "#9333ea",
                weight: isSea ? 5 : isLand ? 4 : 3,
                opacity: 0.95,
                dashArray: isLand ? undefined : kind === "weather" ? "6, 6" : undefined,
                className: `shipment-route segment-${segment.mode}`,
                interactive: kind === "route",
              }}
              key={`${kind}-${selected?.id}-${segment.mode}-${index}`}
            >
              {kind === "route" && (
                <Popup>
                  <b>{isSea ? "🚢 Maritime Ocean Transit" : isLand ? "🚚 Overland Highway Drayage" : "✈️ Air Corridor"}</b>
                  <br />
                  {segment.coords.length} sampled corridor waypoints
                </Popup>
              )}
            </Polyline>
          );
        })}

        {/* Port Transload Docks: Placed at transition between Sea & Land */}
        {route.length > 1 &&
          route.slice(0, -1).map((seg, idx) => {
            const nextSeg = route[idx + 1];
            if (seg.mode !== nextSeg.mode && (seg.mode === "sea" || nextSeg.mode === "sea")) {
              const transloadPoint = seg.coords[seg.coords.length - 1] ?? nextSeg.coords[0];
              return (
                <CircleMarker
                  key={`transload-${idx}`}
                  center={transloadPoint}
                  radius={7}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#0284c7",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <b>⚓ Seaport Transload Dock</b>
                    <br />
                    Container transfer between ocean vessel & overland truck drayage
                  </Popup>
                </CircleMarker>
              );
            }
            return null;
          })}

        {origin && (
          <CircleMarker
            center={origin}
            radius={7}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
          >
            <Popup>
              <b>Origin</b>
              <br />
              {selected?.originName}
            </Popup>
          </CircleMarker>
        )}

        {destination && (
          <CircleMarker
            center={destination}
            radius={7}
            pathOptions={{ color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }}
          >
            <Popup>
              <b>Destination</b>
              <br />
              {selected?.destinationName}
            </Popup>
          </CircleMarker>
        )}

        {current && (
          <CircleMarker
            center={current}
            radius={10}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: statusColor(selected?.status ?? "green"),
              fillOpacity: 1,
              className: "shipment-position-marker",
            }}
          >
            <Popup>
              <b>{selected?.name}</b>
              <br />
              {selected?.positionSource === "live" || selected?.positionSource === "aisstream"
                ? "Live AIS position"
                : "Simulated position"}
            </Popup>
          </CircleMarker>
        )}

        {/* Waypoint Weather Sample Spheres with Dynamic Zoom Scaling */}
        {kind === "weather" && (
          <DynamicWeatherWaypoints observations={observations} selected={selected} />
        )}
      </MapContainer>

      {/* Clean Bottom HUD: Telemetry on left, Map Legend on right */}
      <div className="map-bottom-hud">
        {kind === "weather" && assessment?.dataAvailable ? (
          <div className="map-hud-metrics" aria-label="Live route weather summary">
            <span className="hud-metric">
              <small>Peak Wind</small>
              <b>{maxWind.toFixed(0)} km/h</b>
            </span>
            <span className="hud-metric">
              <small>Peak Rain</small>
              <b>{maxRain.toFixed(1)} mm/h</b>
            </span>
            <span className="hud-metric">
              <small>Updated</small>
              <b>{observedAt}</b>
            </span>
          </div>
        ) : kind === "route" && routeMessage ? (
          <div className="map-hud-message" role="status">
            {routeMessage}
          </div>
        ) : (
          <div />
        )}

        <div className="shipment-map-legend" aria-label="Map legend">
          {kind === "route" ? (
            <>
              <span>
                <i style={{ background: modeColor("sea") }} />
                Sea
              </span>
              <span>
                <i style={{ background: modeColor("air") }} />
                Air
              </span>
              <span>
                <i style={{ background: modeColor("land") }} />
                Land
              </span>
            </>
          ) : (
            <>
              <span>
                <i style={{ background: "#34d399" }} />
                Clear
              </span>
              <span>
                <i style={{ background: "#94a3b8" }} />
                Clouds
              </span>
              <span>
                <i style={{ background: "#38bdf8" }} />
                Rain
              </span>
              <span>
                <i style={{ background: "#f97316" }} />
                Wind
              </span>
              <span>
                <i style={{ background: "#ef4444" }} />
                Severe
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ShipmentMap({
  shipments,
  selectedId,
  threatAssessments = {},
  onAssessmentChange,
}: {
  shipments: MapShipment[];
  selectedId?: string;
  threatAssessments?: Record<string, RouteThreatAssessment>;
  onAssessmentChange?: (shipmentId: string, assessment: RouteThreatAssessment) => void;
}) {
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? shipments[0];
  const [route, setRoute] = useState<RouteSegment[]>([]);
  const [routeMessage, setRouteMessage] = useState("");
  const [liveAssessment, setLiveAssessment] = useState<RouteThreatAssessment>();
  const [view, setView] = useState<"both" | "route" | "weather">("both");
  const [weatherLayerType, setWeatherLayerType] = useState<"radar" | "satellite">("radar");
  const [centerTrigger, setCenterTrigger] = useState(0);

  const [intervalKm, setIntervalKm] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("epc_waypoint_interval_km");
      if (saved) return Number(saved) || 200;
    }
    return 200;
  });

  const handleIntervalChange = (newInterval: number) => {
    setIntervalKm(newInterval);
    if (typeof window !== "undefined") {
      localStorage.setItem("epc_waypoint_interval_km", String(newInterval));
    }
  };

  // Real-time RainViewer radar and satellite paths
  const [radarPath, setRadarPath] = useState<string | null>(null);
  const [satellitePath, setSatellitePath] = useState<string | null>(null);

  // Fetch live global RainViewer weather radar & infrared satellite frames
  useEffect(() => {
    let cancelled = false;
    const fetchWeatherMaps = async () => {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const radarPast = data?.radar?.past;
        if (radarPast && radarPast.length > 0) {
          setRadarPath(radarPast[radarPast.length - 1].path);
        }
        const satInfrared = data?.satellite?.infrared;
        if (satInfrared && satInfrared.length > 0) {
          setSatellitePath(satInfrared[satInfrared.length - 1].path);
        }
      } catch {
        // Silently keep default fallback
      }
    };
    void fetchWeatherMaps();
    const interval = setInterval(fetchWeatherMaps, 5 * 60 * 1000); // 5 min refresh
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setRoute([]);
      setLiveAssessment(undefined);
      setRouteMessage("Register a shipment to view a route.");
      return;
    }
    if (!validCoordinates(selected)) {
      setRoute([]);
      setLiveAssessment(undefined);
      setRouteMessage("Route unavailable: this shipment has no saved origin and destination coordinates.");
      return;
    }

    const refreshRouteAndWeather = async (initial: boolean) => {
      if (initial) {
        setRoute([]);
        setLiveAssessment(undefined);
        setRouteMessage("Calculating the live remaining route and weather…");
      }
      try {
        const response = await fetch(`/api/shipments/${selected.id}?intervalKm=${intervalKm}`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !body.routeAvailable) {
          setRoute([]);
          setLiveAssessment(body.weather);
          if (body.weather) {
            onAssessmentChange?.(selected.id, body.weather);
          }
          setRouteMessage(body.reason ?? "A verified route is unavailable for this shipment.");
          return;
        }
        setRoute(body.route);
        setLiveAssessment(body.weather);
        if (body.weather) {
          onAssessmentChange?.(selected.id, body.weather);
        }
        setRouteMessage(
          `Remaining route recalculated from ${body.routeStart?.source ?? "latest position"} · refreshes every 30 seconds.`
        );
      } catch {
        if (!cancelled)
          setRouteMessage("Live route or weather service is unavailable; the last verified overlay remains visible.");
      }
    };
    void refreshRouteAndWeather(true);
    const timer = setInterval(() => {
      void refreshRouteAndWeather(false);
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selected?.id, intervalKm]);

  const assessment = selected ? threatAssessments[selected.id] ?? liveAssessment : liveAssessment;
  const threats = assessment?.dataAvailable ? assessment.threats ?? [] : [];

  return (
    <div className="shipment-map-workspace">
      {/* 1. Master Control Header Toolbar: Clean, Single-Line with zero cut-off */}
      <div className="shipment-map-master-bar">
        {/* Left: View Tabs */}
        <div className="map-view-switcher" role="tablist" aria-label="Shipment map view modes">
          <button
            type="button"
            role="tab"
            aria-selected={view === "both"}
            onClick={() => setView("both")}
          >
            Monitor Both
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "route"}
            onClick={() => setView("route")}
          >
            Route Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "weather"}
            onClick={() => setView("weather")}
          >
            Weather Radar
          </button>
        </div>

        {/* Right: Global Actions & Layer Controls (Always fully visible, never pushed off) */}
        <div className="map-master-actions">
          {(view === "both" || view === "weather") && (
            <>
              {/* Radar / Satellite Toggle with clear descriptive tooltips */}
              <div className="map-segmented-pill" role="group" aria-label="Weather overlay mode">
                <button
                  type="button"
                  className={weatherLayerType === "radar" ? "is-active" : ""}
                  onClick={() => setWeatherLayerType("radar")}
                  title="Rain Radar: Live Doppler precipitation tracking active rain, downpours, and storms"
                >
                  <CloudRain size={12} /> Rain Radar
                </button>
                <button
                  type="button"
                  className={weatherLayerType === "satellite" ? "is-active" : ""}
                  onClick={() => setWeatherLayerType("satellite")}
                  title="Satellite Clouds: Infrared orbital satellite tracking cloud cover and cyclone formations"
                >
                  <Layers size={12} /> Satellite Clouds
                </button>
              </div>

              {/* Waypoint Resolution */}
              <div className="map-select-pill" title="Adjust distance between sampled waypoints">
                <span className="select-label">Density:</span>
                <select
                  value={intervalKm}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  aria-label="Waypoint sampling resolution"
                >
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                  <option value={200}>200 km (Std)</option>
                  <option value={350}>350 km</option>
                  <option value={500}>500 km</option>
                  <option value={1000}>1,000 km</option>
                </select>
              </div>
            </>
          )}

          {/* Master Re-center button */}
          <button
            type="button"
            className="map-action-btn"
            title="Re-center map on route"
            onClick={() => setCenterTrigger((prev) => prev + 1)}
          >
            <LocateFixed size={12} /> Center
          </button>
        </div>
      </div>

      {/* 2. Full-Width Threat Ribbon: Clean, High-Visibility, Zero Button Collision */}
      {threats.length > 0 && (
        <div className="map-threat-ribbon" role="alert">
          <AlertTriangle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />
          <span className="threat-title">
            {threats.length} Route Disruption{threats.length > 1 ? "s" : ""}:
          </span>
          <span className="threat-desc">
            {threats[0].region ? `${threats[0].region} · ` : ""}
            +{threats.reduce((sum, t) => sum + t.estimatedDelayHours, 0)}h projected delay
            {threats[0].summary ? ` (${threats[0].summary})` : ""}
          </span>
        </div>
      )}

      {/* 2. Map Canvas Grid */}
      <div className={`shipment-map-grid ${view === "both" ? "is-split" : ""}`}>
        {(view === "both" || view === "route") && (
          <MapPanel
            kind="route"
            selected={selected}
            route={route}
            assessment={assessment}
            routeMessage={routeMessage}
            radarPath={radarPath}
            satellitePath={satellitePath}
            weatherLayerType={weatherLayerType}
            centerTrigger={centerTrigger}
          />
        )}
        {(view === "both" || view === "weather") && (
          <MapPanel
            kind="weather"
            selected={selected}
            route={route}
            assessment={assessment}
            routeMessage={routeMessage}
            radarPath={radarPath}
            satellitePath={satellitePath}
            weatherLayerType={weatherLayerType}
            centerTrigger={centerTrigger}
          />
        )}
      </div>
    </div>
  );
}

