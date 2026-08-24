/**
 * OWNED BY: A2-7 (Slice 10) — renders export.project's { method, path, body, filename } payload.
 * Keep the prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Per ChatbotHarnessPlan.md Slice 10: the server tool does NOT stream the file — it returns
 * `{ render: "download", data: { method, path, body, filename } }`. This component is
 * intentionally PRESENTATIONAL ONLY: it renders a visible, clearly-labeled fallback link to
 * `path` (a plain <a href>), which is functional today for a GET-style download and, at
 * minimum, an honest "here's where the file lives" pointer for any method.
 *
 * A3-3 (Wave 3, Slice 10) will enhance the surrounding drawer (`copilot-drawer.tsx`) with the
 * real client-side behavior: performing the fetch itself (so the session cookie travels and a
 * POST body can be sent), reading the blob, creating an object URL, and auto-clicking a hidden
 * anchor. That logic does NOT belong in this component — this component must remain a
 * reasonable, honest fallback link regardless of what A3-3 wires up around it (some browsers
 * suppress programmatic downloads, so the fallback link stays necessary even after A3-3 lands).
 */
import { GlassCard } from "@/components/ui/glass";

type DownloadData = {
  method?: string;
  path?: string;
  body?: unknown;
  filename?: string;
};

export function Download({ data }: { data: unknown }) {
  if (!data || typeof data !== "object" || typeof (data as DownloadData).path !== "string") {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>;
  }
  const { method, path, filename } = data as DownloadData & { path: string };
  const label = filename ?? path.split("/").pop() ?? "file";

  return (
    <GlassCard style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12, color: "var(--ink)" }}>Ready to download</span>
        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          {(method ?? "GET").toUpperCase()} {path}
        </span>
      </div>
      {/* Styled as a primary button (ui-primary-button class from glass.tsx) without
          nesting an <a> inside a <button> — a plain anchor stays a real, clickable
          fallback link even where script-driven downloads are blocked. */}
      <a
        href={path}
        download={filename}
        className="ui-primary-button"
        style={{ textDecoration: "none", whiteSpace: "nowrap" }}
      >
        Download {label}
      </a>
    </GlassCard>
  );
}
