"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { MapContainer, Marker, Polyline, Popup, Tooltip, TileLayer, useMap, CircleMarker } from "react-leaflet";
import LatLngGraticule from "react-leaflet-lat-lng-graticule";
import { latLngBounds, type LatLngExpression } from "leaflet";

import { getShipmentRoute } from "@/lib/routing";

export type MapShipment = {
  id: string; name: string; status: string;
  transportMode: "sea" | "air" | "land";
  originName: string | null; originLat: string | null; originLng: string | null;
  destinationName: string | null; destinationLat: string | null; destinationLng: string | null;
  currentLat: string | null; currentLng: string | null;
  positionSource: string;
  weatherDelayFactor: string | number | null;
  weatherAdjustedEta: Date | string | null;
  plannedEta: Date | string;
};

// Single world extent
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-85, -180], [85, 180]];

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ─── Navigator ────────────────────────────────────────────────────────────────
function Navigator({ shipment }: { shipment?: MapShipment }) {
  const map = useMap();
  const [lastZoomedId, setLastZoomedId] = useState<string | null>(null);
  useEffect(() => {
    if (!shipment || shipment.id === lastZoomedId) return;
    if (shipment.originLat && shipment.originLng && shipment.destinationLat && shipment.destinationLng) {
      const bounds = latLngBounds([
        [Number(shipment.originLat), Number(shipment.originLng)],
        [Number(shipment.destinationLat), Number(shipment.destinationLng)],
      ]);
      map.fitBounds(bounds, { padding: [150, 150], maxZoom: 7 });
      setLastZoomedId(shipment.id);
    }
  }, [map, shipment, lastZoomedId]);
  return null;
}

function MapEvents({ onMove }: { onMove: (lat: number, lng: number, zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const center = map.getCenter();
      onMove(center.lat, center.lng, map.getZoom());
    };
    map.on('moveend', handler);
    // initial trigger
    handler();
    return () => { map.off('moveend', handler); };
  }, [map, onMove]);
  return null;
}

function DmsDisplay() {
  const map = useMap();
  const [dms, setDms] = useState("");
  useEffect(() => {
    const formatDms = (val: number, isLat: boolean) => {
      const dir = val < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
      const absVal = Math.abs(val);
      const d = Math.floor(absVal);
      const m = Math.floor((absVal - d) * 60);
      const s = (((absVal - d) * 60) - m) * 60;
      return `${d}°${m}'${s.toFixed(1)}"${dir}`;
    };
    
    const handler = (e: any) => {
      setDms(`${formatDms(e.latlng.lat, true)} ${formatDms(e.latlng.lng, false)}`);
    };
    map.on('mousemove', handler);
    return () => { map.off('mousemove', handler); };
  }, [map]);
  
  if (!dms) return null;
  return (
    <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: '11px', fontFamily: 'monospace' }}>
      {dms}
    </div>
  );
}

function getL() {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("leaflet");
}

// ─── Clean minimal SVG silhouettes ───────────────────────────────────────────
const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>`;
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.7l-1.3 2.6c-.2.4-.1 1 .3 1.3L9 14l-4 4-3.2-1.6c-.4-.2-.9 0-1.1.4l-.5 1c-.2.4 0 .9.4 1.1L5 20.5l1.6 4.4c.2.4.7.6 1.1.4l1-.5c.4-.2.6-.7.4-1.1L7.5 20l4-4 3.2 6.3c.3.4.9.5 1.3.3l2.6-1.3c.5-.2.8-.6.7-1.1Z"/></svg>`;
const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;

const MODE_SVG: Record<string, string> = { sea: SHIP_SVG, air: PLANE_SVG, land: TRUCK_SVG };

