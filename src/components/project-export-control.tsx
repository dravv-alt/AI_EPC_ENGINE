"use client";

import { ChangeEvent, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  ImageUp,
  Loader2,
  Stamp,
  X,
} from "lucide-react";

type Format = "pdf" | "csv";
type Theme = "classic" | "soft-pop" | "midnight" | "forest";
export function ProjectExportControl({
  projectId,
  title,
}: {
  projectId?: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("classic");
  const [watermark, setWatermark] = useState("");
  const [letterhead, setLetterhead] = useState<string>();
  const [letterheadName, setLetterheadName] = useState("");
  const [busy, setBusy] = useState<Format | null>(null);
  const [message, setMessage] = useState("");
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type) || file.size > 2_000_000) {
      setMessage("Use a PNG or JPEG letterhead under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLetterhead(String(reader.result));
      setLetterheadName(file.name);
      setMessage("Letterhead ready for the PDF export.");
    };
    reader.readAsDataURL(file);
  }
  async function exportFile(format: Format) {
    setBusy(format);
    setMessage("");
    try {
      let resolvedProjectId = projectId;
      if (!resolvedProjectId) {
        const active = await fetch("/api/projects", { cache: "no-store" });
        const payload = await active.json().catch(() => ({}));
        if (!active.ok || typeof payload.activeProjectId !== "string")
          throw new Error(
            payload.error ?? "No active project is available for export.",
          );
        resolvedProjectId = payload.activeProjectId;
      }
      const response = await fetch(
        `/api/projects/${resolvedProjectId}/export`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            format,
            title,
            theme,
            watermark: format === "pdf" ? watermark : undefined,
            letterhead: format === "pdf" ? letterhead : undefined,
            letterheadName,
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Export failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${format.toUpperCase()} export downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="project-export">
      <button
        type="button"
        className="button button-secondary"
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={16} /> Export data
      </button>
      {open && (
        <section className="project-export-panel" aria-label="Export controls">
          <header>
            <div>
              <p className="eyebrow">Controlled export</p>
              <h2>Export this project</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setOpen(false)}
              aria-label="Close export settings"
            >
              <X size={16} />
            </button>
          </header>
          <label>
            Colour theme
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
            >
              <option value="classic">Classic document</option>
              <option value="soft-pop">Soft pop</option>
              <option value="midnight">Midnight blue</option>
              <option value="forest">Forest green</option>
            </select>
          </label>
          <label>
            PDF watermark <span>Optional</span>
            <input
              value={watermark}
              onChange={(event) => setWatermark(event.target.value)}
              maxLength={80}
              placeholder="e.g. Confidential"
            />
          </label>
          <label className="letterhead-picker">
            <ImageUp size={16} />{" "}
            {letterheadName || "Upload company letterhead"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={upload}
            />
          </label>
          {letterheadName && (
            <p className="export-letterhead">
              <Stamp size={14} /> {letterheadName}{" "}
              <button
                type="button"
                onClick={() => {
                  setLetterhead(undefined);
                  setLetterheadName("");
                }}
              >
                Remove
              </button>
            </p>
          )}
          <p className="export-note">
            PDF includes a white page, document-control block, repeated
            header/footer, record counts, and bordered tables. CSV is text-only
            by design; it includes the chosen theme and letterhead name as
            metadata but cannot embed colours or images.
          </p>
          <div className="project-export-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => exportFile("csv")}
              disabled={Boolean(busy)}
            >
              {busy === "csv" ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <FileSpreadsheet size={16} />
              )}{" "}
              Export CSV
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => exportFile("pdf")}
              disabled={Boolean(busy)}
            >
              {busy === "pdf" ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <FileText size={16} />
              )}{" "}
              Export PDF
            </button>
          </div>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
