import React from "react";

export type StatusTone =
  | "positive"
  | "attention"
  | "danger"
  | "neutral"
  | "information";

export type StatusPillProps = {
  status: string;
  tone?: StatusTone;
  compact?: boolean;
  className?: string;
};

// Automatic tone mapping based on current application values
function getToneForStatus(status: string): StatusTone {
  const s = status.toLowerCase().replace(/_/g, " ");
  
  if (["accepted", "approved", "completed", "resolved", "cleared", "ready", "optimal"].includes(s)) {
    return "positive";
  }
  if (["pending", "proposed", "in review", "waiting", "amber"].includes(s)) {
    return "attention";
  }
  if (["blocked", "failed", "critical", "overdue", "red"].includes(s)) {
    return "danger";
  }
  if (["active", "advisory", "processing", "high", "medium", "low"].includes(s)) {
    return "information";
  }
  
  // draft, not started, unavailable, unknown
  return "neutral";
}

export function StatusPill({ status, tone, compact, className = "" }: StatusPillProps) {
  const resolvedTone = tone || getToneForStatus(status);
  
  // Use existing styling tokens where possible, or define them in globals.css
  return (
    <span 
      className={`status-pill status-${resolvedTone} ${compact ? "compact" : ""} ${className}`}
      data-status={status}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{status.replace(/_/g, " ")}</span>
    </span>
  );
}