// ─── Vehicle icon — clean flat pin with silhouette ────────────────────────────
function makeVehicleIcon(mode: "sea" | "air" | "land", statusColor: string, isSelected: boolean, bearing: number) {
  const L = getL();
  if (!L) return null;
  const s = isSelected ? 34 : 28;
  const ring = isSelected ? `box-shadow:0 0 0 2px ${statusColor},0 3px 12px rgba(0,0,0,0.5);` : `box-shadow:0 2px 8px rgba(0,0,0,0.4);`;
  const rotation = 0; // Strictly vertical, no destination-facing rotation

  const html = `<div style="width:${s}px;height:${s}px;background:#0f172a;border-radius:50%;display:flex;align-items:center;justify-content:center;${ring}border:2px solid ${statusColor};">
    <div style="color:white;display:flex;align-items:center;justify-content:center;width:16px;height:16px;transform:rotate(${rotation}deg);transition:transform 0.3s ease;">${MODE_SVG[mode]}</div>
  </div>`;
  return L.divIcon({ html, className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -(s / 2 + 6)] });
}

// ─── Tiny origin dot ──────────────────────────────────────────────────────────
function makeOriginIcon() {
  const L = getL();
  if (!L) return null;
  const html = `<div style="width:10px;height:10px;border-radius:50%;background:#ffffff;border:2px solid #334155;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -6] });
}

// ─── Tiny destination dot ─────────────────────────────────────────────────────
function makeDestIcon() {
  const L = getL();
  if (!L) return null;
  const html = `<div style="width:10px;height:10px;border-radius:50%;background:#334155;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`;
  return L.divIcon({ html, className: "", iconSize: [10, 10], iconAnchor: [5, 5], popupAnchor: [0, -6] });
}

// ─── Interpolate position along flat [lat,lng] point array ───────────────────
function interpolateAlongRoute(pts: [number, number][], t: number): { pos: [number, number], bearing: number } | null {
  if (pts.length === 0) return null;
  if (pts.length === 1) return { pos: pts[0], bearing: 0 };
  let total = 0;
  const dists: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    dists.push(total);
  }
  const target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= target) {
      const ratio = (target - dists[i - 1]) / (dists[i] - dists[i - 1]);
      const pos = [
        pts[i - 1][0] + ratio * (pts[i][0] - pts[i - 1][0]),
        pts[i - 1][1] + ratio * (pts[i][1] - pts[i - 1][1]),
      ] as [number, number];
      const bearing = getBearing(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
      return { pos, bearing };
    }
  }
  const last = pts[pts.length - 1];
  const secLast = pts[pts.length - 2];
  return { pos: last, bearing: getBearing(secLast[0], secLast[1], last[0], last[1]) };
}

// ─── Snap point to closest segment on polyline ─────────────────────────────────
function snapToLine(lat: number, lng: number, pts: [number, number][]): { pos: [number, number], bearing: number } {
  if (pts.length === 0) return { pos: [lat, lng], bearing: 0 };
  if (pts.length === 1) return { pos: pts[0], bearing: 0 };
  let minD = Infinity;
  let bestP = pts[0];
  let bestBearing = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i+1];
    const l2 = (p2[0]-p1[0])**2 + (p2[1]-p1[1])**2;
    if (l2 === 0) continue;
    let t = ((lat - p1[0]) * (p2[0] - p1[0]) + (lng - p1[1]) * (p2[1] - p1[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] as [number, number];
    const d = (proj[0] - lat)**2 + (proj[1] - lng)**2;
    if (d < minD) {
      minD = d;
      bestP = proj;
      bestBearing = getBearing(p1[0], p1[1], p2[0], p2[1]);
    }
  }
  return { pos: bestP, bearing: bestBearing };
}

// ─── Estimate journey progress fraction from ETAs ────────────────────────────
function journeyProgress(shipment: MapShipment): number {
  try {
    const eta = new Date(shipment.weatherAdjustedEta ?? shipment.plannedEta).getTime();
    const now = Date.now();
    if (eta <= now) return 0.98;
    const delay = Number(shipment.weatherDelayFactor ?? 1);
    const base = delay > 1.1 ? 0.35 : delay < 0.95 ? 0.65 : 0.5;
    return Math.max(0.02, Math.min(0.98, base));
  } catch { return 0.5; }
}

