"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./compliance-workbench.module.css";

type Requirement = { id: string; statement: string; sourceRegionId: string; numericValue: string | null; unit: string | null; tolerance: string | null };
type Region = { id: string; text: string; pageNumber: string; contentHash: string; documentTitle: string; documentType: string; revision: string };
type SnapshotSource = { hierarchy: number };
type CrossCheck = { verdict: string; reason: string };
type Check = { id: string; requirementId: string; targetSourceRegionId: string; comparisonType: string; verdict: string; reviewState: string; confidence: string; reason: string; proposedFindingId: string | null; findingDisposition: string; reviewNote: string | null; reviewerName: string | null; version: number; requirementSnapshot: unknown; targetSnapshot: unknown; suggestionSource: string | null; suggestionModelVersion: string | null; createdAt: Date; precedentId: string | null };
type Precedent = { id: string; requirementId: string; targetSourceRegionId: string; sourceCheckId: string; title: string; rationale: string; reviewState: string; reviewNote: string | null; reviewerName: string | null; createdAt: Date };

const label = (value: string) => value.replaceAll("_", " ");
function presentation(check: Check) {
  if (check.reviewState === "accepted" && check.verdict === "conforms") return { tone: styles.good, title: "Compliant" };
  if (check.reviewState === "proposed") return { tone: styles.danger, title: "Engineer review required" };
  return { tone: styles.danger, title: "Compliance action required" };
}

