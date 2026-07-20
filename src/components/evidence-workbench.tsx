"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { compactHash } from "@/lib/presentation";

type Record = { id: string; evidenceType: string; validityState: string; contentHash: string | null; capturedAt: Date | string };

export function EvidenceWorkbench({ projectId, systemId, requirementId, records }: { projectId: string; systemId?: string; requirementId?: string; records: Record[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!systemId) return setMessage("Configure a system before capturing evidence.");
    setBusy(true); setMessage("Capturing immutable evidence…");
    try {
      const form = new FormData(event.currentTarget); const response = await fetch(`/api/projects/${projectId}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemId, evidenceType: form.get("evidenceType"), contentHash: form.get("contentHash"), capturedAt: new Date().toISOString() }) }); const body = await response.json(); setMessage(response.ok ? "Evidence captured and awaiting review." : body.error); if (response.ok) { event.currentTarget.reset(); router.refresh(); }
    } finally { setBusy(false); }
  }
  async function review(id: string, decision: "accept" | "reject") {
    setBusy(true); setMessage(`${decision === "accept" ? "Accepting" : "Rejecting"} evidence…`);
    try { const response = await fetch(`/api/evidence/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, requirementIds: decision === "accept" && requirementId ? [requirementId] : [], note: `${decision}ed in evidence workbench` }) }); const body = await response.json(); setMessage(response.ok ? `Evidence ${decision}ed.` : body.error); if (response.ok) router.refresh(); } finally { setBusy(false); }
  }
  return <div className="workflow-stack"><form className="surface workflow-form" onSubmit={capture} aria-busy={busy}><label>Evidence type<input name="evidenceType" placeholder="test_report" required disabled={busy} /></label><label>SHA-256 content hash<input name="contentHash" pattern="[a-f0-9]{64}" minLength={64} maxLength={64} required disabled={busy} /></label><button className="button button-primary" disabled={busy} aria-busy={busy}>{busy && <LoaderCircle className="button-spinner" size={16} />} {busy ? "Saving…" : "Capture pending evidence"}</button>{message && <p className="form-message" role="status">{busy && <span className="operation-progress" aria-hidden="true" />}{message}</p>}</form><section className="workflow-grid">{records.map((record) => <article className="surface workflow-card" key={record.id}><span className={`source-status ${record.validityState === "accepted" ? "processed" : "pending"}`}>{record.validityState}</span><h2>{record.evidenceType.replaceAll("_", " ")}</h2><p>Captured {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.capturedAt))}</p><small className="mono" title={record.contentHash ?? undefined}>Content hash: {compactHash(record.contentHash)}</small>{record.validityState === "pending" && <div className="review-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => review(record.id, "reject")}>Reject</button><button type="button" className="button button-primary" disabled={busy} onClick={() => review(record.id, "accept")}>Accept and link</button></div>}</article>)}</section></div>;
}
