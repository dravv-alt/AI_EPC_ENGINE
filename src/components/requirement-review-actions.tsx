"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Requirement = { id: string; statement: string; numericValue: string | null; unit: string | null; tolerance: string | null };

export function RequirementReviewActions({ requirement, acceptedTargets }: { requirement: Requirement; acceptedTargets: Array<{ id: string; statement: string }> }) {
  const router = useRouter();
  const [state, setState] = useState<{ saving: boolean; error?: string }>({ saving: false });
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(requirement.statement);
  const [numericValue, setNumericValue] = useState(requirement.numericValue ?? "");
  const [unit, setUnit] = useState(requirement.unit ?? "");
  const [tolerance, setTolerance] = useState(requirement.tolerance ?? "");
  const [note, setNote] = useState("");
  const [duplicateOf, setDuplicateOf] = useState(acceptedTargets[0]?.id ?? "");

  async function review(action: "accept" | "reject" | "edit" | "duplicate") {
    setState({ saving: true });
    const response = await fetch(`/api/requirements/${requirement.id}/review`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, statement: action === "edit" ? statement : undefined, numericValue: numericValue === "" ? undefined : Number(numericValue), unit: unit || undefined, tolerance: tolerance === "" ? undefined : Number(tolerance), note: note || undefined, duplicateOfRequirementId: action === "duplicate" ? duplicateOf : undefined }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ saving: false, error: result.error ?? "Review could not be saved." });
    setState({ saving: false }); router.refresh();
  }

  return <div className="requirement-review-panel">
    {editing && <div className="review-edit-grid"><label>Controlled statement<textarea value={statement} onChange={(event) => setStatement(event.target.value)} /></label><label>Numeric value<input type="number" step="any" value={numericValue} onChange={(event) => setNumericValue(event.target.value)} /></label><label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. kPa" /></label><label>Tolerance<input type="number" step="any" min="0" value={tolerance} onChange={(event) => setTolerance(event.target.value)} /></label><label>Review rationale<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record why this disposition is correct." /></label></div>}
    <div className="review-actions"><button className="button button-outline" disabled={state.saving} onClick={() => review("reject")}><X size={16} /> Reject</button>{acceptedTargets.length > 0 && <label className="duplicate-control"><span>Duplicate of</span><select value={duplicateOf} onChange={(event) => setDuplicateOf(event.target.value)}>{acceptedTargets.map((target) => <option value={target.id} key={target.id}>{target.statement.slice(0, 70)}</option>)}</select><button className="button button-outline" disabled={state.saving || !duplicateOf} onClick={() => review("duplicate")}><Copy size={15} /> Mark duplicate</button></label>}<button className="button button-secondary" disabled={state.saving} onClick={() => editing ? review("edit") : setEditing(true)}><Pencil size={15} /> {editing ? "Save edited proposal" : "Edit"}</button><button className="button button-primary" disabled={state.saving} onClick={() => review("accept")}><CheckCircle2 size={16} /> {state.saving ? "Saving…" : "Accept requirement"}</button></div>
    {state.error && <p className="form-message error" role="alert">{state.error}</p>}
  </div>;
}
