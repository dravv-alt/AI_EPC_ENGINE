/**
 * ============================================================================
 * MARITIME DELAY CALCULATION AUDIT LOG
 * ============================================================================
 * Immutable calculation audit records storing full meteorological snapshots,
 * hydrodynamic parameters, and causal taxonomies for full post-hoc reconstructibility
 * and ML training extraction.
 */

import { randomUUID } from "node:crypto";
import { ResolvedRouteAssessment } from "../route-delay-orchestrator";
import { LegDelayResult, WeatherInputSnapshot } from "../delay-integrator";

export const MARITIME_FORMULA_VERSION = "kwon-2008-structured-v1";

export interface AuditLegRecord {
  waypointIndex: number;
  lat: number;
  lng: number;
  legDistanceNm: number;
  plannedSpeedKnots: number;
  effectiveSpeedKnots: number;
  delayHours: number;
  cumulativeDelayHours: number;
  inputSnapshot: WeatherInputSnapshot;
  beaufortForce: number;
  seaCondition: string;
  relativeWindAngleDeg: number;
  relativeWaveAngleDeg: number;
  percentSpeedLoss: number;
  colregsSpeedFactor: number;
  causeCode: string;
  causeName: string;
  etaAtWaypoint: string;
  summary: string;
}

export interface MaritimeDelayAuditRecord {
  id: string;
  shipmentId: string;
  formulaVersion: string;
  triggeredBy: "scheduled_reeval" | "manual_refresh" | "shipment_created" | "ais_realtime";
  jobId?: string;
  calculatedAt: string;
  vesselClass: string;
  plannedSpeedKnots: number;
  isLaden: boolean;
  totalDistanceNm: number;
  totalPlannedHours: number;
  totalActualHours: number;
  totalDelayHours: number;
  initialDepartureTime: string;
  finalEta: string;
  activeThreatCount: number;
  legs: AuditLegRecord[];
  dataProvenance: {
    source: string;
    forecastHorizonHours: number;
    hasClimatologicalFallback: boolean;
  };
}

// In-memory persistent audit store (can be connected to SQLite / Postgres table)
const auditLogStore = new Map<string, MaritimeDelayAuditRecord>();
const shipmentAuditIndex = new Map<string, string[]>(); // shipmentId -> auditRecordIds[]

/**
 * Records a full immutable calculation audit snapshot.
 */
export async function recordDelayCalculation(
  shipmentId: string,
  assessment: ResolvedRouteAssessment,
  meta: {
    triggeredBy: MaritimeDelayAuditRecord["triggeredBy"];
    jobId?: string;
    isLaden?: boolean;
  }
): Promise<string> {
  const auditId = `audit_${randomUUID()}`;
  const record: MaritimeDelayAuditRecord = {
    id: auditId,
    shipmentId,
    formulaVersion: MARITIME_FORMULA_VERSION,
    triggeredBy: meta.triggeredBy,
    jobId: meta.jobId,
    calculatedAt: new Date().toISOString(),
    vesselClass: assessment.vessel.id,
    plannedSpeedKnots: assessment.legs[0]?.plannedSpeedKnots || assessment.vessel.serviceSpeedKnots,
    isLaden: meta.isLaden ?? true,
    totalDistanceNm: assessment.totalDistanceNm,
    totalPlannedHours: assessment.totalPlannedHours,
    totalActualHours: assessment.totalActualHours,
    totalDelayHours: assessment.totalDelayHours,
    initialDepartureTime: assessment.initialDepartureTime.toISOString(),
    finalEta: assessment.finalEta.toISOString(),
    activeThreatCount: assessment.activeThreatCount,
    dataProvenance: assessment.dataProvenance,
    legs: assessment.legs.map((leg) => ({
      waypointIndex: leg.waypointIndex,
      lat: leg.lat,
      lng: leg.lng,
      legDistanceNm: leg.legDistanceNm,
      plannedSpeedKnots: leg.plannedSpeedKnots,
      effectiveSpeedKnots: leg.effectiveSpeedKnots,
      delayHours: leg.delayHours,
      cumulativeDelayHours: leg.cumulativeDelayHours,
      inputSnapshot: leg.inputSnapshot,
      beaufortForce: leg.beaufortForce,
      seaCondition: leg.seaCondition,
      relativeWindAngleDeg: leg.relativeWindAngleDeg,
      relativeWaveAngleDeg: leg.relativeWaveAngleDeg,
      percentSpeedLoss: leg.speedLoss.percentSpeedLoss,
      colregsSpeedFactor: leg.colregsSpeedFactor,
      causeCode: leg.primaryCause.code,
      causeName: leg.primaryCause.name,
      etaAtWaypoint: leg.etaAtWaypoint.toISOString(),
      summary: leg.summary,
    })),
  };

  auditLogStore.set(auditId, record);
  const existingList = shipmentAuditIndex.get(shipmentId) || [];
  existingList.push(auditId);
  shipmentAuditIndex.set(shipmentId, existingList);

  return auditId;
}

/**
 * Retrieves audit records for a given shipment.
 */
export function getShipmentAuditHistory(shipmentId: string): MaritimeDelayAuditRecord[] {
  const ids = shipmentAuditIndex.get(shipmentId) || [];
  return ids.map((id) => auditLogStore.get(id)!).filter(Boolean);
}

/**
 * Retrieves a specific audit record by ID.
 */
export function getAuditRecordById(auditId: string): MaritimeDelayAuditRecord | null {
  return auditLogStore.get(auditId) || null;
}
