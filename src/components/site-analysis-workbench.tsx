"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Droplets,
  FileUp,
  MapPin,
  Save,
  Sparkles,
  Zap,
} from "lucide-react";
import { PlanningInsights } from "@/components/planning-insights";
import {
  coolingEquipmentGroups,
  coolingStatePointFields,
  siteBaselineOptions,
  siteSections,
  type SiteAnswerMap,
} from "@/lib/site-analysis/questions";

type Persisted = {
  answers: SiteAnswerMap;
  completedSections: string[];
  sourceMetadata?: {
    csvFileName?: string;
    importedRows?: number;
    importedAt?: string;
  };
  status: string;
} | null;
type CoolingAnalysis = {
  analysis: {
    summary: string;
    observations: string[];
    evidenceGaps: string[];
    recommendedActions: string[];
    confidence: "low" | "medium" | "high";
  };
  metrics: Record<string, unknown>;
  model: string;
  provider: string;
  generatedAt: string;
  advisory: boolean;
};
type Handoff = {
  documentId: string;
  systemCount: number;
  assetCount: number;
  checklistCount: number;
  taskCount: number;
};
const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export function SiteAnalysisWorkbench({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Persisted;
}) {
  const [answers, setAnswers] = useState<SiteAnswerMap>(initial?.answers ?? {});
  const [completed, setCompleted] = useState<string[]>(
    initial?.completedSections ?? [],
  );
  const [sectionId, setSectionId] = useState(
    initial?.status === "finalized" ? "review" : "project",
  );
  const [sourceMetadata, setSourceMetadata] = useState(
    initial?.sourceMetadata ?? {},
  );
  const [message, setMessage] = useState(
    initial
      ? "Saved planning inputs loaded."
      : "No saved Site Analysis exists yet. Enter supported values or explicitly choose a planning baseline.",
  );
  const [busy, setBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [baselineId, setBaselineId] = useState<string>("");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [showManagerSummary, setShowManagerSummary] = useState(
    initial?.status === "finalized",
  );
  const [coolingAnalysis, setCoolingAnalysis] =
    useState<CoolingAnalysis | null>(null);
  const section =
    siteSections.find((item) => item.id === sectionId) ?? siteSections[0];
  const resolved = useMemo(
    () =>
      siteSections
        .filter((item) =>
          item.questions.every((question) =>
            Boolean(answers[question.key]?.trim()),
          ),
        )
        .map((item) => item.id),
    [answers],
  );

  // Finalize is a separate request from the status save, so a failure there
  // would otherwise leave the row persisted as "review" with nothing
  // materialized and no way to retry from the UI. Put the stored status back
  // to draft so the record matches what actually happened.
  async function revertStatusToDraft(nextCompleted: string[], nextAnswers: SiteAnswerMap = answers) {
    await fetch(`/api/projects/${projectId}/site-analysis`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers: nextAnswers,
        completedSections: nextCompleted,
        sourceMetadata,
        status: "draft",
      }),
    }).catch(() => undefined);
  }

  async function save(
    nextStatus: "draft" | "review" = "draft",
    additionalCompleted: string[] = [],
  ) {
    if (nextStatus === "review") {
      const missing = siteSections.flatMap((item) =>
        item.questions
          .filter((question) => question.required && !answers[question.key]?.trim())
          .map((question) => question.label),
      );
      if (missing.length) {
        setMessage(`Complete the required decisions first: ${missing.join(", ")}.`);
        return;
      }
    }
    const nextCompleted = [
      ...new Set([
        ...completed.filter((id) => resolved.includes(id)),
        ...resolved,
        ...additionalCompleted.filter((id) => resolved.includes(id)),
      ]),
    ];
    setBusy(true);
    setMessage("Saving project-scoped site analysis…");
    try {
      const response = await fetch(`/api/projects/${projectId}/site-analysis`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers,
          completedSections: nextCompleted,
          sourceMetadata,
          status: nextStatus,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Could not save site analysis.");
      setCompleted(body.analysis.completedSections ?? nextCompleted);
      const insightResponse = await fetch(
        `/api/projects/${projectId}/site-analysis/insights`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ includeAi: true }),
        },
      );
      if (insightResponse.ok)
        window.dispatchEvent(new CustomEvent("site-analysis-insights-updated"));
      if (nextStatus === "review") {
        const finalResponse = await fetch(
          `/api/projects/${projectId}/site-analysis/finalize`,
          { method: "POST" },
        );
        const finalBody = await finalResponse.json().catch(() => ({}));
        if (!finalResponse.ok) {
          await revertStatusToDraft(nextCompleted);
          throw new Error(finalBody.error ?? "Site Analysis could not be finalized. The analysis was left as a draft; retry once the reported problem is resolved.");
        }
        setHandoff(finalBody.handoff);
        setShowManagerSummary(true);
        setSectionId("review");
        setMessage(
          "Planning basis finalized. Requirements, systems, execution tasks, and advisory commissioning plans were materialized for review.",
        );
      } else {
        setMessage(
          "Section saved. Deterministic issues and the Gemma advisory interpretation were recalculated.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save site analysis.",
      );
    } finally {
      setBusy(false);
    }
  }
  function setAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }
  function loadBaseline(nextId: string) {
    if (!nextId) return;
    const baseline =
      siteBaselineOptions.find((item) => item.id === nextId) ??
      siteBaselineOptions[0];
    setBaselineId(baseline.id);
    setAnswers({ ...baseline.answers });
    setMessage(
      `${baseline.name} planning baseline loaded across every Site Analysis field. Review and save to write it into the project.`,
    );
  }
  async function loadCompleteProjectData() {
    const baseline =
      siteBaselineOptions.find((item) => item.id === baselineId) ??
      siteBaselineOptions[0];
    const baselineAnswers: SiteAnswerMap = { ...baseline.answers };
    const baselineCompleted = siteSections
      .filter((item) =>
        item.questions.every((question) =>
          Boolean(baselineAnswers[question.key]?.trim()),
        ),
      )
      .map((item) => item.id);

    setBusy(true);
    setBaselineId(baseline.id);
    setAnswers(baselineAnswers);
    setMessage(
      `Loading ${baseline.name} across the controlled project records…`,
    );
    try {
      const response = await fetch(`/api/projects/${projectId}/site-analysis`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: baselineAnswers,
          completedSections: baselineCompleted,
          sourceMetadata: {
            importedAt: new Date().toISOString(),
          },
          status: "review",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Could not load the project baseline.");

      setCompleted(body.analysis.completedSections ?? baselineCompleted);
      const insightResponse = await fetch(
        `/api/projects/${projectId}/site-analysis/insights`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ includeAi: true }),
        },
      );
      if (!insightResponse.ok) {
        const insightBody = await insightResponse.json().catch(() => ({}));
        throw new Error(
          insightBody.error ?? "Could not generate planning insights.",
        );
      }
      window.dispatchEvent(new CustomEvent("site-analysis-insights-updated"));

      const finalResponse = await fetch(
        `/api/projects/${projectId}/site-analysis/finalize`,
        { method: "POST" },
      );
      const finalBody = await finalResponse.json().catch(() => ({}));
      if (!finalResponse.ok) {
        // `answers` state is still the pre-baseline value in this closure, so
        // pass the answers that were actually persisted a moment ago.
        await revertStatusToDraft(baselineCompleted, baselineAnswers);
        throw new Error(
          finalBody.error ?? "Could not materialize the project baseline. The analysis was left as a draft; retry once the reported problem is resolved.",
        );
      }

      setHandoff(finalBody.handoff);
      setShowManagerSummary(true);
      setSectionId("review");
      setMessage(
        `${baseline.name} is loaded. Site Analysis, requirements, systems/assets, tasks, and advisory commissioning plans are now stored for review.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load the complete project baseline.",
      );
    } finally {
      setBusy(false);
    }
  }
  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const next = { ...answers };
        for (const row of result.data)
          for (const [header, value] of Object.entries(row)) {
            const key = normalize(header);
            if (key && typeof value === "string" && value.trim())
              next[key] = value.trim();
          }
        setAnswers(next);
        setSourceMetadata({
          csvFileName: file.name,
          importedRows: result.data.length,
          importedAt: new Date().toISOString(),
        });
        setMessage(
          `${result.data.length} CSV row${result.data.length === 1 ? "" : "s"} parsed locally. Review the mapped values, then save.`,
        );
      },
    });
  }

  async function analyzeCooling() {
    setAnalysisBusy(true);
    setMessage("Saving current inputs before advisory cooling analysis…");
    try {
      const saveResponse = await fetch(
        `/api/projects/${projectId}/site-analysis`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answers,
            completedSections: [...new Set([...completed, ...resolved])],
            sourceMetadata,
            status: "draft",
          }),
        },
      );
      const saveBody = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok)
        throw new Error(saveBody.error ?? "Could not save Site Analysis.");
      const response = await fetch(
        `/api/projects/${projectId}/site-analysis/cooling-analysis`,
        { method: "POST" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.error ?? "Cooling analysis could not be generated.",
        );
      setCoolingAnalysis(body as CoolingAnalysis);
      setMessage(
        "Gemma advisory analysis generated from the saved planning inputs and available project evidence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cooling analysis could not be generated.",
      );
    } finally {
      setAnalysisBusy(false);
    }
  }

  return (
    <div className="site-analysis-workbench">
      <section className="surface site-analysis-intro">
        <div>
          <p className="eyebrow">Guided site analysis</p>
          <h2>
            <Sparkles size={20} /> Answer only what you know
          </h2>
          <p>
            Optional sections can be skipped; defaults stay visibly marked as
            planning assumptions. Uploads feed this same project record and
            never start a second wizard.
          </p>
        </div>
        <div className="site-analysis-actions">
          <label className="site-baseline-picker">
            Planning baseline
            <select
              value={baselineId}
              onChange={(event) => loadBaseline(event.target.value)}
            >
              <option value="">Choose a baseline…</option>
              {siteBaselineOptions.map((baseline) => (
                <option key={baseline.id} value={baseline.id}>
                  {baseline.name}
                </option>
              ))}
            </select>
          </label>
          <label className="button button-secondary csv-upload">
            <FileUp size={16} /> Import CSV
            <input type="file" accept=".csv,text/csv" onChange={importCsv} />
          </label>
          <button
            className="button button-secondary"
            type="button"
            onClick={loadCompleteProjectData}
            disabled={busy}
          >
            <Sparkles size={16} /> Load complete project data
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => save("draft")}
            disabled={busy}
          >
            <Save size={16} /> Save analysis
          </button>
        </div>
      </section>
      <section
        className="surface site-analysis-steps"
        aria-label="Numbered site analysis sections"
      >
        {siteSections.map((item, index) => {
          const answered = item.questions.filter((question) =>
            Boolean(answers[question.key]?.trim()),
          ).length;
          const isResolved = resolved.includes(item.id);
          const isCompleted = completed.includes(item.id) && isResolved;
          const stateClass = isCompleted
            ? "is-completed"
            : answered > 0
              ? "is-incomplete"
              : "is-pending";
          return (
            <button
              type="button"
              key={item.id}
              className={`${item.id === section.id ? "is-active" : ""} ${stateClass}`}
              onClick={() => setSectionId(item.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <b>
                  {item.title}{" "}
                  {isCompleted && (
                    <CheckCircle2 size={14} aria-label="Resolved" />
                  )}
                </b>
                <small>{item.description}</small>
              </div>
            </button>
          );
        })}
      </section>
      {showManagerSummary && (
        <ManagerSiteSummary answers={answers} handoff={handoff} />
      )}
      <PlanningInsights projectId={projectId} onOpenStep={setSectionId} />
      <p className="site-analysis-selection" aria-live="polite">
        Showing{" "}
        <b>
          {String(
            siteSections.findIndex((item) => item.id === section.id) + 1,
          ).padStart(2, "0")}{" "}
          · {section.title}
        </b>
        . Use the numbered section map above to open every other planning input.
      </p>
      <section className="surface site-analysis-form">
        <header>
          <div>
            <p className="eyebrow">
              Step{" "}
              {String(
                siteSections.findIndex((item) => item.id === section.id) + 1,
              ).padStart(2, "0")}{" "}
              · {section.title} ·{" "}
              {resolved.includes(section.id) ? "resolved" : "planning inputs"}
            </p>
            <h2>{section.description}</h2>
            <p>
              Defaults are editable assumptions, not engineering approvals or
              vendor-certified values.
            </p>
          </div>
          <span>
            {resolved.length} / {siteSections.length} sections resolved
          </span>
        </header>
        {section.id === "review" && (
          <section className="site-requirement-review">
            <div className="site-review-metrics">
              <div>
                <strong>
                  {
                    Object.values(answers).filter((value) => value?.trim())
                      .length
                  }
                </strong>
                <span>Confirmed inputs</span>
              </div>
              <div>
                <strong>{resolved.length}</strong>
                <span>Resolved sections</span>
              </div>
              <div>
                <strong>{siteSections.length - resolved.length}</strong>
                <span>Open sections</span>
              </div>
              <div>
                <strong>
                  {siteSections.reduce(
                    (count, item) =>
                      count +
                      item.questions.filter(
                        (question) =>
                          question.required && !answers[question.key]?.trim(),
                      ).length,
                    0,
                  )}
                </strong>
                <span>Blocking decisions</span>
              </div>
            </div>
            <div className="site-review-progress">
              {siteSections
                .filter((item) => item.id !== "review")
                .map((item) => {
                  const answered = item.questions.filter((question) =>
                    answers[question.key]?.trim(),
                  ).length;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSectionId(item.id)}
                    >
                      <span>
                        <b>{item.title}</b>
                        <small>
                          {answered} / {item.questions.length} resolved
                        </small>
                      </span>
                      <i>
                        <em
                          style={{
                            width: `${item.questions.length ? (answered / item.questions.length) * 100 : 0}%`,
                          }}
                        />
                      </i>
                    </button>
                  );
                })}
            </div>
          </section>
        )}
        <div className="site-decision-list">
          {section.questions.map((question, questionIndex) => (
            <section key={question.key} className="site-guided-question">
              <p className="eyebrow">
                Question {questionIndex + 1} of {section.questions.length}
              </p>
              <h3>{question.label}</h3>
              <p>{question.hint}</p>
              {question.recommendation && (
                <p className="site-recommendation">
                  <Sparkles size={14} />
                  <b>Planning recommendation:</b> {question.recommendation}.
                  This remains provisional until supported by controlled
                  evidence.
                </p>
              )}
              {question.options ? (
                <div>
                  {question.options.map((option, optionIndex) => (
                    <button
                      type="button"
                      key={option}
                      className={`tone-${(optionIndex % 6) + 1} ${answers[question.key] === option ? "is-selected" : answers[question.key] ? "is-softened" : ""}`}
                      onClick={() => setAnswer(question.key, option)}
                    >
                      <b>{option}</b>
                      <small>
                        {option === "Skid Max"
                          ? "Moves qualified support functions into detached support structures."
                          : option === question.recommendation
                            ? "Recommended planning basis; confirm against workload and source evidence."
                            : "Planning selection; retain evidence and review before release."}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <label>
                  Planning input
                  <input
                    value={answers[question.key] ?? ""}
                    onChange={(event) =>
                      setAnswer(question.key, event.target.value)
                    }
                    placeholder={question.hint}
                  />
                </label>
              )}
              <label className="site-custom-answer">
                Custom tenant requirement
                <input
                  value={answers[`${question.key}_custom`] ?? ""}
                  onChange={(event) =>
                    setAnswer(`${question.key}_custom`, event.target.value)
                  }
                  placeholder="Optional; remains open until validated."
                />
              </label>
              {!answers[question.key]?.trim() && (
                <p className="site-skip-basis">
                  <b>Unknown / open:</b> this decision remains visible in
                  Requirement Review and cannot contribute to a fully resolved
                  planning basis.
                </p>
              )}
            </section>
          ))}
        </div>
        {section.id === "cooling" && (
          <section className="site-cooling-detail">
            <div className="site-cooling-architecture">
              <p className="eyebrow">Normal heat path</p>
              <h3>Select the rack-to-ambient architecture</h3>
              <p>
                Choose a planning heat-rejection path. It informs sizing
                assumptions, equipment coordination, and evidence requests; it
                is not a certified design.
              </p>
              <div>
                {[
                  "Auto / climate-led",
                  "DLC + dry cooler",
                  "Hybrid DLC + air",
                  "Air-cooled chiller",
                  "Immersion",
                  "Two-phase direct-to-chip",
                ].map((option, index) => (
                  <button
                    type="button"
                    key={option}
                    className={`tone-${(index % 6) + 1}${
                      answers.cooling_architecture === option
                        ? " is-selected"
                        : answers.cooling_architecture
                          ? " is-softened"
                          : ""
                    }`}
                    onClick={() => setAnswer("cooling_architecture", option)}
                  >
                    <b>{option}</b>
                    <small>
                      {option === "Auto / climate-led"
                        ? "Keeps the equipment interface provisional."
                        : option === "Hybrid DLC + air"
                          ? "Separates liquid and residual-air heat paths."
                          : "Record the compatible evidence and interface basis."}
                    </small>
                  </button>
                ))}
              </div>
            </div>
            <div className="site-state-points">
              <p className="eyebrow">
                Temperature regime and physical state points
              </p>
              <h3>Record only the values you can support</h3>
              <p>
                Each point remains a planning input until a controlled document,
                quote, test record, or engineering calculation is linked.
              </p>
              <label>
                Operating regime
                <select
                  value={answers.cooling_regime ?? ""}
                  onChange={(event) =>
                    setAnswer("cooling_regime", event.target.value)
                  }
                >
                  <option value="">Unknown / user customized</option>
                  <option>Climate-optimized planning basis</option>
                  <option>Water-free / dry cooling</option>
                  <option>User-customized, OEM evidence required</option>
                </select>
              </label>
              <div className="site-state-grid">
                {coolingStatePointFields.map(([key, label, hint]) => (
                  <label key={key}>
                    {label}
                    <input
                      value={answers[key] ?? ""}
                      onChange={(event) => setAnswer(key, event.target.value)}
                      placeholder={hint}
                    />
                  </label>
                ))}
              </div>
              <div className="site-source-reference-grid">
                <label>
                  Institutional analysis evidence (JSON)
                  <textarea
                    value={answers.institutional_analysis_json ?? ""}
                    onChange={(event) =>
                      setAnswer(
                        "institutional_analysis_json",
                        event.target.value,
                      )
                    }
                    placeholder="Optional planning reference. The platform does not treat pasted JSON as verified evidence."
                  />
                </label>
                <label>
                  Temperature-state evidence (JSON)
                  <textarea
                    value={answers.temperature_state_evidence_json ?? ""}
                    onChange={(event) =>
                      setAnswer(
                        "temperature_state_evidence_json",
                        event.target.value,
                      )
                    }
                    placeholder="Optional planning reference. Link the controlled source before relying on it."
                  />
                </label>
              </div>
            </div>
            <div className="site-cooling-evidence">
              <p className="eyebrow">Commercial and source evidence</p>
              <h3>Equipment references and annual basis</h3>
              <p>
                Use controlled document IDs or source links. Upload original
                files through Documents, then reference them here; no
                self-authored JSON is treated as verified evidence.
              </p>
              <div className="site-equipment-groups">
                {coolingEquipmentGroups.map((group) => (
                  <section key={group.id}>
                    <h4>{group.title}</h4>
                    <label>
                      Exact reference ID
                      <input
                        value={answers[`${group.id}_reference`] ?? ""}
                        onChange={(event) =>
                          setAnswer(`${group.id}_reference`, event.target.value)
                        }
                        placeholder="Vendor / model / revision"
                      />
                    </label>
                    <label>
                      Planning cost (USD/kW)
                      <input
                        value={answers[`${group.id}_cost_usd_kw`] ?? ""}
                        onChange={(event) =>
                          setAnswer(
                            `${group.id}_cost_usd_kw`,
                            event.target.value,
                          )
                        }
                        placeholder="Planning allowance only"
                      />
                    </label>
                    <label>
                      Lead range (weeks)
                      <input
                        value={answers[`${group.id}_lead_weeks`] ?? ""}
                        onChange={(event) =>
                          setAnswer(
                            `${group.id}_lead_weeks`,
                            event.target.value,
                          )
                        }
                        placeholder="e.g. 36–52"
                      />
                    </label>
                    <label>
                      Cost evidence
                      <input
                        value={answers[`${group.id}_cost_evidence`] ?? ""}
                        onChange={(event) =>
                          setAnswer(
                            `${group.id}_cost_evidence`,
                            event.target.value,
                          )
                        }
                        placeholder="Document ID / date / page"
                      />
                    </label>
                    <label>
                      Lead-time evidence
                      <input
                        value={answers[`${group.id}_lead_evidence`] ?? ""}
                        onChange={(event) =>
                          setAnswer(
                            `${group.id}_lead_evidence`,
                            event.target.value,
                          )
                        }
                        placeholder="Supplier letter / date"
                      />
                    </label>
                  </section>
                ))}
              </div>
              <div className="site-source-reference-grid">
                <label>
                  Cooling-performance source reference
                  <input
                    value={answers.cooling_performance_reference ?? ""}
                    onChange={(event) =>
                      setAnswer(
                        "cooling_performance_reference",
                        event.target.value,
                      )
                    }
                    placeholder="Controlled document ID or source link"
                  />
                </label>
                <label>
                  Hourly-weather source reference
                  <input
                    value={answers.hourly_weather_reference ?? ""}
                    onChange={(event) =>
                      setAnswer("hourly_weather_reference", event.target.value)
                    }
                    placeholder="Weather dataset ID or source link"
                  />
                </label>
              </div>
              <label className="site-cooling-reserve">
                <input
                  type="checkbox"
                  checked={answers.cooling_capacity_reserve === "yes"}
                  onChange={(event) =>
                    setAnswer(
                      "cooling_capacity_reserve",
                      event.target.checked ? "yes" : "no",
                    )
                  }
                />
                <span>
                  <b>Record installed cooling-capacity reserve</b>
                  <small>
                    Record liquid and air capacity separately. Reserve does not
                    change the selected normal operating architecture.
                  </small>
                </span>
              </label>
              {answers.cooling_capacity_reserve === "yes" && (
                <div className="site-reserve-grid">
                  <label>
                    Liquid capacity reserve (%)
                    <input
                      value={answers.liquid_capacity_reserve_pct ?? ""}
                      onChange={(event) =>
                        setAnswer(
                          "liquid_capacity_reserve_pct",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 15"
                    />
                  </label>
                  <label>
                    Residual-air capacity reserve (%)
                    <input
                      value={answers.air_capacity_reserve_pct ?? ""}
                      onChange={(event) =>
                        setAnswer(
                          "air_capacity_reserve_pct",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 10"
                    />
                  </label>
                </div>
              )}
              <section className="site-ai-analysis">
                <div>
                  <p className="eyebrow">Gemma advisory analysis</p>
                  <h4>Interpret cooling inputs and linked project evidence</h4>
                  <p>
                    Generates a reviewable planning narrative, evidence gaps,
                    and next actions. It never certifies a design, supplier
                    curve, weather file, or approval.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={analyzeCooling}
                  disabled={analysisBusy}
                >
                  <Sparkles size={16} />
                  {analysisBusy ? "Analyzing…" : "Analyze cooling basis"}
                </button>
                {coolingAnalysis && (
                  <div className="site-ai-results">
                    <p>
                      <b>
                        Advisory · {coolingAnalysis.analysis.confidence}{" "}
                        confidence
                      </b>
                      {" · "}
                      {coolingAnalysis.provider} / {coolingAnalysis.model}
                    </p>
                    <h4>{coolingAnalysis.analysis.summary}</h4>
                    <div>
                      <section>
                        <b>Observations</b>
                        <ul>
                          {coolingAnalysis.analysis.observations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <b>Evidence gaps</b>
                        <ul>
                          {coolingAnalysis.analysis.evidenceGaps.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <b>Next actions</b>
                        <ul>
                          {coolingAnalysis.analysis.recommendedActions.map(
                            (item) => (
                              <li key={item}>{item}</li>
                            ),
                          )}
                        </ul>
                      </section>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        )}
        <footer>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setSectionId(
                siteSections[
                  Math.max(
                    0,
                    siteSections.findIndex((item) => item.id === section.id) -
                      1,
                  )
                ].id,
              )
            }
            disabled={section.id === "project"}
          >
            Back
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setCompleted((items) => items.filter((id) => id !== section.id));
              setMessage(
                `${section.title} marked open for later confirmation.`,
              );
            }}
          >
            Skip this section
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              void save(section.id === "review" ? "review" : "draft", [
                section.id,
              ]);
            }}
            disabled={busy}
          >
            {section.id === "review"
              ? "Confirm & build execution plan"
              : "Save and continue"}
          </button>
        </footer>
      </section>
      <section className="surface site-analysis-summary">
        <div>
          <p className="eyebrow">Project overview summary</p>
          <h2>Current planning basis</h2>
        </div>
        <dl>
          <div>
            <dt>Location</dt>
            <dd>{answers.location || "Unknown"}</dd>
          </div>
          <div>
            <dt>Target load</dt>
            <dd>
              {answers.target_it_mw ? `${answers.target_it_mw} MW` : "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Utility</dt>
            <dd>
              {answers.utility_mw ? `${answers.utility_mw} MW` : "Unknown"}
            </dd>
          </div>
          <div>
            <dt>Cooling</dt>
            <dd>{answers.cooling_architecture || "Unknown"}</dd>
          </div>
          <div>
            <dt>PUE target</dt>
            <dd>{answers.pue_target || "Unknown"}</dd>
          </div>
          <div>
            <dt>RFS target</dt>
            <dd>{answers.rfs_date || "Unknown"}</dd>
          </div>
        </dl>
        {sourceMetadata.csvFileName && (
          <p>
            CSV import: <b>{sourceMetadata.csvFileName}</b> ·{" "}
            {sourceMetadata.importedRows ?? 0} rows parsed locally.
          </p>
        )}
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

function ManagerSiteSummary({
  answers,
  handoff,
}: {
  answers: SiteAnswerMap;
  handoff: Handoff | null;
}) {
  const decisions = useMemo(
    () =>
      siteSections
        .filter((section) => section.id !== "review")
        .map((section) => ({
          section,
          values: section.questions.filter((question) => answers[question.key]?.trim()),
        }))
        .filter((item) => item.values.length),
    [answers]
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    decisions.forEach(({ section }) => {
      allOpen[section.id] = true;
    });
    setOpenSections(allOpen);
  };

  const collapseAll = () => {
    setOpenSections({});
  };

  const allExpanded =
    decisions.length > 0 && decisions.every(({ section }) => openSections[section.id]);

  const leftColumn = useMemo(
    () => decisions.filter((_, i) => i % 2 === 0),
    [decisions]
  );
  const rightColumn = useMemo(
    () => decisions.filter((_, i) => i % 2 === 1),
    [decisions]
  );

  const renderCard = (
    section: (typeof decisions)[number]["section"],
    values: (typeof decisions)[number]["values"]
  ) => {
    const isOpen = Boolean(openSections[section.id]);
    return (
      <div
        key={section.id}
        className={`site-decision-card ${isOpen ? "is-open" : ""}`}
      >
        <button
          type="button"
          className="site-decision-header"
          onClick={() => toggleSection(section.id)}
          aria-expanded={isOpen}
        >
          <div className="site-decision-title">
            <span className="site-decision-icon" aria-hidden="true">
              <ChevronDown
                size={16}
                className={`chevron ${isOpen ? "rotate" : ""}`}
              />
            </span>
            <b>{section.title}</b>
          </div>
          <span className="site-decision-badge">
            {values.length} decision{values.length === 1 ? "" : "s"}
          </span>
        </button>
        {isOpen && (
          <div className="site-decision-body">
            <dl>
              {values.map((question) => (
                <div key={question.key}>
                  <dt>{question.label}</dt>
                  <dd>{answers[question.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="surface site-manager-summary" aria-label="Final Site Analysis summary">
      <header>
        <div>
          <p className="eyebrow">Manager review · confirmed planning basis</p>
          <h2>{answers.project_name || "Site Analysis summary"}</h2>
          <p>
            {answers.location || "Location not recorded"} · {answers.objective || "Objective not recorded"}
          </p>
        </div>
        <span className="status-pill ready">Materialized for review</span>
      </header>
      <div className="site-manager-kpis">
        <article className="is-power">
          <Zap size={22} />
          <span>Target IT load</span>
          <strong>{answers.target_it_mw ? `${answers.target_it_mw} MW` : "Open"}</strong>
        </article>
        <article className="is-water">
          <Droplets size={22} />
          <span>Water basis</span>
          <strong>{answers.water_source || "Open"}</strong>
          <i aria-hidden="true" />
        </article>
        <article className="is-location">
          <MapPin size={22} />
          <span>Site</span>
          <strong>{answers.location || "Open"}</strong>
        </article>
        <article>
          <CheckCircle2 size={22} />
          <span>Execution handoff</span>
          <strong>{handoff ? `${handoff.taskCount} tasks · ${handoff.checklistCount} test plans` : "Saved"}</strong>
        </article>
      </div>
      <div className="site-manager-decisions-header">
        <div>
          <h3>Confirmed section decisions</h3>
          <p>Click any section to expand its confirmed parameters independently.</p>
        </div>
        <button
          type="button"
          className="site-manager-expand-btn"
          onClick={allExpanded ? collapseAll : expandAll}
          aria-label={allExpanded ? "Collapse all sections" : "Expand all sections"}
        >
          <ChevronsUpDown size={14} />
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="site-manager-decisions-columns">
        <div className="site-manager-decisions-column">
          {leftColumn.map(({ section, values }) => renderCard(section, values))}
        </div>
        <div className="site-manager-decisions-column">
          {rightColumn.map(({ section, values }) => renderCard(section, values))}
        </div>
      </div>
      <p className="site-manager-caveat">
        Planning inputs are now traceable and downstream work is created, but proposed requirements and commissioning plans still require accountable human review before they affect certified readiness.
      </p>
    </section>
  );
}
