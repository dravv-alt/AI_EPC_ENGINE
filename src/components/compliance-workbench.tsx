"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Requirement = { id: string; statement: string; sourceRegionId: string; numericValue: string | null; unit: string | null; tolerance: string | null };
type Region = { id: string; text: string; pageNumber: string; contentHash: string; documentTitle: string; documentType: string; revision: string };
type Check = { id: string; requirementId: string; targetSourceRegionId: string; comparisonType: string; verdict: string; reviewState: string; confidence: string; reason: string; precedentId: string | null; proposedFindingId: string | null; findingDisposition: string; reviewNote: string | null; reviewerName: string | null; version: number; targetSnapshot: unknown; createdAt: Date };
type Precedent = { id: string; requirementId: string; targetSourceRegionId: string; sourceCheckId: string; title: string; rationale: string; reviewState: string; reviewNote: string | null; reviewerName: string | null; createdAt: Date };

function label(value: string) { return value.replaceAll("_", " "); }

export function ComplianceWorkbench({ projectId, requirements, regions, checks, precedents }: { projectId: string; requirements: Requirement[]; regions: Region[]; checks: Check[]; precedents: Precedent[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const requirementById = useMemo(() => new Map(requirements.map((item) => [item.id, item])), [requirements]);
  const regionById = useMemo(() => new Map(regions.map((item) => [item.id, item])), [regions]);
  const acceptedPrecedents = precedents.filter((item) => item.reviewState === "accepted");

  async function send(url: string, init: RequestInit, success: string) {
    setSaving(true); setMessage("");
    const response = await fetch(url, init); const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? success : body.error ?? "The request failed."); setSaving(false);
    if (response.ok) router.refresh();
    return response.ok;
  }

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const precedentId = String(form.get("precedentId") ?? "");
    await send(`/api/projects/${projectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: form.get("requirementId"), targetSourceRegionId: form.get("targetSourceRegionId"), precedentId: precedentId || undefined }) }, "Comparison proposed with two exact controlled citations.");
  }

  async function reviewCheck(element: HTMLFormElement, check: Check, action: "accept" | "edit" | "reject") {
    const form = new FormData(element);
    await send(`/api/compliance/checks/${check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, expectedVersion: check.version, note: form.get("note"), finalVerdict: action === "edit" ? form.get("finalVerdict") : undefined }) }, `Engineer disposition recorded: ${action}.`);
  }

  async function proposePrecedent(event: FormEvent<HTMLFormElement>, check: Check) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`/api/projects/${projectId}/compliance/precedents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkId: check.id, title: form.get("title"), rationale: form.get("rationale") }) }, "Equality precedent proposed; it has no authority until explicitly accepted.");
  }

  async function reviewPrecedent(element: HTMLFormElement, precedent: Precedent, action: "accept" | "reject") {
    const form = new FormData(element);
    await send(`/api/compliance/precedents/${precedent.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note: form.get("note") }) }, `Precedent ${action === "accept" ? "accepted for this exact requirement and normalized line" : "rejected"}.`);
  }

  return <div className="workflow-stack">
    <section className="surface compliance-run-card" aria-labelledby="run-compliance-heading">
      <div><span className="eyebrow">Deterministic proposal</span><h2 id="run-compliance-heading">Run a cited comparison</h2><p>Numeric values are unit-normalized. Explicit booleans and controlled categories are compared exactly. Everything else is mandatory human review.</p></div>
      <form className="workflow-stack compliance-run-form" onSubmit={runCheck}>
        <label>Accepted requirement<select name="requirementId" required>{requirements.map((item) => <option value={item.id} key={item.id}>{item.statement.slice(0, 110)}</option>)}</select></label>
        <label>Submittal, PO, drawing, or other controlled target line<select name="targetSourceRegionId" required>{regions.map((item) => <option value={item.id} key={item.id}>{item.documentType} · {item.documentTitle} · p.{item.pageNumber} · {item.text.slice(0, 80)}</option>)}</select></label>
        <label>Accepted equality precedent, only when it matches exactly<select name="precedentId"><option value="">No precedent</option>{acceptedPrecedents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
        <button className="button button-primary" disabled={saving || !requirements.length || !regions.length}>Run cited comparison</button>
      </form>
      {!requirements.length && <p className="form-message">Accept at least one cited requirement before running compliance.</p>}
    </section>

    {message && <p className="surface form-message" role="status">{message}</p>}

    <section className="workflow-stack" aria-labelledby="checks-heading"><div><span className="eyebrow">Review queue</span><h2 id="checks-heading">Compliance proposals</h2></div>
      {checks.map((check) => {
        const requirement = requirementById.get(check.requirementId); const target = regionById.get(check.targetSourceRegionId); const snapshot = check.targetSnapshot as { sourceConflict?: boolean } | null;
        return <article className="surface workflow-card" key={check.id}>
          <div className="status-row"><span className={`source-status ${check.reviewState === "proposed" ? "pending" : check.reviewState === "rejected" ? "failed" : "ready"}`}>{label(check.reviewState)}</span><span className="source-status pending">{label(check.verdict)}</span><span className="mono-label">{label(check.comparisonType)} · confidence {check.confidence}</span></div>
          <h3>{check.reason}</h3>
          {snapshot?.sourceConflict && <p className="form-message"><strong>Source hierarchy conflict:</strong> the requirement and target come from different document authority levels. Review document type, revision, and date before disposition.</p>}
          <div className="compliance-citations">
            <div><span className="mono-label">Accepted requirement</span><p>{requirement?.statement ?? check.requirementId}</p>{requirement && <Link href={`/sources/regions/${requirement.sourceRegionId}`}>Open exact requirement citation</Link>}</div>
            <div><span className="mono-label">Controlled target line</span><p>{target?.text ?? check.targetSourceRegionId}</p>{target && <><p className="muted-copy">{target.documentType} · {target.documentTitle} · rev {target.revision} · page {target.pageNumber}</p><Link href={`/sources/regions/${target.id}`}>Open exact target citation</Link></>}</div>
          </div>
          <p>Finding: <strong>{label(check.findingDisposition)}</strong>{check.proposedFindingId ? ` · ${check.proposedFindingId}` : ""}</p>
          {check.reviewNote && <p><strong>Engineer rationale:</strong> {check.reviewNote} {check.reviewerName ? `— ${check.reviewerName}` : ""}</p>}
          {check.reviewState === "proposed" && <>
            <form className="workflow-form compact-form" onSubmit={(event) => { event.preventDefault(); reviewCheck(event.currentTarget, check, "accept"); }}><label>Mandatory engineer rationale<textarea name="note" required minLength={10} placeholder="Record why the proposal should be accepted or changed." /></label><label>Edited final verdict<select name="finalVerdict"><option value="conforms">Conforms</option><option value="deterministic_flag">Deterministic flag</option><option value="possible_mismatch">Possible mismatch</option></select></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept proposal</button><button className="button button-secondary" disabled={saving} type="button" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "edit"); }}>Edit disposition</button><button className="button button-inverted" disabled={saving} type="button" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "reject"); }}>Reject proposal</button></div></form>
            {["possible_mismatch", "needs_engineering_judgment"].includes(check.verdict) && <form className="workflow-form compact-form" onSubmit={(event) => proposePrecedent(event, check)}><span className="mono-label">Teach-back / equality precedent</span><label>Precedent title<input name="title" minLength={5} required placeholder="Why this alternative is accepted as equal" /></label><label>Cited engineering rationale<textarea name="rationale" minLength={20} required placeholder="Explain the equivalence against both exact citations. This remains proposed until separate acceptance." /></label><button className="button button-secondary" disabled={saving}>Propose equality precedent</button></form>}
          </>}
        </article>;
      })}
      {!checks.length && <article className="surface empty-state"><h3>No compliance checks yet</h3><p>Choose an accepted requirement and an exact controlled target line above.</p></article>}
    </section>

    <section className="workflow-stack" aria-labelledby="precedents-heading"><div><span className="eyebrow">Project-scoped teach-back</span><h2 id="precedents-heading">Equality precedents</h2><p>Precedents are matched only to the same accepted requirement and exact normalized target content. They are never auto-applied.</p></div>
      {precedents.map((precedent) => <article className="surface workflow-card" key={precedent.id}><div className="status-row"><span className={`source-status ${precedent.reviewState === "proposed" ? "pending" : precedent.reviewState === "accepted" ? "ready" : "failed"}`}>{label(precedent.reviewState)}</span><span className="mono-label">exact-citation precedent</span></div><h3>{precedent.title}</h3><p>{precedent.rationale}</p><div className="review-actions"><Link href={`/sources/regions/${requirementById.get(precedent.requirementId)?.sourceRegionId}`}>Requirement citation</Link><Link href={`/sources/regions/${precedent.targetSourceRegionId}`}>Target citation</Link></div>{precedent.reviewNote && <p><strong>Review:</strong> {precedent.reviewNote} {precedent.reviewerName ? `— ${precedent.reviewerName}` : ""}</p>}{precedent.reviewState === "proposed" && <form className="workflow-form compact-form" onSubmit={(event) => { event.preventDefault(); reviewPrecedent(event.currentTarget, precedent, "accept"); }}><label>Reviewer rationale<textarea name="note" required minLength={10} /></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept precedent</button><button type="button" className="button button-inverted" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewPrecedent(form, precedent, "reject"); }}>Reject precedent</button></div></form>}</article>)}
      {!precedents.length && <article className="surface empty-state"><h3>No approved-equal knowledge yet</h3><p>An engineer can propose teach-back context from a qualitative check; another explicit review grants or denies precedent status.</p></article>}
    </section>
  </div>;
}
