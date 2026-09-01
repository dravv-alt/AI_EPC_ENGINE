"use client";

import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import { useMemo, useState } from "react";

export type DocumentLibraryItem = {
  id: string;
  title: string;
  revision: string;
  mediaType: string;
  extractionStatus: string;
  status: string;
  regions: Array<{ id: string; page: string }>;
};

export function DocumentLibrary({ items }: { items: DocumentLibraryItem[] }) {
  const firstPdf = useMemo(() => items.find((item) => item.mediaType === "application/pdf"), [items]);
  const [selectedId, setSelectedId] = useState(firstPdf?.id ?? items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? firstPdf;
  const groups = useMemo(() => {
    const grouped = new Map<string, DocumentLibraryItem[]>();
    for (const item of items) grouped.set(item.title, [...(grouped.get(item.title) ?? []), item]);
    return [...grouped.entries()].map(([title, revisions]) => ({ title, revisions }));
  }, [items]);
  const initialTitle = firstPdf?.title ?? items[0]?.title;
  const [openTitles, setOpenTitles] = useState<Set<string>>(() => new Set(initialTitle ? [initialTitle] : []));
  const contentUrl = selected ? `/api/document-versions/${selected.id}/content` : "";

  function toggleDocument(title: string) {
    setOpenTitles((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  if (!items.length) return <div className="empty-state document-empty"><FileText /><h2>No controlled documents yet</h2><p>Upload a source below. Its immutable revision and extracted citations will appear here.</p></div>;

  return <div className="document-library">
    <aside className="document-index" aria-label="Document revisions">
      <header><p className="eyebrow">Controlled library</p><h2>{groups.length} document{groups.length === 1 ? "" : "s"}</h2><small>{items.length} immutable revision{items.length === 1 ? "" : "s"}</small></header>
      <div className="document-groups">{groups.map((group) => {
        const isOpen = openTitles.has(group.title);
        return <section className="document-group" key={group.title}>
          <button type="button" className="document-group-toggle" aria-expanded={isOpen} onClick={() => toggleDocument(group.title)}>
            <FileText size={17} /><span><b>{group.title}</b><small>{group.revisions.length} revision{group.revisions.length === 1 ? "" : "s"}</small></span><ChevronDown size={16} />
          </button>
          {isOpen && <div className="document-revisions">{group.revisions.map((item) => <button type="button" className={item.id === selected?.id ? "is-selected" : ""} onClick={() => setSelectedId(item.id)} key={item.id}>
            <span><b>{item.revision}</b><small>{item.regions.length} cited region{item.regions.length === 1 ? "" : "s"}</small></span><i className={`source-status ${item.extractionStatus === "completed" ? "processed" : "pending"}`}>{item.extractionStatus}</i>
          </button>)}</div>}
        </section>;
      })}</div>
    </aside>
    <section className="document-preview">
      {selected && <><header><div><p className="eyebrow">Document viewer</p><h2>{selected.title}</h2><p>{selected.revision} · {selected.status} · {selected.mediaType}</p></div><a className="button button-secondary" href={contentUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open full PDF</a></header>
        {selected.mediaType === "application/pdf" ? <object data={contentUrl} type="application/pdf" aria-label={`${selected.title} PDF`}><div className="document-preview-fallback"><p>Your browser could not embed this PDF.</p><a className="button button-primary" href={contentUrl} target="_blank" rel="noreferrer">Open PDF in a new tab</a></div></object> : <div className="document-preview-fallback"><FileText /><p>Inline preview is available for PDF revisions. Open this source to inspect the original file.</p><a className="button button-primary" href={contentUrl} target="_blank" rel="noreferrer">Open source</a></div>}
        <footer><span>Exact citations</span><div>{selected.regions.slice(0, 12).map((region) => <a href={`/sources/regions/${region.id}`} key={region.id}>Page {region.page}</a>)}{!selected.regions.length && <small>Extraction has not produced citation regions yet.</small>}</div></footer>
      </>}
    </section>
  </div>;
}
