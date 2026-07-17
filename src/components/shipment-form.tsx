"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ship } from "lucide-react";

export function ShipmentForm({ projectId }: { projectId: string }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); const response = await fetch(`/api/projects/${projectId}/shipments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), plannedEta: new Date(String(form.get("plannedEta"))).toISOString(), requiredOnSite: new Date(String(form.get("requiredOnSite"))).toISOString(), portCongestion: form.get("portCongestion") === "on" }) }); const result = await response.json(); setSaving(false); setMessage(response.ok ? `Shipment registered as ${result.shipment.status.toUpperCase()} estimated status.` : result.error ?? "Could not register shipment."); if (response.ok) { event.currentTarget.reset(); router.refresh(); } }
  return <form className="workflow-form surface" onSubmit={submit}><label>Shipment/equipment<input name="name" minLength={3} required placeholder="Chiller skid" /></label><label>Planned ETA<input name="plannedEta" type="datetime-local" required /></label><label>Required on site<input name="requiredOnSite" type="datetime-local" required /></label><label className="check-label"><input name="portCongestion" type="checkbox" /> Manual port congestion</label><button className="button button-primary" disabled={saving}><Ship size={16} />{saving ? "Saving…" : "Register shipment"}</button>{message && <p className="form-message">{message}</p>}</form>;
}
