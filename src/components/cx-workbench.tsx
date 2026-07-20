"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Download, FileText, FlaskConical, RefreshCw, ShieldAlert, Upload } from "lucide-react";
import { formatMeasurement } from "@/lib/presentation";

type System = { id: string; name: string };
type Gate = { id: string; systemId: string; name: string };
type Asset = { id: string; systemId: string; tag: string; assetType: string };
type Standard = { id: string; title: string; standardSet: string; documentType: string; revision: string; extractionStatus: string; extractionError: string | null; regionCount: number };
type Checklist = { id: string; title: string; status: string; standardVersionIds: unknown; generationStatus: string; generationJobId: string | null; generationError: string | null; generationModelVersion: string; reviewNote: string | null };
type Step = { id: string; checklistId: string; sequenceNumber: string; instruction: string; modality: string; parameter: string | null; nominalValue: string | null; unit: string | null; tolerance: string | null; expectedBoolean: boolean | null; narrativeCriterion: string | null; required: boolean; reviewState: string };
type Citation = { id: string; checklistId: string; stepId: string | null; clauseReference: string; sourceRegionId: string | null; verificationStatus: string; verificationReason: string | null };
type RecordRow = { id: string; checklistId: string; overallStatus: string; reportStatus: string; reportGenerationStatus: string; reportGenerationJobId: string | null; reportGenerationError: string | null; reportModelVersion: string | null; reportContent: unknown; reportContentHash: string | null; evidenceId: string | null; reportReviewNote: string | null };
type ResultRow = { id: string; testRecordId: string; stepId: string; readingValue: string | null; readingBoolean: boolean | null; readingText: string | null; verdict: string; findingId: string | null; enteredAt: Date | string };
type ReportContent = { title: string; executiveSummary: string; conclusion: string; label: string; steps: Array<{ stepId: string; instruction: string; reading: string | number | boolean | null; verdict: string; citations: Array<{ sourceRegionId: string; clauseReference: string; verificationStatus: string }> }>; deviations: Array<{ stepId: string; verdict: string; findingId: string | null }> };

