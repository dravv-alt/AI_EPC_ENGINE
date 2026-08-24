/**
 * OWNED BY: A2-6 (Slice 6) — renders entropy.score output. ADVISORY ONLY, never present as readiness — label it as such.
 * Placeholder until that agent replaces this body with a real component. Keep the
 * prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Real shape confirmed against `computeEvidenceEntropy`
 * (src/lib/evidence/entropy.ts): EvidenceEntropyResult =
 *   { projectId, computedAt, total, maxPossible, signals: EntropySignal[] }
 * where each signal is either
 *   { mode: "computed", severity: 0..1, contribution: points, reason, key, label }
 * or
 *   { mode: "unavailable", severity: null, contribution: null, reason, key, label }.
 *
 * ChatbotHarnessPlan.md §0 rule 2 / Slice 6 instruction 4: this score is
 * ADVISORY ONLY and must never be presented as a readiness state. It gets its
 * own distinct "Advisory" pill (StatusPill tone "information", the same tone
 * used for the app's non-readiness "advisory"/"processing" statuses) rather
 * than the ready/review/blocked tones gateReadinessTable uses, plus an
 * explicit caption saying so.
 */
import type { CSSProperties } from "react";
import { StatusPill } from "@/components/ui/status-pill";

interface EntropySignal {
  key: string;
  label: string;
  mode: "computed" | "unavailable";
  severity: number | null;
  contribution: number | null;
  reason: string;
}

interface EntropyScoreData {
  projectId?: string;
  computedAt?: string;
  total: number;
  maxPossible: number;
  signals: EntropySignal[];
}

function isEntropyShape(data: unknown): data is EntropyScoreData {
  return !!data && typeof data === "object" && typeof (data as { total?: unknown }).total === "number" && Array.isArray((data as { signals?: unknown }).signals);
}

const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };

export function EntropyPanel({ data }: { data: unknown }) {
  if (!isEntropyShape(data)) {
    return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No evidence-entropy data available.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusPill status="Advisory" tone="information" />
        <strong style={{ color: "var(--ink)", fontFamily: "var(--mono)" }}>{data.total} / {data.maxPossible} pts</strong>
      </div>
      <p style={{ margin: 0, ...labelStyle }}>
        Advisory evidence-entropy score — flags structurally weak evidence. This is NOT a readiness signal and does not affect gate approval.
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {data.signals.map((signal) => (
          <li key={signal.key} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{signal.label}</span>
              {signal.mode === "computed" ? (
                <span style={labelStyle}>+{signal.contribution} pts</span>
              ) : (
                <span style={labelStyle}>not available</span>
              )}
            </div>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11 }}>{signal.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
