"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GateDecisionForm({ gateId, readinessState }: { gateId: string; readinessState: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "waive">(readinessState === "ready" ? "approve" : "reject");
  const [token, setToken] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    if (needsMfa) {
      const challenge = await fetch("/api/auth/totp/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = await challenge.json();
      if (!challenge.ok) { setSaving(false); return setMessage(body.error); }
    }
    const response = await fetch(`/api/gates/${gateId}/decisions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: action, reason }) });
    const body = await response.json();
    if (response.status === 428) { setNeedsMfa(true); setMessage("Enter a fresh six-digit authenticator code, then submit again."); setSaving(false); return; }
    setMessage(response.ok ? `Gate decision “${action}” recorded against an immutable evidence baseline.` : body.error);
    setSaving(false); if (response.ok) router.refresh();
  }
  return <div className="decision-form"><label>Decision<select value={action} onChange={(event) => setAction(event.target.value as typeof action)}><option value="approve" disabled={readinessState !== "ready"}>Approve</option><option value="reject">Reject</option><option value="waive">Waive with authority</option></select></label><textarea aria-label="Decision reason" placeholder="Explain this decision against the displayed evidence baseline…" minLength={12} value={reason} onChange={(event) => setReason(event.target.value)} />{needsMfa && <input aria-label="Six-digit authenticator code" inputMode="numeric" pattern="[0-9]{6}" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Authenticator code" />}<button className="button button-primary" disabled={saving || reason.trim().length < 12 || needsMfa && token.length !== 6} onClick={submit}>{saving ? "Recording…" : "Record controlled decision"}</button>{message && <small role="status">{message}</small>}</div>;
}
