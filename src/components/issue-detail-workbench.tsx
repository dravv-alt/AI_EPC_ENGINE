"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, CircleDot, Clock3, Link2, ShieldCheck, UserRound } from "lucide-react";

type Issue = { id: string; title: string; description: string | null; status: string; severity: string; ownerId: string | null; ownerName: string | null; gateId: string | null; gateName: string | null; dueAt: string | null; resolutionNote: string | null; resolvedAt: string | null; version: number; createdAt: string; updatedAt: string };
type Activity = { id: string; action: string; actor: string; at: string };

export function IssueDetailWorkbench({ issue, members, activity }: { issue: Issue; members: Array<{ id: string; name: string }>; activity: Activity[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resolutionNote, setResolutionNote] = useState(issue.resolutionNote ?? "");
  const [ownerId, setOwnerId] = useState(issue.ownerId ?? "");
  const [dueAt, setDueAt] = useState(issue.dueAt ? new Date(issue.dueAt).toISOString().slice(0, 16) : "");

  async function patch(values: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(`/api/findings/${issue.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: issue.version, ...values }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "Issue updated. Readiness has been recomputed." : body.error ?? "Unable to update issue.");
    if (response.ok) router.refresh();
  }

  return <div className="pm-issue-detail-layout">
    <section className="pm-issue-detail-main">
      <Link className="pm-back-link" href="/actions"><ArrowLeft size={15} /> Back to issues</Link>
      <div className="pm-issue-actions">
        <button className={`pm-state-button ${issue.status === "open" ? "is-active" : ""}`} disabled={busy || issue.status === "open"} onClick={() => patch({ status: "open" })}>Backlog</button>
        <button className={`pm-state-button ${issue.status === "in_progress" ? "is-active" : ""}`} disabled={busy || issue.status === "in_progress"} onClick={() => patch({ status: "in_progress" })}><CircleDot size={15} /> In progress</button>
        {issue.status === "closed" && <button className="pm-state-button is-resolved" disabled><Check size={15} /> Resolved</button>}
      </div>

      <section className="pm-record-metadata">
        <label><span><UserRound size={16} /> Assignee</span><select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
        <label><span><CalendarDays size={16} /> Due date</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        <div><span><AlertTriangle size={16} /> Priority</span><strong className={`pm-priority-label priority-${issue.severity}`}>{issue.severity}</strong></div>
        <div><span><ShieldCheck size={16} /> Linked gate</span>{issue.gateId ? <Link href={`/readiness?gate=${issue.gateId}`}>{issue.gateName ?? "Open gate"}</Link> : <strong>Project-wide</strong>}</div>
        <button className="button button-secondary" disabled={busy || !ownerId || !dueAt} onClick={() => patch({ ownerId, dueAt: new Date(dueAt).toISOString() })}>Save assignment</button>
      </section>

      <section className="pm-record-section">
        <h2>Description</h2>
        <p>{issue.description ?? "No description was supplied for this issue."}</p>
      </section>

      <section className="pm-record-section pm-resolution-section">
        <div><h2>Resolution</h2><p>State what changed and where the accepted proof is stored. Closing the issue immediately recomputes readiness.</p></div>
        <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Describe the resolution and supporting evidence…" />
        <button className="button button-primary" disabled={busy || issue.status === "closed" || resolutionNote.trim().length < 5} onClick={() => patch({ status: "closed", resolutionNote })}><Check size={16} /> Resolve issue</button>
      </section>
      {message && <p className="pm-inline-message" role="status">{message}</p>}
      <footer className="pm-record-footer"><span>Created {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(issue.createdAt))}</span><span>Updated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(issue.updatedAt))}</span></footer>
    </section>

    <aside className="pm-activity-rail">
      <header><div><p className="eyebrow">Append-only record</p><h2>Activity</h2></div><Clock3 size={19} /></header>
      <div className="pm-activity-line">
        {activity.map((event) => <article key={event.id}><i /><div><b>{event.actor}</b><p>{event.action}</p><time>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.at))}</time></div></article>)}
        {!activity.length && <p className="pm-empty">No audit activity has been recorded for this issue.</p>}
      </div>
      {issue.gateId && <section className="pm-linked-record"><h3><Link2 size={16} /> Linked record</h3><Link href={`/readiness?gate=${issue.gateId}`}><b>{issue.gateName}</b><span>Readiness gate <ArrowLeft size={13} /></span></Link></section>}
    </aside>
  </div>;
}
