"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileCheck2, Search, ShieldCheck } from "lucide-react";

type Requirement = { id: string; statement: string; sourceRegionId: string; numericValue: string | null; unit: string | null; tolerance: string | null };
type Region = { id: string; text: string; pageNumber: string; contentHash: string; documentTitle: string; documentType: string; revision: string };
type DeterministicCrossCheck = { comparisonType: string; verdict: string; confidence: string; reason: string };
type Check = { id: string; requirementId: string; targetSourceRegionId: string; comparisonType: string; verdict: string; reviewState: string; confidence: string; reason: string; precedentId: string | null; proposedFindingId: string | null; findingDisposition: string; reviewNote: string | null; reviewerName: string | null; version: number; requirementSnapshot: unknown; targetSnapshot: unknown; suggestionSource: string | null; suggestionModelVersion: string | null; createdAt: Date };
type Precedent = { id: string; requirementId: string; targetSourceRegionId: string; sourceCheckId: string; title: string; rationale: string; reviewState: string; reviewNote: string | null; reviewerName: string | null; createdAt: Date };
type Validation = { labelSource: string; productionAccuracyClaimPermitted: boolean; cases: number; passed: number; metrics: { accuracy: number; precision: number; recall: number; f1: number; falsePositive: number; falseNegative: number }; failures: Array<{ id: string; expected: string; actual: string }> };

function label(value: string) { return value.replaceAll("_", " "); }

