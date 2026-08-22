"use client";

import Link from "next/link";
import { Check, ChevronDown, ClipboardCheck, Copy, FileText, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type RequirementReviewRow = {
  id: string;
  statement: string;
  displayTitle: string | null;
  displaySummary: string | null;
  presentationProvider: string | null;
  modality: string;
  comparisonModality: string | null;
  numericValue: string | null;
  unit: string | null;
  tolerance: string | null;
  confidence: string | null;
  reviewState: string;
  reviewNote: string | null;
  regionId: string;
  documentTitle: string;
  revision: string;
  pageNumber: string;
  contentHash: string;
};

const editableStates = new Set(["proposed", "edited"]);
const words = (value: string | null, fallback: string, count: number) => (value || fallback).replace(/\s+/g, " ").trim().split(" ").slice(0, count).join(" ");

export function RequirementsWorkbench({ rows }: { rows: RequirementReviewRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const accepted = rows.filter((row) => row.reviewState === "accepted");
  const groups = [...rows.reduce((map, row) => {
    const key = `${row.documentTitle}\u0000${row.revision}`;
    const current = map.get(key) ?? { title: row.documentTitle, revision: row.revision, rows: [] as RequirementReviewRow[] };
    current.rows.push(row); map.set(key, current); return map;
  }, new Map<string, { title: string; revision: string; rows: RequirementReviewRow[] }>()).values()];

  async function review(row: RequirementReviewRow, action: "accept" | "reject" | "edit" | "duplicate", values: Record<string, unknown> = {}) {
    setBusy(row.id); setMessage(null);
    try {
      const response = await fetch(`/api/requirements/${row.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...values }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Review could not be saved.");
      setEditing(null); setMessage(`Requirement ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : action === "duplicate" ? "marked as duplicate" : "updated"}.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(null); }
  }

  return <section className="requirements-workbench" aria-label="Requirement review queue">
    <header className="requirements-workbench-header"><div><p className="eyebrow">Controlled review queue</p><h2>Requirements by source document</h2><p>Titles and summaries are concise review aids. The expanded corpus and exact citation remain the controlled record.</p></div><span>{rows.length} records · {groups.length} sources</span></header>
    <aside className="requirements-classification-note"><b>How requirements are classified</b><span>A requirement is a source-cited obligation. We record its strength (shall / must / should / may) and comparison type (numeric, boolean, categorical, or narrative). Only an accepted requirement can affect readiness.</span></aside>
    {message && <p className="pm-inline-message" role="status">{message}</p>}
    <div className="requirement-document-groups">{groups.map((group) => <details className="requirement-document-group" open key={`${group.title}:${group.revision}`}>
      <summary><span className="requirement-document-icon"><FileText size={17} /></span><span><b>{group.title}</b><small>{group.revision} · {group.rows.length} requirement{group.rows.length === 1 ? "" : "s"}</small></span><span className="requirement-document-states"><i>{group.rows.filter((row) => editableStates.has(row.reviewState)).length} to review</i><ChevronDown size={17} /></span></summary>
      <div className="requirement-table" role="table" aria-label={`${group.title} requirements`}>
        <div className="requirement-table-head" role="row"><span>Requirement</span><span>Summary</span><span>Reference</span><span>State</span><span>Actions</span></div>
        {group.rows.map((row) => <details className="requirement-row" key={row.id}>
          <summary className="requirement-row-summary" role="row">
            <span className="requirement-cell requirement-title"><b>{words(row.displayTitle, row.statement, 9)}</b><small>{row.modality} · {row.comparisonModality ?? "narrative"}</small></span>
            <span className="requirement-cell requirement-summary">{words(row.displaySummary, row.statement, 28)}</span>
            <span className="requirement-cell requirement-reference"><Link href={`/sources/regions/${row.regionId}`} onClick={(event) => event.stopPropagation()}>p. {row.pageNumber} <span>Open citation</span></Link></span>
            <span className="requirement-cell"><i className={`pm-status-chip status-${row.reviewState}`}>{row.reviewState}</i></span>
            <span className="requirement-cell requirement-actions">{editableStates.has(row.reviewState) ? <><button type="button" className="row-icon-action" title="Reject requirement" disabled={busy === row.id} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void review(row, "reject"); }}><X size={16} /></button><button type="button" className="row-icon-action" title="Edit requirement" disabled={busy === row.id} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setEditing(row.id); (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.setAttribute("open", ""); }}><Pencil size={15} /></button><button type="button" className="row-icon-action row-accept-action" title="Accept requirement" disabled={busy === row.id} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void review(row, "accept"); }}><Check size={16} /></button></> : <span className="row-complete">Reviewed</span>}</span>
          </summary>
          <div className="requirement-expanded">
            <section><span className="eyebrow">Controlled corpus</span><p>{row.statement}</p></section>
            <aside><dl><div><dt>Exact source</dt><dd><Link href={`/sources/regions/${row.regionId}`}>{row.documentTitle} · {row.revision} · page {row.pageNumber}</Link></dd></div><div><dt>Confidence</dt><dd>{row.confidence ?? "Not scored"}</dd></div><div><dt>Presentation</dt><dd>{row.presentationProvider ?? "Source-derived"}</dd></div></dl>{row.reviewNote && <p className="review-note">Reviewer rationale: {row.reviewNote}</p>}</aside>
            {editing === row.id && <RequirementEditForm row={row} busy={busy === row.id} accepted={accepted.filter((item) => item.id !== row.id)} onCancel={() => setEditing(null)} onSave={(values) => review(row, "edit", values)} onDuplicate={(duplicateOfRequirementId, note) => review(row, "duplicate", { duplicateOfRequirementId, note })} />}
          </div>
        </details>)}
      </div>
    </details>)}</div>
    {!rows.length && <article className="surface empty-state"><ClipboardCheck size={22} /><h3>No requirement proposals</h3><p>Extract a controlled source to produce cited proposals for review.</p></article>}
  </section>;
}

