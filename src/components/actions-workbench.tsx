"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, Circle, CircleCheck, CircleDot, Filter, Plus, Search } from "lucide-react";

type Finding = { id: string; gateId: string | null; title: string; description: string | null; severity: string; status: string; ownerId: string | null; ownerName: string | null; dueAt: Date | string | null; resolutionNote: string | null; resolvedAt: Date | string | null; version: number; updatedAt: Date | string };

function isOverdue(finding: Finding): boolean {
  return Boolean(finding.dueAt && finding.status !== "closed" && new Date(finding.dueAt).getTime() < Date.now());
}

const groups = [
  { status: "in_progress", label: "In progress", Icon: CircleDot },
  { status: "open", label: "Backlog", Icon: Circle },
  { status: "closed", label: "Resolved", Icon: CircleCheck },
] as const;

export function ActionsWorkbench({ projectId, findings, gates, members }: { projectId: string; findings: Finding[]; gates: Array<{ id: string; name: string }>; members: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const gateById = new Map(gates.map((gate) => [gate.id, gate.name]));
  const visible = findings.filter((finding) => `${finding.title} ${finding.description ?? ""} ${finding.ownerName ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (severity === "all" || finding.severity === severity));

  useEffect(() => {
    const findingId = new URLSearchParams(window.location.search).get("finding");
    if (!findingId) return;
    const target = document.getElementById(`finding-${findingId}`);
    target?.closest("details")?.setAttribute("open", "");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

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
    setMessage(response.ok ? "Issue created and included in readiness." : body.error ?? "Unable to create issue.");
    if (response.ok) { form.reset(); router.refresh(); }
  }

  return <div className="pm-issues-workbench">
    <div className="pm-issues-toolbar">
      <label className="pm-issue-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues…" /></label>
      <label className="pm-issue-filter"><Filter size={16} /><span>Priority</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
      <span className="pm-issue-total">{visible.length} issue{visible.length === 1 ? "" : "s"}</span>
      <details className="pm-create-issue"><summary><Plus size={17} /> Add issue</summary><form onSubmit={create}>
        <header><div><p className="eyebrow">Accountable work</p><h2>Create issue</h2></div></header>
        <label className="pm-span-2">Title<input name="title" minLength={3} required placeholder="Resolve missing witness signature" /></label>
        <label className="pm-span-2">Description<textarea name="description" placeholder="Describe the blocker and its acceptance condition." /></label>
        <label>Priority<select name="severity" defaultValue="high"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label>Gate<select name="gateId"><option value="">Project-wide</option>{gates.map((gate) => <option value={gate.id} key={gate.id}>{gate.name}</option>)}</select></label>
        <label>Owner<select name="ownerId" required><option value="">Select owner</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
        <label>Due date<input name="dueAt" type="datetime-local" required /></label>
        <button className="button button-primary pm-span-2" disabled={saving || !members.length}>Create and assign</button>
      </form></details>
    </div>
    {message && <p className="pm-inline-message" role="status">{message}</p>}
    <section className="pm-issue-groups">
      {groups.map(({ status, label, Icon }) => {
        const rows = visible.filter((finding) => finding.status === status);
        return <details className={`pm-issue-group group-${status}`} open={status !== "closed"} key={status}>
          <summary><ChevronDown size={17} /><Icon size={17} /><b>{label}</b><span>{rows.length}</span></summary>
          <div className="pm-issue-table" role="table" aria-label={`${label} issues`}>
            {rows.map((finding) => <div id={`finding-${finding.id}`} className="pm-issue-row" role="row" key={finding.id}>
              <span className={`pm-priority-dot priority-${finding.severity}`} />
              <span className="pm-issue-key">{finding.id.slice(0, 6).toUpperCase()}</span>
              <span className="pm-issue-title"><Link href={`/actions/${finding.id}`}><b>{finding.title}</b><small>{finding.description ?? "No description"}</small></Link></span>
              <span className="pm-issue-gate">{finding.gateId ? <Link href={`/readiness?gate=${finding.gateId}`}>{gateById.get(finding.gateId) ?? "Linked gate"}</Link> : "Project-wide"}</span>
              <span className="pm-issue-owner"><i>{(finding.ownerName ?? "U").split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</i>{finding.ownerName ?? "Unassigned"}</span>
              <span className={`pm-issue-due ${isOverdue(finding) ? "is-overdue" : ""}`}>{isOverdue(finding) && <AlertCircle size={14} />}{finding.dueAt ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(finding.dueAt)) : "No date"}</span>
            </div>)}
            {!rows.length && <p className="pm-empty-group">No issues in this status.</p>}
          </div>
        </details>;
      })}
    </section>
  </div>;
}