export function ComplianceWorkbench({ projectId, requirements, regions, checks, precedents, validation }: { projectId: string; requirements: Requirement[]; regions: Region[]; checks: Check[]; precedents: Precedent[]; validation: Validation }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [targetQuery, setTargetQuery] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "proposed" | "accepted">("all");
  const [selectedCheckId, setSelectedCheckId] = useState(checks[0]?.id ?? "");
  const requirementById = useMemo(() => new Map(requirements.map((item) => [item.id, item])), [requirements]);
  const regionById = useMemo(() => new Map(regions.map((item) => [item.id, item])), [regions]);
  const acceptedPrecedents = precedents.filter((item) => item.reviewState === "accepted");
  const visibleRegions = useMemo(() => {
    const query = targetQuery.trim().toLowerCase();
    return regions.filter((item) => !query || `${item.documentType} ${item.documentTitle} ${item.text}`.toLowerCase().includes(query)).slice(0, 100);
  }, [regions, targetQuery]);
  const filteredChecks = useMemo(() => checks.filter((check) => queueFilter === "all" || check.reviewState === queueFilter), [checks, queueFilter]);
  const selectedCheck = filteredChecks.find((check) => check.id === selectedCheckId) ?? filteredChecks[0] ?? null;
  const proposedCount = checks.filter((check) => check.reviewState === "proposed").length;

  async function send(url: string, init: RequestInit, success: string) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(url, init); const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? success : body.error ?? "The request failed.");
      if (response.ok) router.refresh();
      return response.ok;
    } catch {
      setMessage("The server could not be reached. Please retry.");
      return false;
    } finally { setSaving(false); }
  }

  async function scanForDeviations() {
    setSaving(true); setMessage("Scanning accepted requirements for candidate deviations...");
    try {
      const response = await fetch(`/api/projects/${projectId}/compliance/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(body.error ?? "The scan failed."); return; }
      const queuedJobIds = (body.items ?? []).filter((item: { duplicate: boolean; queuedInRedis: boolean }) => !item.duplicate && item.queuedInRedis).map((item: { jobId: string }) => item.jobId);
      if (queuedJobIds.length) {
        setMessage(`Scan queued ${queuedJobIds.length} controlled comparisons. Waiting for completed results...`);
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const jobs = await Promise.all(queuedJobIds.map(async (jobId: string) => {
            const jobResponse = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
            return jobResponse.ok ? (await jobResponse.json()).job : null;
          }));
          const complete = jobs.filter((job) => job && ["completed", "failed", "cancelled"].includes(job.status)).length;
          if (complete === queuedJobIds.length) {
            const failed = jobs.filter((job) => job?.status === "failed").length;
            setMessage(`Scan finished: ${body.requirementsScanned} requirements, ${body.candidatesFound} candidates, ${failed ? `${failed} failed jobs` : "all comparison jobs completed"}.`);
            router.refresh();
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        }
        setMessage(`Scan is still processing ${queuedJobIds.length} comparisons. Results will enter the review queue as the worker completes them.`);
      } else {
        setMessage(`Scan complete: ${body.requirementsScanned} requirements scanned, ${body.candidatesFound} candidates found, ${body.jobsInline} processed inline, ${body.jobsDuplicate} unchanged.`);
      }
      router.refresh();
    } catch { setMessage("The server could not be reached. Please retry."); }
    finally { setSaving(false); }
  }

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const precedentId = String(form.get("precedentId") ?? "");
    await send(`/api/projects/${projectId}/compliance/checks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId: form.get("requirementId"), targetSourceRegionId: form.get("targetSourceRegionId"), precedentId: precedentId || undefined }) }, "Comparison proposed with two exact citations.");
  }

  async function reviewCheck(element: HTMLFormElement, check: Check, action: "accept" | "edit" | "reject") {
    const form = new FormData(element);
    await send(`/api/compliance/checks/${check.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, expectedVersion: check.version, note: form.get("note"), finalVerdict: action === "edit" ? form.get("finalVerdict") : undefined }) }, `Engineer disposition recorded: ${action}.`);
  }

  async function proposePrecedent(event: FormEvent<HTMLFormElement>, check: Check) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await send(`/api/projects/${projectId}/compliance/precedents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checkId: check.id, title: form.get("title"), rationale: form.get("rationale") }) }, "Equality precedent proposed for separate review.");
  }

  async function reviewPrecedent(element: HTMLFormElement, precedent: Precedent, action: "accept" | "reject") {
    const form = new FormData(element);
    await send(`/api/compliance/precedents/${precedent.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note: form.get("note") }) }, `Precedent ${action}.`);
  }

  function renderCheckDetail(check: Check) {
    const requirement = requirementById.get(check.requirementId);
    const target = regionById.get(check.targetSourceRegionId);
    const requirementSnapshot = check.requirementSnapshot as { statement?: string; source?: { regionId?: string } } | null;
    const snapshot = check.targetSnapshot as { text?: string; excerptSelection?: string; source?: { regionId?: string }; sourceConflict?: boolean; deterministicCrossCheck?: DeterministicCrossCheck } | null;
    const requirementRegionId = requirement?.sourceRegionId ?? requirementSnapshot?.source?.regionId;
    const targetRegionId = target?.id ?? snapshot?.source?.regionId;
    return <article className="compliance-review-detail">
      <header className="review-detail-header"><div className="status-row"><span className={`source-status ${check.reviewState === "proposed" ? "pending" : check.reviewState === "rejected" ? "failed" : "ready"}`}>{label(check.reviewState)}</span><span className="source-status pending">{label(check.verdict)}</span></div><h3>{check.reason}</h3><p>{label(check.comparisonType)} comparison. Confidence {check.confidence}.</p></header>
      {snapshot?.deterministicCrossCheck && <aside className="compliance-notice"><strong>Deterministic cross-check</strong><p>{label(snapshot.deterministicCrossCheck.verdict)} at {snapshot.deterministicCrossCheck.confidence} confidence. {snapshot.deterministicCrossCheck.reason}</p></aside>}
      {snapshot?.sourceConflict && <aside className="compliance-notice warning"><strong>Source hierarchy conflict</strong><p>These citations have different authority levels. Review both before disposition.</p></aside>}
      <div className="evidence-pair">
        <section><div className="evidence-heading"><span>Requirement</span>{requirementRegionId && <Link href={`/sources/regions/${requirementRegionId}`}>Open citation</Link>}</div><p className="evidence-scroll" tabIndex={0}>{requirement?.statement ?? requirementSnapshot?.statement ?? check.requirementId}</p></section>
        <section><div className="evidence-heading"><span>Controlled target excerpt</span>{targetRegionId && <Link href={`/sources/regions/${targetRegionId}`}>Open full citation</Link>}</div><p className="evidence-scroll" tabIndex={0}>{snapshot?.text ?? target?.text ?? check.targetSourceRegionId}</p>{target && <small>{target.documentType} / {target.documentTitle} / rev {target.revision} / page {target.pageNumber}{snapshot?.excerptSelection === "deterministic_fragment" ? " / exact fragment selected" : ""}</small>}</section>
      </div>
      <div className="finding-summary"><span>Finding</span><strong>{label(check.findingDisposition)}</strong>{check.proposedFindingId && <code>{check.proposedFindingId}</code>}</div>
      {check.reviewNote && <aside className="compliance-notice"><strong>Engineer rationale</strong><p>{check.reviewNote}{check.reviewerName ? ` - ${check.reviewerName}` : ""}</p></aside>}
      {check.reviewState === "proposed" && <form className="compliance-review-form" onSubmit={(event) => { event.preventDefault(); reviewCheck(event.currentTarget, check, "accept"); }}><label>Engineer rationale<textarea name="note" required minLength={10} placeholder="Explain the disposition using the cited evidence." /></label><label>Final verdict<select name="finalVerdict"><option value="conforms">Conforms</option><option value="deterministic_flag">Deterministic flag</option><option value="possible_mismatch">Possible mismatch</option></select></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept</button><button className="button button-secondary" disabled={saving} type="button" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "edit"); }}>Save edited verdict</button><button className="button button-inverted" disabled={saving} type="button" onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewCheck(form, check, "reject"); }}>Reject</button></div></form>}
      {check.reviewState === "proposed" && ["possible_mismatch", "needs_engineering_judgment"].includes(check.verdict) && <details className="compliance-disclosure"><summary><span>Propose equality precedent</span><ChevronDown aria-hidden="true" /></summary><form onSubmit={(event) => proposePrecedent(event, check)}><label>Title<input name="title" minLength={5} required placeholder="Accepted equivalent condition" /></label><label>Cited rationale<textarea name="rationale" minLength={20} required placeholder="Explain equivalence against both citations." /></label><button className="button button-secondary" disabled={saving}>Propose precedent</button></form></details>}
    </article>;
  }

  return <div className="compliance-workbench">
    <section className="compliance-command surface" aria-labelledby="run-compliance-heading"><div className="command-copy"><span className="eyebrow">Compliance workspace</span><h2 id="run-compliance-heading">Compare evidence, then decide</h2><p>Run one cited comparison or scan all accepted requirements. Every result stays proposed until an engineer reviews it.</p></div><div className="command-stats" aria-label="Compliance summary"><span><strong>{requirements.length}</strong> requirements</span><span><strong>{regions.length}</strong> target lines</span><span><strong>{proposedCount}</strong> awaiting review</span></div><button type="button" className="button button-secondary scan-button" disabled={saving || !requirements.length} onClick={scanForDeviations}><ShieldCheck aria-hidden="true" />Scan all requirements</button></section>
    <details className="surface compliance-validation"><summary><div><span className="eyebrow">Controlled validation</span><h2>Comparator quality gate</h2><p>{validation.passed} of {validation.cases} labelled fixture cases pass across numeric, boolean, categorical and narrative decisions.</p></div><ChevronDown aria-hidden="true" /></summary><div className="validation-body"><div className="validation-metrics"><span><small>Accuracy</small><strong>{Math.round(validation.metrics.accuracy * 100)}%</strong></span><span><small>Precision</small><strong>{Math.round(validation.metrics.precision * 100)}%</strong></span><span><small>Recall</small><strong>{Math.round(validation.metrics.recall * 100)}%</strong></span><span><small>F1</small><strong>{validation.metrics.f1.toFixed(2)}</strong></span></div><aside className="compliance-notice warning"><strong>Evidence boundary</strong><p>This is a controlled engineering fixture, not a production accuracy claim. Replace or supplement it with an independently labelled project set before release.</p></aside>{validation.failures.length > 0 && <div className="validation-failures"><strong>Failed cases</strong>{validation.failures.map((failure) => <p key={failure.id}>{failure.id}: expected {label(failure.expected)}, received {label(failure.actual)}</p>)}</div>}</div></details>
    {message && <p className="surface compliance-message" role="status">{message}</p>}
    <section className="surface comparison-builder" aria-labelledby="comparison-heading"><header><FileCheck2 aria-hidden="true" /><div><h2 id="comparison-heading">New cited comparison</h2><p>Select a requirement and its implementation evidence.</p></div></header><form onSubmit={runCheck}><label><span>Accepted requirement</span><select name="requirementId" required>{requirements.map((item) => <option value={item.id} key={item.id}>{item.statement.slice(0, 140)}</option>)}</select></label><label className="target-picker"><span>Controlled target</span><div className="search-field"><Search aria-hidden="true" /><input aria-label="Search controlled target lines" type="search" value={targetQuery} onChange={(event) => setTargetQuery(event.target.value)} placeholder="Search drawing, equipment tag, or clause" /></div><select name="targetSourceRegionId" required size={Math.min(4, Math.max(2, visibleRegions.length))}>{visibleRegions.map((item) => <option value={item.id} key={item.id}>{item.documentType} / {item.documentTitle} / p.{item.pageNumber} / {item.text.slice(0, 120)}</option>)}</select><small>{visibleRegions.length} of {regions.length} eligible lines shown. Search to narrow.</small></label><details className="precedent-picker"><summary>Optional: apply an accepted equality precedent</summary><label><span>Exact-match precedent</span><select name="precedentId"><option value="">No precedent</option>{acceptedPrecedents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label></details><button className="button button-primary" disabled={saving || !requirements.length || !visibleRegions.length}>Run comparison</button></form>{(!requirements.length || !regions.length) && <div className="builder-empty">{!requirements.length ? "Accept at least one cited requirement. " : ""}{!regions.length ? "Add an approved drawing, submittal, shop drawing, or PO." : ""}</div>}</section>
    <section className="review-workspace" aria-labelledby="checks-heading"><header className="section-heading"><div><span className="eyebrow">Review queue</span><h2 id="checks-heading">Compliance proposals</h2></div><div className="queue-filters" aria-label="Filter proposals">{(["all", "proposed", "accepted"] as const).map((filter) => <button key={filter} type="button" className={queueFilter === filter ? "active" : ""} onClick={() => setQueueFilter(filter)}>{label(filter)}</button>)}</div></header>{checks.length ? <div className="review-split"><div className="proposal-list" role="list" aria-label="Compliance proposals">{filteredChecks.map((check) => <button role="listitem" type="button" key={check.id} className={selectedCheck?.id === check.id ? "proposal-row active" : "proposal-row"} onClick={() => setSelectedCheckId(check.id)}><span className={`proposal-state ${check.reviewState}`}>{label(check.reviewState)}</span><strong>{check.reason}</strong><small>{label(check.verdict)} / confidence {check.confidence}</small></button>)}{!filteredChecks.length && <p className="queue-empty">No proposals match this filter.</p>}</div><div className="surface review-detail-shell">{selectedCheck ? renderCheckDetail(selectedCheck) : <div className="empty-state"><h3>Select a proposal</h3><p>Choose an item from the queue to inspect its evidence.</p></div>}</div></div> : <article className="surface empty-state"><FileCheck2 aria-hidden="true" /><h3>No compliance checks yet</h3><p>Run a cited comparison above or scan all accepted requirements.</p></article>}</section>
    <details className="surface precedent-library"><summary><div><span className="eyebrow">Project knowledge</span><h2>Equality precedents</h2><p>{precedents.length} project-scoped precedent{precedents.length === 1 ? "" : "s"}. Open only when needed.</p></div><ChevronDown aria-hidden="true" /></summary><div className="precedent-list">{precedents.map((precedent) => <article key={precedent.id}><div className="status-row"><span className={`source-status ${precedent.reviewState === "proposed" ? "pending" : precedent.reviewState === "accepted" ? "ready" : "failed"}`}>{label(precedent.reviewState)}</span></div><h3>{precedent.title}</h3><p>{precedent.rationale}</p><div className="review-actions"><Link href={`/sources/regions/${requirementById.get(precedent.requirementId)?.sourceRegionId}`}>Requirement citation</Link><Link href={`/sources/regions/${precedent.targetSourceRegionId}`}>Target citation</Link></div>{precedent.reviewState === "proposed" && <form className="compliance-review-form" onSubmit={(event) => { event.preventDefault(); reviewPrecedent(event.currentTarget, precedent, "accept"); }}><label>Reviewer rationale<textarea name="note" required minLength={10} /></label><div className="review-actions"><button className="button button-primary" disabled={saving}>Accept</button><button type="button" className="button button-inverted" disabled={saving} onClick={(event) => { const form = event.currentTarget.form; if (form?.reportValidity()) reviewPrecedent(form, precedent, "reject"); }}>Reject</button></div></form>}</article>)}{!precedents.length && <p className="queue-empty">No equality precedents have been proposed.</p>}</div></details>
  </div>;
}
