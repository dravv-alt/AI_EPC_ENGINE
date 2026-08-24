"use client";

import Link from "next/link";
import { FileText, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SourceUploadForm } from "@/components/source-upload-form";

type Source = { id: string; title: string; documentType: string; revision: string; extractionStatus: string; regionCount: number; regions: Array<{ id: string; page: string }> };
const readable = (value: string) => value.replaceAll("_", " ");

export function SourcesWorkbench({ projectId, sources }: { projectId: string; sources: Source[] }) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const types = useMemo(() => [...new Set(sources.map((source) => source.documentType))].sort(), [sources]);
  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return sources.filter((source) => (selectedType === "all" || source.documentType === selectedType) && (selectedStatus === "all" || source.extractionStatus === selectedStatus) && (!needle || `${source.title} ${source.revision} ${source.documentType}`.toLowerCase().includes(needle))); }, [query, selectedStatus, selectedType, sources]);

  return <div className="sources-workbench">
    <section className="surface sources-upload-panel" aria-labelledby="upload-source-heading"><header><div><p className="eyebrow">Add controlled source</p><h2 id="upload-source-heading">Upload and parse</h2><p>Upload an immutable PDF revision. Extraction builds exact citation regions in the background.</p></div></header><SourceUploadForm projectId={projectId} /></section>
    <section className="sources-library" aria-labelledby="source-library-heading">
      <aside className="surface sources-filter-rail"><div className="filter-title"><Filter aria-hidden="true" /><div><strong>Display sources</strong><span>{filtered.length} of {sources.length}</span></div></div><label className="source-search"><span>Search</span><div><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Title or revision" /></div></label><fieldset><legend>Source type</legend><button type="button" className={selectedType === "all" ? "active" : ""} onClick={() => setSelectedType("all")}><span>All sources</span><b>{sources.length}</b></button>{types.map((type) => <button type="button" className={selectedType === type ? "active" : ""} onClick={() => setSelectedType(type)} key={type}><span>{readable(type)}</span><b>{sources.filter((source) => source.documentType === type).length}</b></button>)}</fieldset><fieldset><legend>Processing</legend>{["all", "completed", "processing", "failed"].map((status) => <button type="button" className={selectedStatus === status ? "active" : ""} onClick={() => setSelectedStatus(status)} key={status}><span>{status === "all" ? "Any status" : readable(status)}</span></button>)}</fieldset>{(selectedType !== "all" || selectedStatus !== "all" || query) && <button type="button" className="clear-source-filters" onClick={() => { setQuery(""); setSelectedType("all"); setSelectedStatus("all"); }}>Clear filters</button>}</aside>
      <article className="surface sources-list-panel"><header><div><p className="eyebrow">Controlled library</p><h2 id="source-library-heading">Project documents</h2></div><span>{filtered.length} shown</span></header><div className="table-wrap"><table><thead><tr><th>Source</th><th>Revision</th><th>Status</th><th>Citation regions</th></tr></thead><tbody>{filtered.map((source) => <tr key={source.id}><td>{source.regions[0] ? <Link className="source-table-link" href={`/sources/regions/${source.regions[0].id}`}><b>{source.title}</b><small>{readable(source.documentType)} / open first citation</small></Link> : <div className="source-table-link"><b>{source.title}</b><small>{readable(source.documentType)}</small></div>}</td><td>{source.revision}</td><td><span className={`source-status ${source.extractionStatus === "completed" ? "processed" : "pending"}`}>{readable(source.extractionStatus)}</span></td><td><div className="source-region-links">{source.regions.map((region) => <Link key={region.id} href={`/sources/regions/${region.id}`}>Page {region.page}</Link>)}{source.regionCount > source.regions.length && <span>+{source.regionCount - source.regions.length} more</span>}{!source.regionCount && <span>No extracted regions</span>}</div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="sources-empty"><FileText aria-hidden="true" /><h3>No matching sources</h3><p>Change the filters or upload a new controlled PDF.</p></div>}</article>
    </section>
  </div>;
}
