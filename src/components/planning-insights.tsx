"use client";

import { useEffect, useState } from "react";
import { BarChart3, Bot, CircleAlert, Sparkles } from "lucide-react";

type Warning = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  stepId: string;
};
type Action = { title: string; detail: string; stepId: string };
type Metrics = Record<string, number | null>;
type Snapshot = {
  id: string;
  version: number;
  createdAt: string;
  metrics: Metrics;
  warnings: Warning[];
  recommendations: Action[];
  aiSummary: {
    executiveSummary: string;
    decisions: string[];
    caveat: string;
  } | null;
};

const number = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined
    ? "—"
    : `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}${suffix}`;

export function PlanningInsights({
  projectId,
  onOpenStep,
}: {
  projectId: string;
  onOpenStep: (stepId: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState(
    "Generate the first planning interpretation from the saved inputs.",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/projects/${projectId}/site-analysis/insights`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        const latest = body?.snapshots?.[0] as Snapshot | undefined;
        if (latest) {
          setSnapshot(latest);
          setMessage(`Showing saved interpretation v${latest.version}.`);
        }
      })
      .catch(() => undefined);
  }, [projectId]);

  async function generate() {
    setBusy(true);
    setMessage("Running deterministic checks and Gemma advisory summary…");
    try {
      const response = await fetch(
        `/api/projects/${projectId}/site-analysis/insights`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ includeAi: true }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.error ?? "Planning insights could not be generated.",
        );
      setSnapshot(body.snapshot);
      setMessage(
        body.reused
          ? `Inputs have not changed; showing v${body.snapshot.version}.`
          : `Saved planning interpretation v${body.snapshot.version}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Planning insights could not be generated.",
      );
    } finally {
      setBusy(false);
    }
  }

  const metrics = snapshot?.metrics;
  const capacityWidth =
    metrics?.facilityMw && metrics.utilityMw
      ? Math.min(
          100,
          Math.max(
            0,
            (metrics.facilityMw / Math.max(metrics.utilityMw, 0.1)) * 100,
          ),
        )
      : 0;
  const liquidWidth = metrics?.liquidSharePct ?? 0;
  return (
    <section
      className="surface planning-insights"
      aria-label="Planning Insights"
    >
      <header>
        <div>
          <p className="eyebrow">Planning Insights · saved, explainable</p>
          <h2>
            <BarChart3 size={20} /> Site feasibility and decisions
          </h2>
          <p>
            Transparent checks run before the AI summary. Nothing here certifies
            equipment, utility capacity, vendor performance, or design approval.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={generate}
          disabled={busy}
        >
          <Sparkles size={16} />
          {busy ? "Generating…" : "Generate insights"}
        </button>
      </header>
      {!snapshot ? (
        <p className="planning-empty">{message}</p>
      ) : (
        <>
          <p className="planning-status">{message}</p>
          <div className="planning-metrics">
            <Metric
              label="Target IT load"
              value={number(metrics?.targetItMw, " MW")}
            />
            <Metric
              label="Facility demand"
              value={number(metrics?.facilityMw, " MW")}
            />
            <Metric
              label="Utility headroom"
              value={number(metrics?.utilityHeadroomMw, " MW")}
            />
            <Metric label="PUE basis" value={number(metrics?.pue)} />
            <Metric
              label="Liquid heat"
              value={number(metrics?.liquidHeatMw, " MW")}
            />
            <Metric
              label="Evidence coverage"
              value={number(metrics?.evidenceCoveragePct, "%")}
            />
          </div>
          <div className="planning-charts">
            <section>
              <h3>Capacity and power flow</h3>
              <p>
                Indicative IT load × PUE compared with saved utility capacity.
              </p>
              <div className="planning-bar">
                <span style={{ width: `${capacityWidth}%` }} />
              </div>
              <dl>
                <div>
                  <dt>Facility demand</dt>
                  <dd>{number(metrics?.facilityMw, " MW")}</dd>
                </div>
                <div>
                  <dt>Utility capacity</dt>
                  <dd>{number(metrics?.utilityMw, " MW")}</dd>
                </div>
              </dl>
            </section>
            <section>
              <h3>Cooling and thermal basis</h3>
              <p>Liquid heat share and saved technology-loop delta-T.</p>
              <div className="planning-bar cooling">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, liquidWidth))}%`,
                  }}
                />
              </div>
              <dl>
                <div>
                  <dt>Liquid heat share</dt>
                  <dd>{number(metrics?.liquidSharePct, "%")}</dd>
                </div>
                <div>
                  <dt>Loop delta-T</dt>
                  <dd>{number(metrics?.coolingDeltaTC, " °C")}</dd>
                </div>
              </dl>
            </section>
          </div>
          {snapshot.aiSummary && (
            <section className="planning-ai">
              <Bot size={18} />
              <div>
                <p className="eyebrow">Gemma advisory synthesis</p>
                <h3>{snapshot.aiSummary.executiveSummary}</h3>
                <p>{snapshot.aiSummary.caveat}</p>
              </div>
            </section>
          )}
          <div className="planning-details">
            <section>
              <h3>
                <CircleAlert size={16} /> Constraints and open decisions
              </h3>
              {snapshot.warnings.length ? (
                <ul>
                  {snapshot.warnings.map((warning) => (
                    <li key={warning.id} className={`is-${warning.severity}`}>
                      <button
                        type="button"
                        onClick={() => onOpenStep(warning.stepId)}
                      >
                        <b>{warning.title}</b>
                        <span>{warning.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No deterministic conflicts were found in the saved values.
                </p>
              )}
            </section>
            <section>
              <h3>Recommended next actions</h3>
              <ul>
                {snapshot.recommendations.map((action) => (
                  <li key={`${action.stepId}-${action.title}`}>
                    <button
                      type="button"
                      onClick={() => onOpenStep(action.stepId)}
                    >
                      <b>{action.title}</b>
                      <span>{action.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
