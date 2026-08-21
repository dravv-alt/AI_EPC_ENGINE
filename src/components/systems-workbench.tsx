"use client";

import { FormEvent, useMemo, useState } from "react";
import { Boxes, ChevronRight, CircleGauge, Plus, Search, ServerCog } from "lucide-react";
import { useRouter } from "next/navigation";

type System = { id: string; name: string; systemType: string };
type Asset = { id: string; systemId: string; tag: string; assetType: string; vendor: string | null };
type Gate = { id: string; systemId: string; name: string; sequenceNumber: string; approvalRole: string; status: string };

async function submitJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "The record could not be saved.");
  return result;
}

const readable = (value: string) => value.replaceAll("_", " ");

export function SystemsWorkbench({ projectId, systems, assets, gates }: { projectId: string; systems: System[]; assets: Asset[]; gates: Gate[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(systems[0]?.id ?? "");
  const filteredSystems = useMemo(() => { const term = query.trim().toLowerCase(); return term ? systems.filter((system) => `${system.name} ${system.systemType}`.toLowerCase().includes(term)) : systems; }, [query, systems]);
  const selected = systems.find((system) => system.id === selectedId) ?? filteredSystems[0] ?? systems[0];
  const selectedAssets = selected ? assets.filter((asset) => asset.systemId === selected.id) : [];
  const selectedGates = selected ? gates.filter((gate) => gate.systemId === selected.id).sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)) : [];

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setSaving(true);
    try { await submitJson(`/api/projects/${projectId}/systems`, { name: values.get("name"), systemType: values.get("systemType") }); form.reset(); setMessage("System saved to the project database and audit chain."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create system."); } finally { setSaving(false); }
  }
  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setSaving(true);
    try { await submitJson(`/api/projects/${projectId}/assets`, { systemId: values.get("systemId"), tag: values.get("tag"), assetType: values.get("assetType"), vendor: values.get("vendor") }); form.reset(); setMessage("Asset saved against its selected parent system."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create asset."); } finally { setSaving(false); }
  }
  async function createGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); setSaving(true);
    try { await submitJson(`/api/projects/${projectId}/gates`, { systemId: values.get("systemId"), name: values.get("name"), sequenceNumber: Number(values.get("sequenceNumber")), approvalRole: values.get("approvalRole") }); form.reset(); setMessage("Gate saved in UNKNOWN state until controlled requirements are mapped."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create gate."); } finally { setSaving(false); }
  }

  return <div className="entity-workbench">
    <section className="db-summary" aria-label="Database record totals">
      <div><ServerCog size={17} /><span><small>Systems</small><strong>{systems.length}</strong></span></div>
      <div><Boxes size={17} /><span><small>Assets</small><strong>{assets.length}</strong></span></div>
      <div><CircleGauge size={17} /><span><small>Gates</small><strong>{gates.length}</strong></span></div>
      <p><span className="live-dot" /> Live project records</p>
    </section>
    <details className="surface record-composer">
      <summary><span><Plus size={16} /> Add controlled record</span><small>System, asset, or approval gate</small></summary>
      <div className="configuration-forms">
        <form className="compact-form" onSubmit={createSystem}><p className="eyebrow">System</p><h2>Create system</h2><label>Name<input name="name" required minLength={2} /></label><label>Type<input name="systemType" required minLength={2} /></label><button className="button button-primary" disabled={saving}>Create system</button></form>
        <form className="compact-form" onSubmit={createAsset}><p className="eyebrow">Asset</p><h2>Register equipment</h2><label>Parent system<select name="systemId" required disabled={!systems.length}><option value="">Select system</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select></label><label>Tag<input name="tag" required minLength={2} /></label><label>Asset type<input name="assetType" required minLength={2} /></label><label>Vendor<input name="vendor" /></label><button className="button button-primary" disabled={saving || !systems.length}>Register asset</button></form>
        <form className="compact-form" onSubmit={createGate}><p className="eyebrow">Gate</p><h2>Define approval gate</h2><label>Parent system<select name="systemId" required disabled={!systems.length}><option value="">Select system</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select></label><label>Gate name<input name="name" required minLength={2} /></label><label>Sequence<input name="sequenceNumber" type="number" min="0" required defaultValue="1" /></label><label>Approval authority<select name="approvalRole" defaultValue="approver"><option value="approver">Approver</option><option value="admin">Administrator</option><option value="commissioning_manager">Commissioning manager</option></select></label><button className="button button-primary" disabled={saving || !systems.length}>Create gate</button></form>
      </div>
    </details>
    {message && <p className="surface inline-feedback" role="status">{message}</p>}
    {!systems.length ? <section className="surface empty-state"><h2>No systems configured</h2><p>Create the first controlled system. No placeholder systems are displayed.</p></section> : <section className="surface master-detail systems-hierarchy">
      <aside className="master-list"><header><div><p className="eyebrow">Controlled hierarchy</p><h2>Systems</h2></div><span>{filteredSystems.length}</span></header><label className="record-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter systems" /></label><div className="master-list-scroll">{filteredSystems.map((system) => { const assetCount = assets.filter((asset) => asset.systemId === system.id).length; const gateCount = gates.filter((gate) => gate.systemId === system.id).length; return <button type="button" className={system.id === selected?.id ? "is-selected" : ""} key={system.id} onClick={() => setSelectedId(system.id)}><span><b>{system.name}</b><small>{readable(system.systemType)} · {assetCount} asset{assetCount === 1 ? "" : "s"} · {gateCount} gate{gateCount === 1 ? "" : "s"}</small></span><ChevronRight size={15} /></button>; })}</div></aside>
      {selected && <article className="record-detail"><header className="record-detail-header"><div><p className="eyebrow">{readable(selected.systemType)}</p><h2>{selected.name}</h2></div><span className="source-status processed">Database record</span></header>
        <div className="system-topology" aria-label={`${selected.name} hierarchy`}><div className="system-topology-root"><ServerCog size={19} /><span><small>Controlled system</small><b>{selected.name}</b></span></div><i /><div className="system-topology-branch"><span><Boxes size={17} /><small>Registered assets</small><b>{selectedAssets.length}</b></span><span><CircleGauge size={17} /><small>Approval gates</small><b>{selectedGates.length}</b></span></div></div>
        <section className="record-section"><header><h3>Assets</h3><span>{selectedAssets.length}</span></header>{selectedAssets.length ? <div className="data-table"><div className="data-row data-head"><span>Tag</span><span>Type</span><span>Vendor</span></div>{selectedAssets.map((asset) => <div className="data-row" key={asset.id}><b>{asset.tag}</b><span>{asset.assetType}</span><span>{asset.vendor || "—"}</span></div>)}</div> : <p className="empty-copy">No assets are registered to this system.</p>}</section>
        <section className="record-section"><header><h3>Approval gates</h3><span>{selectedGates.length}</span></header>{selectedGates.length ? <div className="data-table gates-table"><div className="data-row data-head"><span>Sequence / gate</span><span>Authority</span><span>Status</span></div>{selectedGates.map((gate) => <div className="data-row" key={gate.id}><b>{gate.sequenceNumber}. {gate.name}</b><span>{readable(gate.approvalRole)}</span><span className={`status-pill ${gate.status === "approved" || gate.status === "ready" ? "ready" : gate.status === "blocked" ? "blocked" : "review"}`}>{readable(gate.status)}</span></div>)}</div> : <p className="empty-copy">No approval gates are defined for this system.</p>}</section>
      </article>}
    </section>}
  </div>;
}