// ─── Vehicle Marker at current position ──────────────────────────────────────
function VehicleMarker({ shipment, selectedId, statusColor, routePoints }: {
  shipment: MapShipment;
  selectedId?: string;
  statusColor: string;
  routePoints: [number, number][];
}) {
  const isSelected = selectedId === shipment.id;

  const dbLat = shipment.currentLat ? Number(shipment.currentLat) : null;
  const dbLng = shipment.currentLng ? Number(shipment.currentLng) : null;
  const hasLive = dbLat !== null && dbLng !== null && isFinite(dbLat) && isFinite(dbLng);

  const progress = useMemo(() => journeyProgress(shipment), [shipment]);
  const interpolated = useMemo(() => routePoints.length > 0 ? interpolateAlongRoute(routePoints, progress) : null, [routePoints, progress]);

  const snapped = hasLive && routePoints.length > 0 ? snapToLine(dbLat, dbLng, routePoints) : null;

  const [lat, lng, bearing] = hasLive
    ? (snapped ? [snapped.pos[0], snapped.pos[1], snapped.bearing] : [dbLat, dbLng, 0])
    : interpolated
      ? [interpolated.pos[0], interpolated.pos[1], interpolated.bearing]
      : [null, null, 0];

  const icon = useMemo(
    () => makeVehicleIcon(shipment.transportMode as "sea" | "air" | "land", statusColor, isSelected, bearing),
    [shipment.transportMode, statusColor, isSelected, bearing]
  );

  const [weather, setWeather] = useState<{ temperature?: number; windspeed?: number } | null>(null);
  useEffect(() => {
    if (!lat || !lng || !isFinite(lat) || !isFinite(lng)) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
      .then(r => r.json()).then(d => { if (d.current_weather) setWeather(d.current_weather); }).catch(() => {});
  }, [lat, lng]);

  if (!lat || !lng || !isFinite(lat) || !isFinite(lng) || !icon) return null;

  return (
    <Marker position={[lat, lng]} icon={icon} zIndexOffset={isSelected ? 1000 : 500}>
      <Popup>
        <div style={{ minWidth: 200, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{shipment.name}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
            {shipment.transportMode === "sea" ? "🚢 Maritime" : shipment.transportMode === "air" ? "✈️ Air freight" : "🚛 Road freight"}
            {" · "}
            {hasLive ? "📡 Live position" : "📍 Estimated position"}
          </div>
          <div style={{ fontSize: 12, marginBottom: 2 }}>
            Status: <span style={{ color: statusColor, fontWeight: 600 }}>{shipment.status.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 2 }}>
            ETA: <b>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(shipment.weatherAdjustedEta ?? shipment.plannedEta))}</b>
          </div>
          {weather && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>
              🌡 {weather.temperature}°C · 💨 {weather.windspeed} km/h
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// ─── Tiny endpoint markers ────────────────────────────────────────────────────
function EndpointMarkers({ shipment }: { shipment: MapShipment }) {
  const originIcon = useMemo(() => makeOriginIcon(), []);
  const destIcon = useMemo(() => makeDestIcon(), []);

  const oLat = shipment.originLat ? Number(shipment.originLat) : null;
  const oLng = shipment.originLng ? Number(shipment.originLng) : null;
  const dLat = shipment.destinationLat ? Number(shipment.destinationLat) : null;
  const dLng = shipment.destinationLng ? Number(shipment.destinationLng) : null;

  if (!originIcon || !destIcon) return null;

  return (
    <>
      {oLat && oLng && isFinite(oLat) && isFinite(oLng) && (
        <Marker position={[oLat, oLng]} icon={originIcon} zIndexOffset={100}>
          <Tooltip direction="top" offset={[0, -6]}>
            <div style={{ fontSize: 12 }}>
              <b>Origin</b> · {shipment.originName ?? `${oLat.toFixed(2)}, ${oLng.toFixed(2)}`}
            </div>
          </Tooltip>
        </Marker>
      )}
      {dLat && dLng && isFinite(dLat) && isFinite(dLng) && (
        <Marker position={[dLat, dLng]} icon={destIcon} zIndexOffset={100}>
          <Tooltip direction="top" offset={[0, -6]}>
            <div style={{ fontSize: 12 }}>
              <b>Destination</b> · {shipment.destinationName ?? `${dLat.toFixed(2)}, ${dLng.toFixed(2)}`}
            </div>
          </Tooltip>
        </Marker>
      )}
    </>
  );
}

// ─── Route colours per mode ───────────────────────────────────────────────────
const MODE_COLOR: Record<string, string> = {
  sea: "#2563eb",
  air: "#0d9488",
  land: "#b45309",
};

// ─── Shipment Layer: route + endpoint pins + vehicle ─────────────────────────
function ShipmentLayer({ shipment, selectedId, statusColor, threats = [] }: {
  shipment: MapShipment; selectedId?: string; statusColor: string; threats: any[];
}) {
  const [segments, setSegments] = useState<{ mode: "land"|"sea"|"air", coords: [number, number][] }[]>([]);
  const isSelected = selectedId === shipment.id;

  useEffect(() => {
    const oLat = Number(shipment.originLat);
    const oLng = Number(shipment.originLng);
    const dLat = Number(shipment.destinationLat);
    const dLng = Number(shipment.destinationLng);
    if (!shipment.originLat || !shipment.originLng || !shipment.destinationLat || !shipment.destinationLng) return;
    if (!isFinite(oLat) || !isFinite(oLng) || !isFinite(dLat) || !isFinite(dLng)) return;
    getShipmentRoute(oLat, oLng, dLat, dLng, shipment.transportMode as "sea" | "air" | "land")
      .then(setSegments).catch(console.error);
  }, [shipment.originLat, shipment.originLng, shipment.destinationLat, shipment.destinationLng, shipment.transportMode]);

  // Flatten segments to [lat,lng] for position interpolation
  const flatPoints = useMemo(
    () => segments.flatMap(s => s.coords).filter(([la, lo]) => isFinite(la) && isFinite(lo)),
    [segments]
  );

  return (
    <>
      {segments.map((seg, i) => {
        const routeColor = MODE_COLOR[seg.mode] ?? "#2563eb";
        const pathOptions: Record<string, unknown> = {
          color: routeColor,
          weight: isSelected ? 4 : 2.5,
          opacity: isSelected ? 0.95 : 0.6,
          ...(seg.mode === "air" ? { dashArray: "10, 8" } : {}),
          ...(seg.mode === "land" ? { dashArray: "4, 6" } : {}),
        };
        return <Polyline key={`${shipment.id}-r${i}`} positions={seg.coords} pathOptions={pathOptions} />;
      })}
      <EndpointMarkers shipment={shipment} />
      <VehicleMarker
        shipment={shipment}
        selectedId={selectedId}
        statusColor={statusColor}
        routePoints={flatPoints}
      />
      {/* Render threat markers along the route */}
      {isSelected && threats.map((t, i) => (
        <CircleMarker key={i} center={[t.lat, t.lng]} radius={8} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.6, weight: 2 }}>
          <Popup>
            <div style={{ fontSize: 12 }}>
              <b>⚠ Weather Threat</b><br/>
              {t.weatherDesc}<br/>
              Wind gusts: {t.windGustsKmH} km/h<br/>
              Precip: {t.precipitationMm} mm/h<br/>
              Delay: +{t.delayHours}h
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

// ─── Map ──────────────────────────────────────────────────────────────────────
export default function ShipmentMap({ shipments, selectedId, threatAssessments = {} }: { shipments: MapShipment[]; selectedId?: string; threatAssessments?: Record<string, any> }) {
  const selected = shipments.find(s => s.id === selectedId) ?? shipments[0];
  const center = useMemo<LatLngExpression>(() => [20, 0], []);

  const statusColor = (s: string) => s === "red" ? "#dc2626" : s === "amber" ? "#d97706" : "#16a34a";

  const [viewMode, setViewMode] = useState<"route" | "weather">("route");
  const [mapState, setMapState] = useState({ lat: 20, lng: 0, zoom: 3 });

  const handleMapMove = useCallback((lat: number, lng: number, zoom: number) => {
    setMapState(prev => {
      if (prev.lat === lat && prev.lng === lng && prev.zoom === zoom) return prev;
      return { lat, lng, zoom };
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", flex: 1, position: "relative" }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        backgroundColor: "var(--surface-2, #0f172a)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "none", borderRadius: "8px 8px 0 0",
        padding: "7px 14px", fontSize: 12, color: "#94a3b8",
      }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
          <button 
            onClick={() => setViewMode("route")} 
            style={{ padding: '4px 12px', background: viewMode === 'route' ? 'rgba(255,255,255,0.2)' : 'transparent', color: viewMode === 'route' ? '#fff' : '#cbd5e1', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: viewMode === 'route' ? 600 : 400 }}
          >
            Route Map
          </button>
          <button 
            onClick={() => setViewMode("weather")} 
            style={{ padding: '4px 12px', background: viewMode === 'weather' ? 'rgba(255,255,255,0.2)' : 'transparent', color: viewMode === 'weather' ? '#fff' : '#cbd5e1', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: viewMode === 'weather' ? 600 : 400 }}
          >
            Wind & Ocean Currents
          </button>
        </div>
        
        {viewMode === "route" && (
          <>
            <span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#334155", marginLeft: 10 }}>Legend:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 2.5, backgroundColor: "#2563eb", borderRadius: 2 }} />
              <span style={{ fontSize: 11 }}>Sea</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 0, borderTop: "2px dashed #0d9488", borderRadius: 2 }} />
              <span style={{ fontSize: 11 }}>Air</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 2.5, backgroundColor: "#b45309", borderRadius: 2 }} />
              <span style={{ fontSize: 11 }}>Land</span>
            </div>
          </>
        )}
      </div>

      {/* ── Map ── */}
      <div style={{ position: "relative", flex: 1, display: viewMode === "route" ? "block" : "none", minHeight: 660 }}>
        <MapContainer
          className="shipment-map"
          center={center}
          zoom={3}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom
          worldCopyJump={false}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ borderRadius: 0, width: "100%", height: "100%" }}
        >
          <MapEvents onMove={handleMapMove} />
          <DmsDisplay />
          {/* @ts-ignore */}
          <LatLngGraticule
            showLabel={true}
            color="#64748b"
            weight={0.6}
            opacity={0.3}
            zoomInterval={[
              { start: 2, end: 3, interval: 20 },
              { start: 4, end: 5, interval: 10 },
              { start: 6, end: 8, interval: 5 },
              { start: 9, end: 18, interval: 1 }
            ]}
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution=""
            noWrap={true}
          />
          <Navigator shipment={selected} />
          {shipments
            .filter(shipment => shipment.status?.toLowerCase() !== "completed" && shipment.status?.toLowerCase() !== "delivered")
            .map(shipment => (
            <ShipmentLayer
              key={shipment.id}
              shipment={shipment}
              selectedId={selectedId}
              statusColor={statusColor(shipment.status)}
              threats={threatAssessments[shipment.id]?.threats ?? []}
            />
          ))}
        </MapContainer>
      </div>

      {/* ── Windy iframe ── */}
      <div style={{ position: "relative", flex: 1, minHeight: 660, display: viewMode === "weather" ? "flex" : "none", flexDirection: "column", background: '#e5e7eb' }}>
        {viewMode === "weather" && (
          <iframe 
            style={{ flex: 1, width: "100%", border: "none" }}
            src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=${Math.min(11, mapState.zoom)}&overlay=wind&product=ecmwf&level=surface&lat=${mapState.lat}&lon=${mapState.lng}&detailLat=${mapState.lat}&detailLon=${mapState.lng}&marker=true`} 
            title="Windy Weather Map"
          ></iframe>
        )}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '6px 12px', borderRadius: 6, fontSize: 12, pointerEvents: 'none', zIndex: 20 }}>
          Interactive Weather & Ocean Currents Mode
        </div>
      </div>
    </div>
  );
}
