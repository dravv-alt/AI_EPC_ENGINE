"use client";

import { useEffect, useMemo } from "react";
import { greatCircle } from "@turf/great-circle";
import { point } from "@turf/helpers";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";

export type MapShipment = { id: string; name: string; status: string; originName: string | null; originLat: string | null; originLng: string | null; destinationName: string | null; destinationLat: string | null; destinationLng: string | null; currentLat: string | null; currentLng: string | null; positionSource: string; weatherAdjustedEta: Date | string | null; plannedEta: Date | string };

function routeSegments(shipment: MapShipment): LatLngExpression[][] {
  if (!shipment.originLat || !shipment.originLng || !shipment.destinationLat || !shipment.destinationLng) return [];
  const feature = greatCircle(point([Number(shipment.originLng), Number(shipment.originLat)]), point([Number(shipment.destinationLng), Number(shipment.destinationLat)]), { npoints: 100, offset: 10 });
  const coordinates = feature.geometry.type === "MultiLineString" ? feature.geometry.coordinates : [feature.geometry.coordinates];
  return coordinates.map((segment) => segment.map(([lng, lat]) => [lat, lng] as LatLngExpression));
}

function Navigator({ shipment }: { shipment?: MapShipment }) {
  const map = useMap();
  useEffect(() => {
    if (!shipment) return;
    const points = routeSegments(shipment).flat();
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [35, 35], maxZoom: 8 });
  }, [map, shipment]);
  return null;
}

export default function ShipmentMap({ shipments, selectedId }: { shipments: MapShipment[]; selectedId?: string }) {
  const selected = shipments.find((shipment) => shipment.id === selectedId) ?? shipments[0];
  const center = useMemo<LatLngExpression>(() => selected?.currentLat && selected.currentLng ? [Number(selected.currentLat), Number(selected.currentLng)] : [19.076, 72.8777], [selected]);
  const color = (status: string) => status === "red" ? "#be1e2d" : status === "amber" ? "#b5651d" : "#2d6b55";
  return <MapContainer className="shipment-map" center={center} zoom={5} scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Navigator shipment={selected} />
    {shipments.map((shipment) => {
      const routes = routeSegments(shipment); const current = shipment.currentLat && shipment.currentLng ? [Number(shipment.currentLat), Number(shipment.currentLng)] as LatLngExpression : null;
      return <span key={shipment.id}>{routes.map((segment, index) => <Polyline positions={segment} pathOptions={{ color: color(shipment.status), weight: selected?.id === shipment.id ? 4 : 2, opacity: selected?.id === shipment.id ? .9 : .4 }} key={`${shipment.id}-${index}`} />)}{current && <CircleMarker center={current} radius={selected?.id === shipment.id ? 9 : 6} pathOptions={{ color: "#fff", weight: 2, fillColor: color(shipment.status), fillOpacity: 1 }}><Popup><b>{shipment.name}</b><br />{shipment.positionSource === "live" ? "Live AIS position" : "Simulated position"}<br />ETA estimate: {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(shipment.weatherAdjustedEta ?? shipment.plannedEta))}</Popup></CircleMarker>}</span>;
    })}
  </MapContainer>;
}
