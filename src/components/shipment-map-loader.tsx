"use client";

import dynamic from "next/dynamic";
import type { MapShipment, RouteThreatAssessment } from "@/components/shipment-map";

const ShipmentMap = dynamic(() => import("@/components/shipment-map"), {
  ssr: false,
  loading: () => <div className="shipment-map map-loading">Loading map…</div>,
});

export function ShipmentMapLoader(props: {
  shipments: MapShipment[];
  selectedId?: string;
  threatAssessments?: Record<string, RouteThreatAssessment>;
  onAssessmentChange?: (shipmentId: string, assessment: RouteThreatAssessment) => void;
}) {
  return <ShipmentMap {...props} />;
}

