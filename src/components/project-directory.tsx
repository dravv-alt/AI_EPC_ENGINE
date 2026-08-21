"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Grid2X2, List, Plus, Search, SlidersHorizontal } from "lucide-react";

export type ProjectDirectoryRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  timezone: string;
  role: string;
  gates: number;
  readyGates: number;
  openIssues: number;
  acceptedEvidence: number;
  updatedAt: string;
};

export function ProjectDirectory({ projects, activeProjectId }: { projects: ProjectDirectoryRow[]; activeProjectId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const visible = useMemo(() => projects.filter((project) => `${project.name} ${project.code}`.toLowerCase().includes(query.toLowerCase())), [projects, query]);

  async function openProject(projectId: string) {
    setBusy(projectId);
    const response = await fetch(`/api/projects/${projectId}/activate`, { method: "POST" });
    if (response.ok) { router.push("/"); router.refresh(); return; }
    setMessage("Unable to open this project.");
    setBusy("");
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("create");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: values.get("name"), code: values.get("code"), timezone: values.get("timezone") }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Project created." : body.error ?? "Unable to create project.");
    setBusy("");
    if (response.ok) { form.reset(); router.refresh(); }
  }

  return <div className="pm-project-directory">
    <div className="pm-directory-toolbar">
      <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects…" /></label>
      <span className="pm-directory-count">{visible.length} project{visible.length === 1 ? "" : "s"}</span>
      <div className="pm-display-toggle" aria-label="Project display"><button className={layout === "grid" ? "is-active" : ""} onClick={() => setLayout("grid")} aria-label="Grid view"><Grid2X2 size={17} /></button><button className={layout === "list" ? "is-active" : ""} onClick={() => setLayout("list")} aria-label="List view"><List size={18} /></button></div>
      <details className="pm-create-project"><summary><Plus size={17} /> Add project</summary><form onSubmit={createProject}><h2>Create project</h2><label>Name<input name="name" minLength={2} required /></label><label>Code<input name="code" minLength={2} pattern="[A-Za-z0-9_-]+" required /></label><label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label><button className="button button-primary" disabled={busy === "create"}>Create project</button></form></details>
    </div>
    {message && <p className="pm-inline-message" role="status">{message}</p>}
    <section className={`pm-project-collection is-${layout}`}>
      {visible.map((project) => {
        const percent = project.gates ? Math.round(project.readyGates / project.gates * 100) : 0;
        const active = project.id === activeProjectId;
        return <button className={`pm-project-card ${active ? "is-current" : ""}`} onClick={() => openProject(project.id)} disabled={busy === project.id} key={project.id}>
          <header><span className="pm-project-icon"><FolderKanban size={19} /></span><span className={`pm-status-chip ${active ? "status-open" : ""}`}>{active ? "Current" : project.status}</span></header>
          <div className="pm-project-copy"><span className="eyebrow">{project.code}</span><h2>{project.name}</h2><p>{project.timezone} · {project.role.replaceAll("_", " ")}</p></div>
          <div className="pm-project-health"><span>Gate readiness <b>{percent}%</b></span><div><i style={{ width: `${percent}%` }} /></div></div>
          <dl><div><dt>Open issues</dt><dd>{project.openIssues}</dd></div><div><dt>Accepted evidence</dt><dd>{project.acceptedEvidence}</dd></div><div><dt>Updated</dt><dd>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(project.updatedAt))}</dd></div></dl>
        </button>;
      })}
      {!visible.length && <div className="pm-empty-directory"><SlidersHorizontal size={22} /><h2>No matching projects</h2><p>Clear the search or create a project.</p></div>}
    </section>
  </div>;
}
