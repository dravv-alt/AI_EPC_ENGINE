"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Finding = { id: string; gateId: string | null; title: string; description: string | null; severity: string; status: string; ownerId: string | null; ownerName: string | null; dueAt: Date | string | null; resolutionNote: string | null; resolvedAt: Date | string | null; version: number; updatedAt: Date | string };

export function ActionsWorkbench({ projectId, findings, gates, members }: { projectId: string; findings: Finding[]; gates: Array<{ id: string; name: string }>; members: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    const response = await fetch(`/api/projects/${projectId}/findings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: values.get("title"), description: values.get("description"), severity: values.get("severity"), gateId: values.get("gateId") || undefined, ownerId: values.get("ownerId"), dueAt: new Date(String(values.get("dueAt"))).toISOString() })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Finding created, assigned, and included in readiness." : body.error ?? "Unable to create finding.");
    if (response.ok) { form.reset(); router.refresh(); }
  }

  async function update(finding: Finding, status: "open" | "in_progress" | "closed") {
    const resolutionNote = resolutionNotes[finding.id];
    if (status === "closed" && (!resolutionNote || resolutionNote.trim().length < 5)) return setMessage("Enter a resolution note before closing the finding.");
    setSaving(true);
    const response = await fetch(`/api/findings/${finding.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: finding.version, status, resolutionNote }) });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? `Finding moved to ${status.replaceAll("_", " ")}; readiness recalculated.` : body.error ?? "Unable to update finding.");
    if (response.ok) router.refresh();
  }

  const active = findings.filter((finding) => finding.status !== "closed");
  const closed = findings.filter((finding) => finding.status === "closed");
  return <div className="workflow-stack">
    <form className="surface finding-form" onSubmit={create}>
      <div><p className="eyebrow">New accountable action</p><h2>Create finding</h2></div>
      <label>Title<input name="title" minLength={3} required placeholder="Resolve missing witness signature" /></label>
      <label>Description<textarea name="description" placeholder="Describe the exact blocker and acceptance condition." /></label>
      <label>Severity<select name="severity" defaultValue="high"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      <label>Gate<select name="gateId"><option value="">Project-wide</option>{gates.map((gate) => <option value={gate.id} key={gate.id}>{gate.name}</option>)}</select></label>
      <label>Owner<select name="ownerId" required><option value="">Select owner</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
      <label>Due date<input name="dueAt" type="datetime-local" required /></label>
      <button className="button button-primary" disabled={saving || !members.length}>Create and assign</button>
    </form>
    {message && <p className="surface inline-feedback" role="status">{message}</p>}
    <section className="section-heading"><div><p className="eyebrow">Requires attention</p><h2>{active.length} active finding{active.length === 1 ? "" : "s"}</h2></div></section>
    <section className="workflow-grid">
      {active.map((finding) => <article className="surface workflow-card finding-card" key={finding.id}>
        <span className={`severity ${finding.severity}`} /><span className={`status-pill ${finding.status === "open" ? "blocked" : "review"}`}>{finding.status.replaceAll("_", " ")}</span>
        <h2>{finding.title}</h2><p>{finding.description ?? "No description supplied."}</p>
        <small>{finding.ownerName ?? "Unassigned"} · Due {finding.dueAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(finding.dueAt)) : "not scheduled"}</small>
        <label className="resolution-field">Resolution note<textarea value={resolutionNotes[finding.id] ?? ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [finding.id]: event.target.value }))} placeholder="State what changed and where the proof is stored." /></label>
        <div className="review-actions">{finding.status === "open" && <button className="button button-secondary" disabled={saving} onClick={() => update(finding, "in_progress")}>Start work</button>}<button className="button button-primary" disabled={saving} onClick={() => update(finding, "closed")}>Resolve finding</button></div>
      </article>)}
      {!active.length && <article className="surface empty-state"><h2>No active findings</h2><p>This is not a readiness claim. Gate state still depends on accepted requirements and current evidence.</p></article>}
    </section>
    {closed.length > 0 && <details className="surface history-panel"><summary>Resolved history ({closed.length})</summary>{closed.map((finding) => <article className="entity-row" key={finding.id}><div><b>{finding.title}</b><span>{finding.resolutionNote}</span></div><small>{finding.resolvedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(finding.resolvedAt)) : "Resolved"}</small></article>)}</details>}
  </div>;
}
