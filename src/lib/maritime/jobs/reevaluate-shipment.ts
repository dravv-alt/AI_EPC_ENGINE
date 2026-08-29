/**
 * ============================================================================
 * SHIPMENT RE-EVALUATION MANAGER & IDEMPOTENT SCHEDULER
 * ============================================================================
 * Manages periodic re-evaluation cycles, deduplicates scheduler keys per shipment,
 * skips terminal states (delivered/cancelled), records immutable audit snapshots,
 * and publishes delta alerts.
 */

import { DecomposedWaypoint } from "../route-decomposition";
import { resolveRouteDelay, ResolvedRouteAssessment } from "../route-delay-orchestrator";
import { fetchWeatherSeriesCached } from "../weather-cache";
import { recordDelayCalculation } from "./audit-log";
import { evaluateDeltaAndAlert, MilestoneAlertEvent } from "./delta-alerting";
import { VesselProfile } from "../vessel-profiles";

export interface ShipmentReevalContext {
  shipmentId: string;
  routeId: string;
  vessel: VesselProfile;
  plannedSpeedKnots: number;
  isLaden: boolean;
  departureTime: Date;
  status: string;
  waypoints: DecomposedWaypoint[];
  lastAssessment?: ResolvedRouteAssessment | null;
}

export interface ReevalExecutionResult {
  shipmentId: string;
  skipped: boolean;
  skipReason?: string;
  auditRecordId?: string;
  alertEvent?: MilestoneAlertEvent | null;
  assessment?: ResolvedRouteAssessment;
  evaluatedAt: string;
}

// Active scheduler registry for deduplicating repeaters
const activeReevalTimers = new Map<string, NodeJS.Timeout>();
const latestAssessments = new Map<string, ResolvedRouteAssessment>();

/**
 * Runs a single full re-evaluation cycle for a shipment.
 */
export async function executeShipmentReeval(
  context: ShipmentReevalContext,
  triggeredBy: "scheduled_reeval" | "manual_refresh" | "shipment_created" | "ais_realtime" = "scheduled_reeval"
): Promise<ReevalExecutionResult> {
  const { shipmentId, status, waypoints, vessel, plannedSpeedKnots, isLaden, departureTime } = context;

  // 1. Guard against terminal states
  if (status === "delivered" || status === "cancelled") {
    stopRecurringReeval(shipmentId);
    return {
      shipmentId,
      skipped: true,
      skipReason: `Shipment is in terminal state (${status})`,
      evaluatedAt: new Date().toISOString(),
    };
  }

  if (!waypoints.length) {
    return {
      shipmentId,
      skipped: true,
      skipReason: "No waypoints provided for route evaluation",
      evaluatedAt: new Date().toISOString(),
    };
  }

  // 2. Execute Sequential Two-Pass Weather Resolution
  const newAssessment = await resolveRouteDelay(
    waypoints,
    vessel,
    plannedSpeedKnots,
    isLaden,
    departureTime,
    fetchWeatherSeriesCached
  );

  // 3. Record Immutable Calculation Audit Log
  const auditRecordId = await recordDelayCalculation(shipmentId, newAssessment, {
    triggeredBy,
    isLaden,
  });

  // 4. Retrieve Previous Assessment & Evaluate Delta Alert
  const previousAssessment = context.lastAssessment ?? latestAssessments.get(shipmentId) ?? null;
  const alertEvent = evaluateDeltaAndAlert(shipmentId, previousAssessment, newAssessment, auditRecordId);

  // Cache latest assessment
  latestAssessments.set(shipmentId, newAssessment);

  return {
    shipmentId,
    skipped: false,
    auditRecordId,
    alertEvent,
    assessment: newAssessment,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Idempotently schedules recurring re-evaluation for an active shipment (e.g. every 6 hours).
 */
export function scheduleRecurringReeval(
  context: ShipmentReevalContext,
  intervalMs: number = 6 * 60 * 60 * 1000 // 6 Hours
): void {
  const { shipmentId } = context;
  
  // Clear any existing timer to prevent duplicates (Idempotent)
  stopRecurringReeval(shipmentId);

  const timer = setInterval(async () => {
    try {
      await executeShipmentReeval(context, "scheduled_reeval");
    } catch (err) {
      console.error(`Error in scheduled re-evaluation for shipment ${shipmentId}:`, err);
    }
  }, intervalMs);

  activeReevalTimers.set(shipmentId, timer);
}

/**
 * Stops recurring re-evaluation for a shipment.
 */
export function stopRecurringReeval(shipmentId: string): boolean {
  const existingTimer = activeReevalTimers.get(shipmentId);
  if (existingTimer) {
    clearInterval(existingTimer);
    activeReevalTimers.delete(shipmentId);
    return true;
  }
  return false;
}

export function getActiveReevalCount(): number {
  return activeReevalTimers.size;
}
