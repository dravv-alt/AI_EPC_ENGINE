/**
 * ============================================================================
 * DELTA-BASED EPC MILESTONE ALERTING ENGINE
 * ============================================================================
 * Evaluates forecast variance between consecutive model cycles to prevent 
 * notification fatigue from minor forecast wobble.
 * 
 * Dynamic Threshold:
 * Alert Threshold = max(2.0 hrs, TotalPlannedHours * 0.05)
 * (Sensitive to short coastal feeder runs, stable against 25-day Pacific transits).
 */

import { ResolvedRouteAssessment } from "../route-delay-orchestrator";

export interface DelaySummarySnapshot {
  totalDelayHours: number;
  totalPlannedHours: number;
  finalEtaMs: number;
  worstSeverity: "clear" | "warning" | "critical";
  activeThreatCount: number;
}

export interface MilestoneAlertEvent {
  eventId: string;
  shipmentId: string;
  type: "initial_estimate" | "delay_escalation" | "delay_cleared" | "delay_variance";
  previousDelayHours?: number;
  currentDelayHours: number;
  deltaHours: number;
  thresholdHours: number;
  severityEscalated: boolean;
  auditRecordId: string;
  timestamp: string;
  summary: string;
}

/**
 * Summarizes assessment for threshold comparison.
 */
export function summarizeAssessment(assessment: ResolvedRouteAssessment): DelaySummarySnapshot {
  let worstSeverity: "clear" | "warning" | "critical" = "clear";
  for (const leg of assessment.legs) {
    if (leg.primaryCause.severity === "CRITICAL" || leg.delayHours >= 12) {
      worstSeverity = "critical";
      break;
    }
    if (leg.primaryCause.severity === "WARNING" || leg.delayHours >= 3) {
      worstSeverity = "warning";
    }
  }

  return {
    totalDelayHours: assessment.totalDelayHours,
    totalPlannedHours: assessment.totalPlannedHours,
    finalEtaMs: assessment.finalEta.getTime(),
    worstSeverity,
    activeThreatCount: assessment.activeThreatCount,
  };
}

/**
 * Evaluates delta between previous and current calculations, returning an alert event if warranted.
 */
export function evaluateDeltaAndAlert(
  shipmentId: string,
  previous: ResolvedRouteAssessment | null,
  current: ResolvedRouteAssessment,
  auditRecordId: string
): MilestoneAlertEvent | null {
  const currSummary = summarizeAssessment(current);

  // Initial Calculation (First Evaluation)
  if (!previous) {
    return {
      eventId: `alert_init_${Date.now()}`,
      shipmentId,
      type: "initial_estimate",
      currentDelayHours: currSummary.totalDelayHours,
      deltaHours: 0,
      thresholdHours: 2.0,
      severityEscalated: currSummary.worstSeverity !== "clear",
      auditRecordId,
      timestamp: new Date().toISOString(),
      summary: `Initial route passage evaluated: +${currSummary.totalDelayHours.toFixed(1)}h projected delay (${currSummary.worstSeverity.toUpperCase()})`,
    };
  }

  const prevSummary = summarizeAssessment(previous);
  const deltaHours = Math.abs(currSummary.totalDelayHours - prevSummary.totalDelayHours);
  
  // Proportional Threshold: 5% of voyage duration or 2.0 hours minimum
  const thresholdHours = Number(
    Math.max(2.0, currSummary.totalPlannedHours * 0.05).toFixed(1)
  );

  const severityEscalated =
    (prevSummary.worstSeverity === "clear" && currSummary.worstSeverity !== "clear") ||
    (prevSummary.worstSeverity === "warning" && currSummary.worstSeverity === "critical");

  const delayCleared =
    prevSummary.totalDelayHours >= 4.0 && currSummary.totalDelayHours < 1.0;

  // Fire alert if threshold exceeded, severity escalated, or delay cleared
  if (delayCleared) {
    return {
      eventId: `alert_recov_${Date.now()}`,
      shipmentId,
      type: "delay_cleared",
      previousDelayHours: prevSummary.totalDelayHours,
      currentDelayHours: currSummary.totalDelayHours,
      deltaHours,
      thresholdHours,
      severityEscalated: false,
      auditRecordId,
      timestamp: new Date().toISOString(),
      summary: `Route weather cleared: Projected delay recovered from +${prevSummary.totalDelayHours.toFixed(1)}h to +${currSummary.totalDelayHours.toFixed(1)}h (On Schedule)`,
    };
  }

  if (severityEscalated || deltaHours >= thresholdHours) {
    return {
      eventId: `alert_var_${Date.now()}`,
      shipmentId,
      type: severityEscalated ? "delay_escalation" : "delay_variance",
      previousDelayHours: prevSummary.totalDelayHours,
      currentDelayHours: currSummary.totalDelayHours,
      deltaHours: Number(deltaHours.toFixed(1)),
      thresholdHours,
      severityEscalated,
      auditRecordId,
      timestamp: new Date().toISOString(),
      summary: severityEscalated
        ? `⚠️ Delay Escalation: Route conditions deteriorated to ${currSummary.worstSeverity.toUpperCase()} (+${currSummary.totalDelayHours.toFixed(1)}h total delay)`
        : `Route delay variance (+${deltaHours.toFixed(1)}h delta exceeds ${thresholdHours}h threshold): ETA shifted to ${current.finalEta.toISOString()}`,
    };
  }

  return null;
}
