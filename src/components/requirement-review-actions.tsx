"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function RequirementReviewActions({ requirementId }: { requirementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ saving: boolean; error?: string }>({ saving: false });

  async function review(action: "accept" | "reject") {
    setState({ saving: true });
    const response = await fetch(`/api/requirements/${requirementId}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ saving: false, error: result.error ?? "Review could not be saved." });
    setState({ saving: false });
    router.refresh();
  }

  return <div className="review-actions"><button className="button button-outline" disabled={state.saving} onClick={() => review("reject")}><X size={16} /> Reject</button><button className="button button-primary" disabled={state.saving} onClick={() => review("accept")}><CheckCircle2 size={16} /> {state.saving ? "Saving…" : "Accept requirement"}</button>{state.error && <p className="form-message error">{state.error}</p>}</div>;
}