function RequirementEditForm({ row, accepted, busy, onCancel, onSave, onDuplicate }: { row: RequirementReviewRow; accepted: RequirementReviewRow[]; busy: boolean; onCancel: () => void; onSave: (values: Record<string, unknown>) => void; onDuplicate: (id: string, note: string) => void }) {
  const [title, setTitle] = useState(words(row.displayTitle, row.statement, 9));
  const [summary, setSummary] = useState(words(row.displaySummary, row.statement, 28));
  const [statement, setStatement] = useState(row.statement);
  const [numericValue, setNumericValue] = useState(row.numericValue ?? "");
  const [unit, setUnit] = useState(row.unit ?? "");
  const [tolerance, setTolerance] = useState(row.tolerance ?? "");
  const [note, setNote] = useState("");
  const [duplicateId, setDuplicateId] = useState(accepted[0]?.id ?? "");
  return <form className="requirement-edit-form" onSubmit={(event) => { event.preventDefault(); onSave({ displayTitle: title, displaySummary: summary, statement, numericValue: numericValue === "" ? undefined : Number(numericValue), unit: unit || undefined, tolerance: tolerance === "" ? undefined : Number(tolerance), note: note || undefined }); }}>
    <label>Review title <small>{title.trim().split(/\s+/).filter(Boolean).length}/9 words</small><input maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
    <label>Short summary <small>{summary.trim().split(/\s+/).filter(Boolean).length}/28 words</small><textarea maxLength={280} value={summary} onChange={(event) => setSummary(event.target.value)} required /></label>
    <label className="requirement-edit-corpus">Controlled statement<textarea value={statement} onChange={(event) => setStatement(event.target.value)} required /></label>
    <label>Numeric value<input type="number" step="any" value={numericValue} onChange={(event) => setNumericValue(event.target.value)} /></label><label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label><label>Tolerance<input type="number" min="0" step="any" value={tolerance} onChange={(event) => setTolerance(event.target.value)} /></label><label>Review rationale<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is this correction correct?" /></label>
    <div className="requirement-edit-actions"><button type="button" className="button button-outline" onClick={onCancel}>Cancel</button>{accepted.length > 0 && <><select value={duplicateId} onChange={(event) => setDuplicateId(event.target.value)} aria-label="Accepted duplicate target">{accepted.map((item) => <option value={item.id} key={item.id}>{words(item.displayTitle, item.statement, 9)}</option>)}</select><button type="button" className="button button-outline" disabled={busy || !duplicateId} onClick={() => onDuplicate(duplicateId, note)}><Copy size={15} /> Mark duplicate</button></>}<button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save edited proposal"}</button></div>
  </form>;
}
