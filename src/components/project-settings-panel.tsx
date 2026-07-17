"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const roles = ["admin", "commissioning_manager", "reviewer", "field_engineer", "approver", "viewer", "scheduler"] as const;
type Project = { id: string; name: string; code: string; timezone: string; retentionDays: number; status: string };
type Member = { id: string; userId: string; displayName: string; email: string; role: typeof roles[number]; createdAt: Date | string };
type Verification = { valid: boolean; eventCount: number; verifiedEvents: number; legacyEvents: number; headHash: string | null; errors: string[] };

export function ProjectSettingsPanel({ project, members, canManage, verification }: { project: Project; members: Member[]; canManage: boolean; verification: Verification }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(url: string, method: string, body: Record<string, unknown>) {
    setSaving(true);
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) throw new Error(result.error ?? "The change could not be saved.");
    return result;
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    try { await request(`/api/projects/${project.id}`, "PATCH", { name: values.get("name"), timezone: values.get("timezone"), retentionDays: Number(values.get("retentionDays")) }); setMessage("Project policy updated and audited."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update project."); }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try { await request(`/api/projects/${project.id}/members`, "POST", { email: values.get("email"), displayName: values.get("displayName"), role: values.get("role") }); form.reset(); setMessage("Member provisioned with project-scoped authority."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add member."); }
  }

  async function changeRole(memberId: string, role: string) {
    try { await request(`/api/projects/${project.id}/members/${memberId}`, "PATCH", { role }); setMessage("Member authority changed and audited."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change role."); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try { const result = await request("/api/projects", "POST", { name: values.get("name"), code: values.get("code"), timezone: values.get("timezone") }); await fetch(`/api/projects/${result.project.id}/activate`, { method: "POST" }); location.assign("/"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create project."); }
  }

  return <div className="workflow-stack">
    {!canManage && <section className="surface access-state"><h2>Read-only project settings</h2><p>Your role can inspect membership and audit integrity but cannot alter project authority.</p></section>}
    <form className="surface settings-form" onSubmit={updateProject}>
      <div><p className="eyebrow">Current project</p><h2>{project.code}</h2></div>
      <label>Name<input name="name" defaultValue={project.name} disabled={!canManage} required /></label>
      <label>Timezone<input name="timezone" defaultValue={project.timezone} disabled={!canManage} required /></label>
      <label>Retention days<input name="retentionDays" type="number" min="30" max="3650" defaultValue={project.retentionDays} disabled={!canManage} required /></label>
      <button className="button button-primary" disabled={!canManage || saving}>Save policy</button>
    </form>
    <section className={`surface audit-verification ${verification.valid ? "is-valid" : "is-invalid"}`}>
      <div><p className="eyebrow">Independent chain verification</p><h2>{verification.valid ? "Audit chain intact" : "Audit chain violation"}</h2><p>{verification.eventCount} linked events · {verification.verifiedEvents} canonical · {verification.legacyEvents} retained legacy</p></div>
      <code>{verification.headHash ?? "No events yet"}</code>{verification.errors.map((error) => <p className="form-message error" key={error}>{error}</p>)}
    </section>
    {canManage && <form className="surface settings-form member-form" onSubmit={addMember}>
      <div><p className="eyebrow">Authority</p><h2>Add project member</h2></div>
      <label>Name<input name="displayName" required minLength={2} /></label><label>Email<input name="email" type="email" required /></label><label>Role<select name="role" defaultValue="viewer">{roles.map((role) => <option value={role} key={role}>{role.replaceAll("_", " ")}</option>)}</select></label><button className="button button-primary" disabled={saving}>Add member</button>
    </form>}
    {message && <p className="surface inline-feedback" role="status">{message}</p>}
    <section className="surface member-table"><div className="section-heading"><div><p className="eyebrow">Project membership</p><h2>{members.length} member{members.length === 1 ? "" : "s"}</h2></div></div>{members.map((member) => <article className="entity-row" key={member.id}><div><b>{member.displayName}</b><span>{member.email}</span></div>{canManage ? <select aria-label={`Role for ${member.displayName}`} value={member.role} disabled={saving} onChange={(event) => changeRole(member.id, event.target.value)}>{roles.map((role) => <option value={role} key={role}>{role.replaceAll("_", " ")}</option>)}</select> : <span className="source-status processed">{member.role.replaceAll("_", " ")}</span>}</article>)}</section>
    {canManage && <details className="surface history-panel"><summary>Create another project</summary><form className="compact-form" onSubmit={createProject}><label>Name<input name="name" minLength={2} required /></label><label>Code<input name="code" pattern="[A-Za-z0-9_-]+" required /></label><label>Timezone<input name="timezone" defaultValue={project.timezone} required /></label><button className="button button-primary" disabled={saving}>Create and switch</button></form></details>}
  </div>;
}