export function ComplianceWorkbench({ projectId, requirements, regions, checks, precedents }: { projectId: string; requirements: Requirement[]; regions: Region[]; checks: Check[]; precedents: Precedent[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const requirementById = useMemo(() => new Map(requirements.map((item) => [item.id, item])), [requirements]);
  const regionById = useMemo(() => new Map(regions.map((item) => [item.id, item])), [regions]);
  const acceptedPrecedents = precedents.filter((item) => item.reviewState === "accepted");
  const compliantCount = checks.filter((check) => presentation(check).tone === styles.good).length;

  async function send(url: string, init: RequestInit, success: string) {
    setSaving(true); setMessage("");
    const response = await fetch(url, init); const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? success : body.error ?? "The request failed."); setSaving(false);
    if (response.ok) router.refresh();
  }
  async function scan() {
    setSaving(true); setMessage("Scanning relevant controlled targets…");
    const response = await fetch(`/api/projects/${projectId}/compliance/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const body = await response.json().catch(() => ({})); setSaving(false);
    setMessage(response.ok ? `Scan complete: ${body.requirementsScanned} requirements scanned and ${body.candidatesFound} relevant candidates found.` : body.error ?? "The scan failed.");
    if (response.ok) router.refresh();
  }
  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const precedentId = String(form.get("precedentId") ?? "");
    await send(`/api/projects/${projectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: form.get("requirementId"), targetSourceRegionId: form.get("targetSourceRegionId"), precedentId: precedentId || undefined }) }, "Comparison proposed with exact citations.");
  }
  async function reviewCheck(form: HTMLFormElement, check: Check, action: "accept" | "edit" | "reject") {
    const data = new FormData(form);
    await send(`/api/compliance/checks/${check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, expectedVersion: check.version, note: data.get("note"), finalVerdict: action === "edit" ? data.get("finalVerdict") : undefined }) }, `Engineer disposition recorded: ${action}.`);
  }
  async function proposePrecedent(event: FormEvent<HTMLFormElement>, check: Check) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    await send(`/api/projects/${projectId}/compliance/precedents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkId: check.id, title: data.get("title"), rationale: data.get("rationale") }) }, "Equality precedent proposed for separate review.");
  }
  async function reviewPrecedent(form: HTMLFormElement, precedent: Precedent, action: "accept" | "reject") {
    const data = new FormData(form);
    await send(`/api/compliance/precedents/${precedent.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note: data.get("note") }) }, `Precedent ${action}.`);
  }

  return <div className={styles.workbench}>
    <section className={styles.summary} aria-label="Compliance summary">
      <div><span className="eyebrow">Controlled compliance</span><h2>Decision queue</h2><p>Retrieval only finds relevant candidates. Deterministic checks and engineer review establish authority.</p></div>
      <div className={`${styles.metric} ${styles.metricDanger}`}><strong>{checks.length - compliantCount}</strong><span>Need attention</span></div>
      <div className={`${styles.metric} ${styles.metricGood}`}><strong>{compliantCount}</strong><span>Compliant</span></div>
      <div className={styles.metric}><strong>{requirements.length}</strong><span>Accepted requirements</span></div>
    </section>

    <section className={styles.runPanel}>
      <div className={styles.runHeader}><div><span className="eyebrow">Relevance-gated discovery</span><h3>Find and compare controlled conditions</h3><p>Searches approved submittals, POs and drawings. Cross-domain matches are rejected before review.</p></div><button type="button" className="button button-secondary" disabled={saving || !requirements.length} onClick={scan}>Scan for deviations</button></div>
      <form className={styles.runForm} onSubmit={runCheck}>
        <label>Accepted requirement<select name="requirementId" required>{requirements.map((item) => <option value={item.id} key={item.id}>{item.statement.slice(0, 110)}</option>)}</select></label>
        <label>Controlled target line<select name="targetSourceRegionId" required>{regions.map((item) => <option value={item.id} key={item.id}>{item.documentType} · {item.documentTitle} · p.{item.pageNumber} · {item.text.slice(0, 80)}</option>)}</select></label>
        <label>Accepted precedent<select name="precedentId"><option value="">No precedent</option>{acceptedPrecedents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
        <button className="button button-primary" disabled={saving || !requirements.length || !regions.length}>Run comparison</button>
      </form>
    </section>
    {message && <p className={styles.message} role="status">{message}</p>}

    <section className="workflow-stack" aria-labelledby="checks-heading">
      <div className={styles.queueHeader}><div><span className="eyebrow">Review queue</span><h2 id="checks-heading">Compliance proposals</h2></div><p>Red requires action · green is reviewed and conforming.</p></div>
      {checks.map((check) => {
        const requirement = requirementById.get(check.requirementId); const target = regionById.get(check.targetSourceRegionId); const view = presentation(check);
        const targetSnapshot = check.targetSnapshot as { sourceConflict?: boolean; deterministicCrossCheck?: CrossCheck; source?: SnapshotSource } | null;
        const requirementSnapshot = check.requirementSnapshot as { source?: SnapshotSource } | null;
        return <article className={`${styles.check} ${view.tone}`} key={check.id}>
          <div className={styles.checkGrid}>
            <div className={styles.statusPanel}><span className={styles.statusPill}>{view.title}</span><h3>{check.reason}</h3><p>{check.reviewState === "proposed" ? "No authority until an engineer records a disposition." : "The recorded review controls this comparison."}</p><div className={styles.statusMeta}><span><b>Review:</b> {label(check.reviewState)}</span><span><b>Verdict:</b> {label(check.verdict)}</span><span><b>Method:</b> {label(check.comparisonType)} · confidence {check.confidence}</span>{check.suggestionSource === "model" && <span><b>Advisory model:</b> {check.suggestionModelVersion}</span>}<span><b>Finding:</b> {label(check.findingDisposition)}</span></div></div>
            <div className={styles.evidencePanel}>
              {targetSnapshot?.sourceConflict && requirementSnapshot?.source && targetSnapshot.source && <div className={styles.conflict}><strong>Authority conflict</strong><br />Requirement hierarchy {requirementSnapshot.source.hierarchy}; target hierarchy {targetSnapshot.source.hierarchy}. Neither source is silently preferred.</div>}
              <h4>Exact evidence comparison</h4>
              <div className={styles.citationGrid}><div className={styles.citation}><b>Accepted requirement</b><p>{requirement?.statement ?? check.requirementId}</p>{requirement && <Link href={`/sources/regions/${requirement.sourceRegionId}`}>Open exact citation</Link>}</div><div className={styles.citation}><b>Controlled target</b><p>{target?.text ?? check.targetSourceRegionId}</p>{target && <><small>{target.documentType} · {target.documentTitle} · rev {target.revision} · page {target.pageNumber}</small><Link href={`/sources/regions/${target.id}`}>Open exact citation</Link></>}</div></div>
              {targetSnapshot?.deterministicCrossCheck && <p><strong>Deterministic cross-check:</strong> {label(targetSnapshot.deterministicCrossCheck.verdict)} — {targetSnapshot.deterministicCrossCheck.reason}</p>}
            </div>
          </div>
          <div className={styles.review}>{check.reviewNote && <p><strong>Engineer rationale:</strong> {check.reviewNote} {check.reviewerName ? `— ${check.reviewerName}` : ""}</p>}{check.reviewState === "proposed" && <details><summary>Record engineer disposition</summary><form className="workflow-form compact-form" onSubmit={(event) => { event.preventDefault(); reviewCheck(event.currentTarget, check, "accept"); }}><label>Mandatory rationale<textarea name="note" required minLength={10} /></label><label>Final verdict<select name="finalVerdict"><option value="conforms">Conforms</option><option value="deterministic_flag">Deterministic flag</option><option value="possible_mismatch">Possible mismatch</option></select></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept</button><button className="button button-secondary" type="button" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "edit"); }}>Edit</button><button className="button button-inverted" type="button" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "reject"); }}>Reject</button></div></form>{["possible_mismatch", "needs_engineering_judgment"].includes(check.verdict) && <form className="workflow-form compact-form" onSubmit={(event) => proposePrecedent(event, check)}><label>Precedent title<input name="title" minLength={5} required /></label><label>Cited rationale<textarea name="rationale" minLength={20} required /></label><button className="button button-secondary" disabled={saving}>Propose precedent</button></form>}</details>}</div>
        </article>;
      })}
      {!checks.length && <article className="surface empty-state"><h3>No compliance checks yet</h3><p>Run relevance-gated discovery or choose two exact controlled citations.</p></article>}
    </section>

    <section className="workflow-stack"><div><span className="eyebrow">Project-scoped teach-back</span><h2>Equality precedents</h2><p>Only exact accepted requirement and target pairs can reuse a precedent.</p></div>{precedents.map((precedent) => <article className="surface workflow-card" key={precedent.id}><h3>{precedent.title}</h3><p>{precedent.rationale}</p><div className="review-actions"><Link href={`/sources/regions/${requirementById.get(precedent.requirementId)?.sourceRegionId}`}>Requirement citation</Link><Link href={`/sources/regions/${precedent.targetSourceRegionId}`}>Target citation</Link></div>{precedent.reviewState === "proposed" && <form className="workflow-form compact-form" onSubmit={(event) => { event.preventDefault(); reviewPrecedent(event.currentTarget, precedent, "accept"); }}><label>Reviewer rationale<textarea name="note" required minLength={10} /></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept precedent</button><button type="button" className="button button-inverted" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewPrecedent(form, precedent, "reject"); }}>Reject</button></div></form>}</article>)}{!precedents.length && <article className="surface empty-state"><h3>No equality precedents</h3><p>Engineers can propose exact-citation equivalence during review.</p></article>}</section>
  </div>;
}
