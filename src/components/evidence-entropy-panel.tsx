import { computeEvidenceEntropy } from "@/lib/evidence/entropy";

// CanonicalBuildPlan Feature 21 — renders the advisory evidence-entropy score
// as its own clearly-separated section. Deliberately never reads or writes
// any readiness/gate state; it only calls computeEvidenceEntropy, which is
// itself read-only. Kept as a standalone component (rather than edited into
// the proof-grid/blocker sections above) so the advisory-vs-readiness
// separation is visually obvious, not just true under the hood.
export async function EvidenceEntropyPanel({ projectId }: { projectId: string }) {
  const result = await computeEvidenceEntropy(projectId);
  return (
    <article className="surface readiness-detail-card">
      <header>
        <div>
          <span className="status-pill unknown">advisory only — never blocks a gate</span>
          <h2>Evidence entropy</h2>
          <p>Structurally weak evidence, flagged for review. This score never feeds a gate decision or the readiness verdict above.</p>
        </div>
        <div className="rule-stamp">
          <span>Total</span>
          <b>{result.total} / {result.maxPossible}</b>
          <small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.computedAt))}</small>
        </div>
      </header>
      <div className="readiness-secondary-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {result.signals.map((signal) => (
          <section key={signal.key}>
            <h3>
              {signal.label}{" "}
              {signal.mode === "computed" ? <span>{signal.contribution} pts</span> : <span className="status-pill unknown">unavailable</span>}
            </h3>
            <p className="workflow-hint">{signal.reason}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
