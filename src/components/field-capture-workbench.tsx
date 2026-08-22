"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CloudOff, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { listCaptures, queueCapture, removeCapture, updateCaptureState, type QueuedCapture } from "@/lib/offline/capture-queue";
import { evidenceLabel, evidenceTaxonomy, recommendEvidenceType } from "@/lib/evidence/taxonomy";

type System = { id: string; name: string };
type Asset = { id: string; systemId: string; tag: string };

const captureRoutes = [
  { value: "site", label: "Site / asset condition", help: "Photos, nameplates, measurements, inspections, test readings, and commissioning checklists.", types: ["photo", "equipment_nameplate", "measurement", "test_reading", "inspection", "commissioning_checklist", "maintenance_record"] },
  { value: "commercial", label: "Vendor commercial record", help: "Invoice, bill, receipt, purchase order, delivery note, or challan.", types: ["invoice_bill", "purchase_order", "delivery_note"] },
  { value: "technical", label: "Vendor technical document", help: "Datasheet, drawing, calibration certificate, compliance certificate, or other controlled document.", types: ["calibration_certificate", "compliance_certificate", "drawing_markup", "document"] },
  { value: "authority", label: "Permit / authority record", help: "Permit to work, statutory authorization, or approval evidence.", types: ["permit"] }
] as const;

