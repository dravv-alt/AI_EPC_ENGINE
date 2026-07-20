"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";

export type MapShipment = { id: string; name: string; status: string; transportMode?: "sea" | "air" | "land"; originName: string | null; originLat: string | null; originLng: string | null; destinationName: string | null; destinationLat: string | null; destinationLng: string | null; currentLat: string | null; currentLng: string | null; positionSource: string; weatherAdjustedEta: Date | string | null; plannedEta: Date | string };
type RouteSegment = { mode: "sea" | "air" | "land"; coords: [number, number][] };

const validCoordinates = (shipment?: MapShipment) => Boolean(shipment?.originLat && shipment.originLng && shipment.destinationLat && shipment.destinationLng && [shipment.originLat, shipment.originLng, shipment.destinationLat, shipment.destinationLng].every((value) => Number.isFinite(Number(value))));
const color = (status: string) => status === "red" ? "#be1e2d" : status === "amber" ? "#b5651d" : "#2d6b55";

function Navigator({ shipment, route }: { shipment?: MapShipment; route: RouteSegment[] }) {
  const map = useMap();
  useEffect(() => {
    const points = route.flatMap((segment) => segment.coords).map(([lat, lng]) => [lat, lng] as LatLngExpression);
    if (points.length > 1) map.fitBounds(latLngBounds(points), { padding: [42, 42], maxZoom: 8 });
    else if (shipment?.currentLat && shipment.currentLng) map.flyTo([Number(shipment.currentLat), Number(shipment.currentLng)], 6, { animate: true });
  }, [map, route, shipment]);
  return null;
}

export default function ShipmentMap({ shipments, selectedId }: { shipments: MapShipment[]; selectedId?: string }) {
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? shipments[0];
  const [route, setRoute] = useState<RouteSegment[]>([]);
  const [routeMessage, setRouteMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!selected) { setRoute([]); setRouteMessage("Register a shipment to view a route."); return; }
    if (!validCoordinates(selected)) { setRoute([]); setRouteMessage("Route unavailable: this shipment has no saved origin and destination coordinates."); return; }
    setRoute([]); setRouteMessage("Calculating the verified route…");
    fetch(`/api/shipments/${selected.id}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok || !body.routeAvailable) { setRoute([]); setRouteMessage(body.reason ?? "A verified route is unavailable for this shipment."); return; }
      setRoute(body.route); setRouteMessage("");
    }).catch(() => { if (!cancelled) { setRoute([]); setRouteMessage("Route service is unavailable. No fallback line is shown."); } });
    return () => { cancelled = true; };
  }, [selected?.id]);
  const center = useMemo<LatLngExpression>(() => selected?.currentLat && selected.currentLng ? [Number(selected.currentLat), Number(selected.currentLng)] : validCoordinates(selected) ? [Number(selected!.originLat), Number(selected!.originLng)] : [20.5937, 78.9629], [selected]);
  const current = selected?.currentLat && selected.currentLng ? [Number(selected.currentLat), Number(selected.currentLng)] as LatLngExpression : null;
  const origin = validCoordinates(selected) ? [Number(selected!.originLat), Number(selected!.originLng)] as LatLngExpression : null;
  const destination = validCoordinates(selected) ? [Number(selected!.destinationLat), Number(selected!.destinationLng)] as LatLngExpression : null;
  return <div className="shipment-map-frame"><MapContainer className="shipment-map" center={center} zoom={5} scrollWheelZoom><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Navigator shipment={selected} route={route} />{route.map((segment, index) => <Polyline positions={segment.coords} pathOptions={{ color: color(selected?.status ?? "green"), weight: 5, opacity: .9, className: "shipment-route" }} key={`${selected?.id}-${segment.mode}-${index}`} />)}{origin && <CircleMarker center={origin} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}><Popup><b>Origin</b><br />{selected?.originName}</Popup></CircleMarker>}{destination && <CircleMarker center={destination} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }}><Popup><b>Destination</b><br />{selected?.destinationName}</Popup></CircleMarker>}{current && <CircleMarker center={current} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: color(selected?.status ?? "green"), fillOpacity: 1, className: "shipment-position-marker" }}><Popup><b>{selected?.name}</b><br />{selected?.positionSource === "aisstream" ? "Live AIS position" : "Simulated position"}</Popup></CircleMarker>}</MapContainer>{routeMessage && <div className="map-route-notice" role="status">{routeMessage}</div>}</div>;
}
