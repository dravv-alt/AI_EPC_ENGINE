"use client";

import { useRef, useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "uploading" | "extracting" | "error" | "success";

export function SourceUploadForm({ projectId, documentType = "procedure", titlePlaceholder = "e.g. CHW commissioning procedure", submitLabel = "Upload & parse" }: { projectId: string; documentType?: string; titlePlaceholder?: string; submitLabel?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<{ kind: UploadState; message?: string }>({ kind: "idle" });
  const busy = state.kind === "uploading" || state.kind === "extracting";

  async function waitForExtraction(jobId: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (body.job?.status === "completed") return;
      if (body.job?.status === "failed") throw new Error(body.job.error ?? "PDF extraction failed.");
      setState({ kind: "extracting", message: "Extracting text and building citation regions…" });
    }
    throw new Error("Extraction is still running. It will continue in the background; refresh Sources shortly to see the result.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "uploading", message: "Uploading the controlled PDF…" });
    try {
      const response = await fetch(`/api/projects/${projectId}/sources`, { method: "POST", body: new FormData(event.currentTarget) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Source upload failed.");
      if (body.extractionStatus === "processing" && body.jobId) {
        setState({ kind: "extracting", message: "PDF accepted. Extracting text and citation regions…" });
        await waitForExtraction(body.jobId);
      }
      formRef.current?.reset();
      setState({ kind: "success", message: "Source processed. Citation regions are ready for review." });
      router.refresh();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Source upload failed." });
      router.refresh();
    }
  }

  return <form id="source-upload" className="upload-form" ref={formRef} onSubmit={submit} aria-busy={busy}>
    <label>Source title<input name="title" required minLength={3} maxLength={300} placeholder={titlePlaceholder} disabled={busy} /></label>
    <label>Revision<input name="revision" required maxLength={80} placeholder="e.g. Rev D" disabled={busy} /></label>
    <label className="file-field">PDF file<input name="file" type="file" accept="application/pdf,.pdf" required disabled={busy} /></label>
    <input name="documentType" type="hidden" value={documentType} readOnly />
    <button className="button button-primary" disabled={busy} aria-busy={busy} type="submit">{busy ? <LoaderCircle className="button-spinner" size={16} /> : <FileUp size={16} />} {state.kind === "uploading" ? "Uploading…" : state.kind === "extracting" ? "Extracting…" : submitLabel}</button>
    {state.kind !== "idle" && <p className={`form-message ${state.kind}`} role="status">{busy && <span className="operation-progress" aria-hidden="true" />}{state.message}</p>}
  </form>;
}
