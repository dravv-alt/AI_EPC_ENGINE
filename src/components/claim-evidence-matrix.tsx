"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, Plus, Sparkles } from "lucide-react";
import { claimDefaults, claimTaxonomy } from "@/lib/evidence/claim-taxonomy";
import { evidenceLabel } from "@/lib/evidence/taxonomy";

type EvidenceOption = { id: string; systemName: string; assetTag: string | null; evidenceType: string; validityState: string; capturedAt: string; aiDescription?: string | null; classificationProvider?: string | null };
type Claim = { id: string; claimType: string; metricKey: string; value: string | null; unit: string | null; statement: string; status: string; createdAt: string; evidenceIds: string[] };

export function ClaimEvidenceMatrix({ projectId, records }: { projectId: string; records: EvidenceOption[] }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimType, setClaimType] = useState("capex");
  const [metricKey, setMetricKey] = useState<string>(claimDefaults("capex").metricKey);
  const [unit, setUnit] = useState<string>(claimDefaults("capex").unit);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const usableRecords = useMemo(() => records.filter((record) => record.validityState !== "rejected"), [records]);

  async function loadClaims() {
    const response = await fetch(`/api/projects/${projectId}/claims`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setClaims(body.claims ?? []);
  }
  useEffect(() => { void loadClaims(); }, [projectId]);

  function changeClaimType(nextType: string) {
    const defaults = claimDefaults(nextType);
    setClaimType(nextType); setMetricKey(defaults.metricKey); setUnit(defaults.unit);
  }
  function toggleEvidence(id: string) { setSelectedEvidenceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  async function saveClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEvidenceIds.length) return setMessage("Select at least one real evidence record to support this claim.");
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("Saving the proposed claim and its evidence links…");
    try {
      const rawValue = String(form.get("value") ?? "").trim();
      const response = await fetch(`/api/projects/${projectId}/claims`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimType, metricKey, unit, value: rawValue ? Number(rawValue) : undefined, statement: form.get("statement"), evidenceIds: selectedEvidenceIds }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save claim.");
      event.currentTarget.reset(); setSelectedEvidenceIds([]); setMessage("Proposed claim saved. It is source-linked but does not change readiness or model inputs."); await loadClaims();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save claim."); } finally { setBusy(false); }
  }

  return <section className="surface claim-matrix" aria-labelledby="claim-matrix-title">
    <header className="claim-matrix-heading"><div><p className="eyebrow">Controlled linkage</p><h2 id="claim-matrix-title"><FileText size={19} /> Claim-to-evidence matrix</h2><p>Record one data-center claim against the evidence that supports it. Claims are proposed until their supporting evidence is reviewed; they never certify a result on their own.</p></div><span className="status-pill review">{claims.length} proposed</span></header>
    <div className="claim-matrix-grid">
      <form className="claim-form" onSubmit={saveClaim} aria-busy={busy}>
        <div className="claim-fields"><label>Claim type<select value={claimType} onChange={(event) => changeClaimType(event.target.value)} disabled={busy}>{claimTaxonomy.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Metric key<input value={metricKey} onChange={(event) => setMetricKey(event.target.value)} required disabled={busy} /></label><label>Value <input name="value" inputMode="decimal" type="number" step="any" placeholder="Optional" disabled={busy} /></label><label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={40} disabled={busy} /></label></div>
        <p className="claim-help">{claimDefaults(claimType).help}</p>
        <label>Claim statement<textarea name="statement" required minLength={12} maxLength={4000} disabled={busy} placeholder="State the claimed impact, value, conditions, and why the linked evidence supports it." /></label>
        <fieldset className="evidence-selector" disabled={busy}><legend>Supporting evidence <span>{selectedEvidenceIds.length} selected</span></legend>{usableRecords.length ? usableRecords.map((record) => <label className={selectedEvidenceIds.includes(record.id) ? "evidence-choice selected" : "evidence-choice"} key={record.id}><input type="checkbox" checked={selectedEvidenceIds.includes(record.id)} onChange={() => toggleEvidence(record.id)} /><span><b>{evidenceLabel(record.evidenceType)}</b><small>{record.assetTag || record.systemName} · {record.id.slice(0, 8)} · {record.validityState}</small>{record.aiDescription && <em><Sparkles size={12} /> {record.aiDescription}</em>}</span></label>) : <p className="empty-copy">Capture evidence first. Rejected records cannot be linked.</p>}</fieldset>
        <button className="button button-primary" disabled={busy || !usableRecords.length}>{busy ? <LoaderCircle className="button-spinner" size={16} /> : <Plus size={16} />} Save proposed claim</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
      <div className="claim-register"><header><p className="eyebrow">Saved matrix</p><h3>Claims already linked</h3></header>{claims.length ? claims.map((claim) => <article key={claim.id}><div><span className="status-pill review">{claim.status}</span><b>{claimTaxonomy.find((item) => item.value === claim.claimType)?.label ?? claim.claimType}</b></div><h4>{claim.statement}</h4><p><code>{claim.metricKey}</code>{claim.value !== null ? ` · ${claim.value}${claim.unit ? ` ${claim.unit}` : ""}` : " · narrative"}</p><small>{claim.evidenceIds.length} evidence record{claim.evidenceIds.length === 1 ? "" : "s"} linked · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(claim.createdAt))}</small></article>) : <div className="empty-state compact"><h3>No proposed claims yet</h3><p>Choose evidence from this project, then create the first source-linked claim.</p></div>}</div>
    </div>
  </section>;
}
