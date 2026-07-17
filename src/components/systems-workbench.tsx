"use client";

import { FormEvent, useState } from "react";
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

export function SystemsWorkbench({ projectId, systems, assets, gates }: { projectId: string; systems: System[]; assets: Asset[]; gates: Gate[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function createSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      await submitJson(`/api/projects/${projectId}/systems`, { name: values.get("name"), systemType: values.get("systemType") });
      form.reset(); setMessage("System created and written to the audit chain."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create system."); }
    finally { setSaving(false); }
  }

  async function createAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      await submitJson(`/api/projects/${projectId}/assets`, { systemId: values.get("systemId"), tag: values.get("tag"), assetType: values.get("assetType"), vendor: values.get("vendor") });
      form.reset(); setMessage("Asset registered against its parent system."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create asset."); }
    finally { setSaving(false); }
  }

  async function createGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    try {
      await submitJson(`/api/projects/${projectId}/gates`, { systemId: values.get("systemId"), name: values.get("name"), sequenceNumber: Number(values.get("sequenceNumber")), approvalRole: values.get("approvalRole") });
      form.reset(); setMessage("Gate created in UNKNOWN state until controlled requirements are mapped."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create gate."); }
    finally { setSaving(false); }
  }

  return <div className="workflow-stack">
    <section className="configuration-forms">
      <form className="surface compact-form" onSubmit={createSystem}>
        <div><p className="eyebrow">1 · System</p><h2>Create a controlled system</h2></div>
        <label>Name<input name="name" required minLength={2} placeholder="Chilled Water" /></label>
        <label>Type<input name="systemType" required minLength={2} placeholder="cooling" /></label>
        <button className="button button-primary" disabled={saving}>Create system</button>
      </form>
      <form className="surface compact-form" onSubmit={createAsset}>
        <div><p className="eyebrow">2 · Asset</p><h2>Register equipment</h2></div>
        <label>Parent system<select name="systemId" required disabled={!systems.length}><option value="">Select system</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select></label>
        <label>Tag<input name="tag" required minLength={2} placeholder="CHWP-02" /></label>
        <label>Asset type<input name="assetType" required minLength={2} placeholder="Pump" /></label>
        <label>Vendor<input name="vendor" placeholder="Optional" /></label>
        <button className="button button-primary" disabled={saving || !systems.length}>Register asset</button>
      </form>
      <form className="surface compact-form" onSubmit={createGate}>
        <div><p className="eyebrow">3 · Gate</p><h2>Define approval gate</h2></div>
        <label>Parent system<select name="systemId" required disabled={!systems.length}><option value="">Select system</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select></label>
        <label>Gate name<input name="name" required minLength={2} placeholder="L4 Integrated Systems Test" /></label>
        <label>Sequence<input name="sequenceNumber" type="number" min="0" required defaultValue="1" /></label>
        <label>Approval authority<select name="approvalRole" defaultValue="approver"><option value="approver">Approver</option><option value="admin">Administrator</option><option value="commissioning_manager">Commissioning manager</option></select></label>
        <button className="button button-primary" disabled={saving || !systems.length}>Create gate</button>
      </form>
    </section>
    {message && <p className="surface inline-feedback" role="status">{message}</p>}
    {!systems.length ? <section className="surface empty-state"><h2>No systems configured</h2><p>Create the first controlled system above. Readiness stays UNKNOWN until a gate and accepted requirements exist.</p></section> : systems.map((system) => <article className="surface system-card" key={system.id}>
      <header><div><p className="eyebrow">{system.systemType}</p><h2>{system.name}</h2></div><span className="source-status processed">controlled</span></header>
      <div className="system-columns">
        <section><h3>Assets</h3>{assets.filter((asset) => asset.systemId === system.id).map((asset) => <div className="entity-row" key={asset.id}><b>{asset.tag}</b><span>{asset.assetType}{asset.vendor ? ` · ${asset.vendor}` : ""}</span></div>)}{!assets.some((asset) => asset.systemId === system.id) && <p className="workflow-hint">No registered assets.</p>}</section>
        <section><h3>Gates</h3>{gates.filter((gate) => gate.systemId === system.id).sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).map((gate) => <div className="entity-row" key={gate.id}><b>{gate.sequenceNumber}. {gate.name}</b><span>{gate.status.replaceAll("_", " ")} · {gate.approvalRole.replaceAll("_", " ")}</span></div>)}{!gates.some((gate) => gate.systemId === system.id) && <p className="workflow-hint">No gates defined.</p>}</section>
      </div>
    </article>)}
  </div>;
}
