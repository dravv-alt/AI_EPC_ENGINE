"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import type { MapShipment, RouteThreatAssessment } from "@/components/shipment-map";

const ShipmentMap = dynamic(() => import("@/components/shipment-map"), {
  ssr: false,
  loading: () => <div className="shipment-map map-loading" aria-hidden="true" />,
});
export function ShipmentMapLoader(props: { shipments: MapShipment[]; selectedId?: string; threatAssessments?: Record<string, RouteThreatAssessment> }) { return <ShipmentMap {...props} />; }
