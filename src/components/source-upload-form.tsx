"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";

export function SourceUploadForm({ projectId, documentType = "procedure", titlePlaceholder = "e.g. CHW commissioning procedure", submitLabel = "Upload & parse" }: { projectId: string; documentType?: string; titlePlaceholder?: string; submitLabel?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error" | "success"; message?: string }>({ kind: "idle" });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "saving" });
    const response = await fetch(`/api/projects/${projectId}/sources`, { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState({ kind: "error", message: body.error ?? "Source upload failed." });
      return;
    }
    formRef.current?.reset();
    setState({ kind: "success", message: body.extractionStatus === "processing" ? `Source controlled. Extraction job ${body.jobId} is processing.` : `Processed ${body.regionCount ?? 0} citation region${body.regionCount === 1 ? "" : "s"}.` });
    router.refresh();
  }

  return <form id="source-upload" className="upload-form" ref={formRef} onSubmit={submit}>
    <label>Source title<input name="title" required minLength={3} maxLength={300} placeholder={titlePlaceholder} /></label>
    <label>Revision<input name="revision" required maxLength={80} placeholder="e.g. Rev D" /></label>
    <label className="file-field">PDF file<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
    <input name="documentType" type="hidden" value={documentType} readOnly />
    <button className="button button-primary" disabled={state.kind === "saving"} type="submit"><FileUp size={16} /> {state.kind === "saving" ? "Processing…" : submitLabel}</button>
    {state.kind !== "idle" && <p className={`form-message ${state.kind}`}>{state.message}</p>}
  </form>;
}