export function CxWorkbench(props: { projectId: string; systems: System[]; gates: Gate[]; assets: Asset[]; standards: Standard[]; checklists: Checklist[]; steps: Step[]; citations: Citation[]; records: RecordRow[]; results: ResultRow[] }) {
  const { projectId, systems, gates, assets, standards, checklists, steps, citations, records, results } = props;
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function pollJob(jobId: string, label: string) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `${label} job could not be read.`);
      if (body.job.status === "completed") return body.job;
      if (body.job.status === "failed") throw new Error(`${label} failed: ${body.job.error ?? "unknown worker error"} (job ${jobId})`);
      setMessage(`${label} is running… (${Math.min(attempt + 1, 120)} checks)`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${label} is still processing. Job ${jobId} can be checked again.`);
  }

  async function uploadStandard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("Controlling and extracting the standard…");
    const form = event.currentTarget;
    const response = await fetch(`/api/projects/${projectId}/cx/standards`, { method: "POST", body: new FormData(form) });
    const body = await response.json();
    try {
      if (!response.ok) throw new Error(body.error ?? "Standard upload failed.");
      if (body.extractionStatus === "processing") await pollJob(body.ingestJobId, "Standards extraction");
      form.reset(); setMessage("Controlled standard extracted with citation regions. It can now govern a checklist."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Standard upload failed."); }
    finally { setBusy(false); }
  }

  async function createChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget); setMessage("Generating a schema-validated cited draft…");
    const response = await fetch(`/api/projects/${projectId}/cx/checklists`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), systemId: form.get("systemId"), gateId: form.get("gateId"), assetId: form.get("assetId"), standardVersionIds: form.getAll("standardVersionIds") }) });
    const body = await response.json();
    try {
      if (!response.ok) throw new Error(body.error ?? "Checklist generation could not start.");
      if (body.status === "queued") await pollJob(body.checklistJobId, "Checklist generation");
      setMessage("Draft generated. Every step is still advisory and requires engineer acceptance."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checklist generation failed."); }
    finally { setBusy(false); }
  }

  async function reviewChecklist(checklistId: string, action: "accept" | "edit" | "reject", note: string, stepEdits: Array<Record<string, unknown>> = []) {
    setBusy(true);
    const response = await fetch(`/api/cx/checklists/${checklistId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, note, steps: stepEdits }) });
    const body = await response.json(); setBusy(false); setMessage(response.ok ? action === "accept" ? "Checklist accepted for controlled execution." : action === "reject" ? "Draft rejected and retained for audit." : "Step edits saved; a separate engineer acceptance is still required." : body.error ?? "Checklist review failed."); if (response.ok) router.refresh();
  }

  async function editStep(checklistId: string, step: Step, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const edit: Record<string, unknown> = { id: step.id, instruction: form.get("instruction"), required: form.get("required") === "on" };
    if (step.modality === "numeric") { edit.nominalValue = Number(form.get("nominalValue")); edit.tolerance = Number(form.get("tolerance")); }
    if (step.modality === "boolean") edit.expectedBoolean = form.get("expectedBoolean") === "true";
    if (step.modality === "narrative") edit.narrativeCriterion = form.get("narrativeCriterion");
    await reviewChecklist(checklistId, "edit", String(form.get("note")), [edit]);
  }

  async function reading(checklistId: string, step: Step, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const payload = step.modality === "numeric" ? { value: Number(form.get("reading")) } : step.modality === "boolean" ? { boolean: form.get("reading") === "true" } : { text: form.get("reading") }; setBusy(true);
    const response = await fetch(`/api/cx/checklists/${checklistId}/steps/${step.id}/reading`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const body = await response.json(); setBusy(false); setMessage(response.ok ? `${body.label}; overall record state is ${body.overallStatus.replaceAll("_", " ")}.` : body.error ?? "Reading could not be recorded."); if (response.ok) router.refresh();
  }

  async function draftReport(recordId: string) {
    setBusy(true); setMessage("Drafting a factual report around immutable readings…"); const response = await fetch(`/api/cx/test-records/${recordId}/report`, { method: "POST" }); const body = await response.json();
    try { if (!response.ok) throw new Error(body.error ?? "Report draft failed."); if (body.status === "queued") await pollJob(body.reportJobId, "Report drafting"); setMessage("Editable draft ready. It remains pending engineer review."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Report draft failed."); }
    finally { setBusy(false); }
  }

  async function saveReport(recordId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); const response = await fetch(`/api/cx/reports/${recordId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: form.get("title"), executiveSummary: form.get("executiveSummary"), conclusion: form.get("conclusion"), reason: form.get("reason") }) }); const body = await response.json(); setBusy(false); setMessage(response.ok ? "Draft edits saved with reviewer attribution." : body.error ?? "Report edit failed."); if (response.ok) router.refresh();
  }

  async function approveReport(recordId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); const response = await fetch(`/api/cx/test-records/${recordId}/report/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: form.get("reason") }) }); const body = await response.json(); setBusy(false); setMessage(response.ok ? `Engineer-approved artifact ${body.artifactHash.slice(0, 12)}… materialized as accepted evidence; gate moved to in review.` : body.error ?? "Report approval failed."); if (response.ok) router.refresh();
  }

  async function openArtifact(recordId: string) {
    const response = await fetch(`/api/cx/reports/${recordId}`); const body = await response.json(); if (!response.ok || !body.artifactUrl) return setMessage(body.error ?? "Approved artifact is unavailable."); window.open(body.artifactUrl, "_blank", "noopener,noreferrer");
  }

  const usableStandards = standards.filter((standard) => standard.extractionStatus === "completed" && standard.regionCount > 0);
  return <div className="workflow-stack">
    <section className="cx-setup-grid">
      <form className="surface cx-setup-card" onSubmit={uploadStandard}><div><p className="eyebrow">1 · Controlled corpus</p><h2>Ingest standards/procedures</h2><p>Checklist generation remains disabled until extraction creates exact citation regions.</p></div><label>Standard set<input name="standardSet" required minLength={2} placeholder="ASHRAE / project IST set" /></label><label>Title<input name="title" required minLength={3} placeholder="Synthetic chilled-water IST standard" /></label><label>Document type<select name="documentType"><option value="standard">Standard</option><option value="procedure">Procedure</option></select></label><label>Revision<input name="revision" required placeholder="Rev 1" /></label><label>PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label><button className="button button-primary" disabled={busy}><Upload size={16} />Control & extract</button></form>
      <form className="surface cx-setup-card" onSubmit={createChecklist}><div><p className="eyebrow">2 · Advisory generation</p><h2>Generate cited draft</h2><p>{usableStandards.length ? `${usableStandards.length} extracted standard version(s) available.` : "No completed standard with citation regions is available."}</p></div><label>Title<input name="title" required minLength={3} placeholder="L4 integrated systems test" /></label><label>System<select name="systemId" required><option value="">Select system</option>{systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Gate<select name="gateId" required><option value="">Select gate</option>{gates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Equipment<select name="assetId" required><option value="">Select equipment</option>{assets.map((item) => <option key={item.id} value={item.id}>{item.tag} · {item.assetType}</option>)}</select></label><label>Governing standard versions<select name="standardVersionIds" multiple size={Math.min(5, Math.max(2, usableStandards.length))} required>{usableStandards.map((item) => <option key={item.id} value={item.id}>{item.standardSet} · {item.title} · {item.revision}</option>)}</select></label><button className="button button-primary" disabled={busy || !usableStandards.length || !systems.length || !gates.length || !assets.length}><FlaskConical size={16} />Generate draft</button></form>
    </section>
    {message && <p className="surface inline-feedback" role="status">{busy && <span className="operation-progress" aria-hidden="true" />}{message}</p>}
    <details className="surface history-panel"><summary>Controlled standards ({standards.length})</summary><div className="workflow-grid">{standards.map((standard) => <article className="standard-card" key={standard.id}><span className={`source-status ${standard.extractionStatus === "completed" && standard.regionCount ? "processed" : "pending"}`}>{standard.extractionStatus}</span><b>{standard.standardSet} · {standard.title}</b><small>{standard.documentType} · {standard.revision} · {standard.regionCount} citation region(s)</small>{standard.extractionError && <p className="validation-flag">{standard.extractionError}</p>}</article>)}</div></details>
    {checklists.map((checklist) => {
      const checklistSteps = steps.filter((step) => step.checklistId === checklist.id); const checklistCitations = citations.filter((citation) => citation.checklistId === checklist.id); const record = records.find((item) => item.checklistId === checklist.id); const report = record?.reportContent as ReportContent | null;
      return <article className="surface cx-checklist" key={checklist.id}><header><div><span className={`source-status ${checklist.status === "accepted" ? "processed" : "pending"}`}>{checklist.status}</span><h2>{checklist.title}</h2><p>{checklist.generationStatus === "completed" ? `Advisory draft by ${checklist.generationModelVersion}` : `Generation ${checklist.generationStatus}${checklist.generationJobId ? ` · job ${checklist.generationJobId}` : ""}`}</p></div>{checklist.generationStatus === "failed" && <div className="infeasibility-banner"><ShieldAlert size={18} /><div><b>Draft rejected</b><p>{checklist.generationError}</p></div></div>}</header>
        {checklist.generationStatus === "completed" && <div className="cx-step-list">{checklistSteps.map((step) => { const stepCitations = checklistCitations.filter((citation) => citation.stepId === step.id); const result = record ? results.find((item) => item.testRecordId === record.id && item.stepId === step.id) : null; return <section className="cx-controlled-step" key={step.id}><div className="cx-step-heading"><span className="eyebrow">Step {step.sequenceNumber} · {step.modality} · {step.required ? "required" : "optional"}</span>{result && <span className={`status-pill ${result.verdict === "proposed_pass" ? "ready" : result.verdict === "proposed_fail" ? "blocked" : "review"}`}>{result.verdict.replaceAll("_", " ")}</span>}</div><p>{step.instruction}</p>{step.modality === "numeric" && <small>Criterion: {formatMeasurement(step.nominalValue)} {step.unit} ± {formatMeasurement(step.tolerance)}</small>}{step.modality === "boolean" && <small>Expected: {String(step.expectedBoolean)}</small>}{step.modality === "narrative" && <small>Human-review criterion: {step.narrativeCriterion}</small>}<div className="citation-strip">{stepCitations.map((citation) => citation.sourceRegionId ? <Link href={`/sources/regions/${citation.sourceRegionId}`} key={citation.id}><BookOpen size={13} />{citation.clauseReference}<span>{citation.verificationStatus}</span></Link> : <span className="validation-flag" key={citation.id}>Possible hallucination · no controlled region</span>)}</div>
          {checklist.status === "draft" && <form className="cx-edit-step" onSubmit={(event) => editStep(checklist.id, step, event)}><label>Instruction<textarea name="instruction" defaultValue={step.instruction} required /></label>{step.modality === "numeric" && <><label>Nominal<input name="nominalValue" type="number" step="any" defaultValue={step.nominalValue ?? ""} required /></label><label>Tolerance<input name="tolerance" type="number" min="0" step="any" defaultValue={step.tolerance ?? ""} required /></label></>}{step.modality === "boolean" && <label>Expected<select name="expectedBoolean" defaultValue={String(step.expectedBoolean)}><option value="true">True / present</option><option value="false">False / absent</option></select></label>}{step.modality === "narrative" && <label>Review criterion<textarea name="narrativeCriterion" defaultValue={step.narrativeCriterion ?? ""} required /></label>}<label className="check-label"><input name="required" type="checkbox" defaultChecked={step.required} />Required</label><label>Engineering edit reason<input name="note" minLength={5} required /></label><button className="button button-secondary" disabled={busy}>Save edits</button></form>}
          {checklist.status === "accepted" && <form className="cx-reading" onSubmit={(event) => reading(checklist.id, step, event)}>{step.modality === "boolean" ? <select name="reading" defaultValue={result?.readingBoolean === null || result?.readingBoolean === undefined ? "true" : String(result.readingBoolean)}><option value="true">Present / true</option><option value="false">Absent / false</option></select> : <input name="reading" type={step.modality === "numeric" ? "number" : "text"} step="any" defaultValue={result?.readingValue ?? result?.readingText ?? ""} required />}<button className="button button-secondary" disabled={busy}>{result ? "Update recorded reading" : "Record proposed result"}</button>{result && <small>Entered {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(result.enteredAt))}{result.findingId ? ` · finding ${result.findingId}` : ""}</small>}</form>}
        </section>; })}</div>}
        {checklist.status === "draft" && checklist.generationStatus === "completed" && <div className="cx-review-bar"><form onSubmit={(event) => { event.preventDefault(); void reviewChecklist(checklist.id, "accept", String(new FormData(event.currentTarget).get("note"))); }}><input name="note" minLength={5} placeholder="Engineer acceptance rationale" required /><button className="button button-primary" disabled={busy}><CheckCircle2 size={16} />Accept all cited steps</button></form><form onSubmit={(event) => { event.preventDefault(); void reviewChecklist(checklist.id, "reject", String(new FormData(event.currentTarget).get("note"))); }}><input name="note" minLength={5} placeholder="Rejection rationale" required /><button className="button button-outline" disabled={busy}>Reject draft</button></form></div>}
        {record && <section className="cx-report"><header><div><p className="eyebrow">3 · Governed report</p><h2>Test record</h2><p>Overall proposed state: {record.overallStatus.replaceAll("_", " ")} · Report: {record.reportGenerationStatus}</p></div>{record.reportStatus === "approved" ? <span className="status-pill ready">Engineer approved</span> : <span className="status-pill review">Draft — pending engineer review</span>}</header>{record.reportGenerationError && <div className="validation-flag">{record.reportGenerationError}</div>}{record.reportGenerationStatus === "not_started" || record.reportGenerationStatus === "failed" ? <button className="button button-primary" disabled={busy} onClick={() => draftReport(record.id)}><FileText size={16} />Draft report from readings</button> : record.reportGenerationStatus !== "completed" ? <p className="workflow-hint"><RefreshCw size={13} /> Report job {record.reportGenerationJobId} is {record.reportGenerationStatus}.</p> : null}
          {report && record.reportStatus === "draft" && <form className="cx-report-editor" onSubmit={(event) => saveReport(record.id, event)}><div className="draft-label">DRAFT — PENDING ENGINEER REVIEW</div><label>Report title<input name="title" defaultValue={report.title} required /></label><label>Executive summary<textarea name="executiveSummary" defaultValue={report.executiveSummary} required /></label><label>Conclusion<textarea name="conclusion" defaultValue={report.conclusion} required /></label><label>Edit rationale<input name="reason" minLength={5} required placeholder="What did the engineer correct?" /></label><button className="button button-secondary" disabled={busy}>Save reviewed draft</button></form>}
          {report && record.reportStatus === "draft" && <form className="cx-approval" onSubmit={(event) => approveReport(record.id, event)}><p>Approval is allowed only when every required step is recorded and no deterministic proposed failure remains. Narrative criteria are resolved by the engineer’s explicit reason.</p><label>Engineer approval reason<textarea name="reason" minLength={12} required /></label><button className="button button-primary" disabled={busy}>Approve immutable artifact & evidence</button></form>}
          {record.reportStatus === "approved" && <div className="approved-artifact"><CheckCircle2 size={20} /><div><b>Immutable Cx evidence created</b><p>Evidence {record.evidenceId} · SHA-256 {record.reportContentHash}</p></div><button className="button button-secondary" onClick={() => openArtifact(record.id)}><Download size={15} />Open signed artifact</button></div>}
        </section>}
      </article>;
    })}
    {!checklists.length && <div className="surface empty-state"><h2>No Cx checklist yet</h2><p>Ingest a controlled standard first. Generation is unavailable until its extraction job creates citation regions.</p></div>}
  </div>;
}