export function FieldCaptureWorkbench({ projectId, systems, assets }: { projectId: string; systems: System[]; assets: Asset[] }) {
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [evidenceType, setEvidenceType] = useState("photo");
  const [captureRoute, setCaptureRoute] = useState<(typeof captureRoutes)[number]["value"]>("site");
  const [artifact, setArtifact] = useState<File | null>(null);

  const refresh = useCallback(async () => setQueue(await listCaptures()), []);

  const synchronize = useCallback(async (capture: QueuedCapture) => {
    if (!navigator.onLine || !["pending_sync", "failed"].includes(capture.state)) return;
    await updateCaptureState(capture.id, "processing"); await refresh();
    const form = new FormData();
    form.set("clientCaptureId", capture.id); form.set("systemId", capture.systemId); if (capture.assetId) form.set("assetId", capture.assetId);
    form.set("evidenceType", capture.evidenceType); form.set("notes", capture.notes); form.set("capturedAt", capture.capturedAt); if (capture.artifact) form.set("artifact", capture.artifact);
    try {
      const response = await fetch(`/api/projects/${projectId}/field-captures`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Server rejected the capture.");
      await updateCaptureState(capture.id, body.syncState ?? "needs_review");
      setMessage("Capture synchronized. It remains Needs Review until an authorized reviewer accepts it.");
    } catch (error) {
      await updateCaptureState(capture.id, navigator.onLine ? "failed" : "pending_sync", error instanceof Error ? error.message : "Synchronization failed.");
    }
    await refresh();
  }, [projectId, refresh]);

  const synchronizeAll = useCallback(async () => {
    const records = await listCaptures();
    for (const capture of records) await synchronize(capture);
  }, [synchronize]);

  useEffect(() => {
    setOnline(navigator.onLine); refresh();
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    const handleOnline = () => { setOnline(true); synchronizeAll(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline); window.addEventListener("pramana-queue-change", refresh);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); window.removeEventListener("pramana-queue-change", refresh); };
  }, [refresh, synchronizeAll]);

  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const artifact = values.get("artifact");
    try {
      const item = { id: crypto.randomUUID(), projectId, systemId: String(values.get("systemId")), assetId: String(values.get("assetId") || "") || undefined, evidenceType: String(values.get("evidenceType")), notes: String(values.get("notes")), capturedAt: new Date().toISOString(), artifact: artifact instanceof File && artifact.size ? artifact : undefined };
      await queueCapture(item); form.reset(); setSystemId(systems[0]?.id ?? ""); setEvidenceType("photo"); setArtifact(null); setMessage(online ? "Capture encrypted locally and queued for server review." : "Offline capture encrypted locally. It has not changed authoritative readiness.");
      await refresh(); if (navigator.onLine) await synchronize({ ...item, state: "pending_sync", updatedAt: new Date().toISOString() });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Capture could not be queued."); }
  }

  const selectedRoute = captureRoutes.find((route) => route.value === captureRoute) ?? captureRoutes[0];
  const visibleEvidenceTypes = evidenceTaxonomy.filter((type) => selectedRoute.types.includes(type.value as never));

  return <div className="field-layout">
    <form className="surface capture-form" onSubmit={capture}>
      <div className="capture-state"><span className={`connection-dot ${online ? "online" : "offline"}`} /><strong>{online ? "Online" : "Offline"}</strong><span>{online ? "Server synchronization available" : "Local encrypted queue only"}</span></div>
      <div><p className="eyebrow">Offline-capable PWA</p><h2>Capture field evidence</h2><p>Every submission starts as Pending Sync or Needs Review. Local records never count toward readiness.</p></div>
      <label>Evidence route<select value={captureRoute} onChange={(event) => { const next = captureRoutes.find((route) => route.value === event.target.value) ?? captureRoutes[0]; setCaptureRoute(next.value); setEvidenceType(next.types[0]); }}><option value="site">Site / asset condition</option><option value="commercial">Vendor commercial record</option><option value="technical">Vendor technical document</option><option value="authority">Permit / authority record</option></select><small>{selectedRoute.help}</small></label>
      <label>System<select name="systemId" value={systemId} onChange={(event) => setSystemId(event.target.value)} required><option value="">{systems.length ? "Select system" : "Create a system first"}</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select><small>Choose the controlled system that owns or is affected by this evidence. Create one in <Link href="/systems">Systems &amp; Assets</Link>; it will appear here after the page refreshes.</small></label>
      <label>Asset<select name="assetId"><option value="">System-level evidence</option>{assets.filter((asset) => asset.systemId === systemId).map((asset) => <option value={asset.id} key={asset.id}>{asset.tag}</option>)}</select></label>
      <label>Evidence category<select name="evidenceType" value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>{visibleEvidenceTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select><small>{evidenceTaxonomy.find((type) => type.value === evidenceType)?.hint}</small></label>
      <label>Observation / reading<textarea name="notes" required minLength={2} placeholder="Record the value, unit, conditions, and context." /></label>
      <label>Artifact <span>JPEG, PNG, PDF, CSV or text · max 20 MB</span><input name="artifact" type="file" accept="image/jpeg,image/png,application/pdf,text/plain,text/csv,.csv,.txt,.pdf,.jpg,.jpeg,.png" onChange={(event) => { const file = event.target.files?.[0] ?? null; setArtifact(file); if (file) { const suggested = recommendEvidenceType(file); const route = captureRoutes.find((item) => item.types.includes(suggested as never)); if (route) setCaptureRoute(route.value); setEvidenceType(suggested); } }} /><small>Use this for immutable field evidence. For a PDF that should be searchable through the project RAG and produce controlled requirements, also upload it as a versioned <Link href="/sources">Document</Link>.</small></label>
      {artifact && <p className="form-message">Suggested category: <b>{evidenceLabel(recommendEvidenceType(artifact))}</b>. You can override it before capture.</p>}
      {!systems.length && <p className="form-message">Create a controlled system in Systems & Assets before evidence can be linked and submitted.</p>}
      <button className="button button-primary" disabled={!systems.length}><UploadCloud size={16} /> Encrypt and queue capture</button>{message && <p className="form-message" role="status">{message}</p>}
    </form>
    <section className="workflow-stack"><div className="section-heading"><div><p className="eyebrow">This device</p><h2>Synchronization queue</h2><p className="queue-guide">When online, a capture queues then synchronizes automatically. Use <b>Sync pending</b> to retry Pending Sync or Failed items. Needs Review means the server has received it, but an authorized reviewer still decides whether it can support a claim or requirement.</p></div><button className="button button-secondary" onClick={synchronizeAll} disabled={!online}><RefreshCw size={15} /> Sync pending</button></div>
      {queue.map((item) => <article className="surface queue-card" key={item.id}><div className="queue-icon">{item.state === "pending_sync" ? <CloudOff /> : item.state === "processing" ? <RefreshCw className="spin" /> : <CheckCircle2 />}</div><div><span className={`status-pill ${item.state === "failed" ? "blocked" : item.state === "needs_review" ? "review" : item.state === "accepted" ? "ready" : "unknown"}`}>{item.state.replaceAll("_", " ")}</span><h2>{item.evidenceType.replaceAll("_", " ")}</h2><p>{item.notes}</p><small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.capturedAt))}{item.artifact ? ` · ${item.artifact.name}` : " · no artifact"}</small>{item.error && <p className="form-message error">{item.error}</p>}</div><div className="queue-actions">{["pending_sync", "failed"].includes(item.state) && <button className="icon-button" aria-label="Retry synchronization" onClick={() => synchronize(item)} disabled={!online}><RefreshCw size={16} /></button>}{["needs_review", "accepted", "rejected"].includes(item.state) && <button className="icon-button" aria-label="Remove local queue copy" onClick={async () => { await removeCapture(item.id); await refresh(); }}><Trash2 size={16} /></button>}</div></article>)}
      {!queue.length && <article className="surface empty-state"><h2>No local captures</h2><p>Captured records appear here with explicit synchronization and server-authority states.</p></article>}
    </section>
  </div>;
}
