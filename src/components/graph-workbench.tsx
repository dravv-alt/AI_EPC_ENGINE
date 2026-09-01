"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, ExternalLink, FileText, Filter, GitBranch, Network, Plus, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Node = { id: string; type: string; label: string; state: string };
type Edge = { id: string; fromType: string; fromId: string; relationshipType: string; toType: string; toId: string; derived?: boolean };
type AuditEntry = { id: string; action: string; entityType: string; entityId: string; createdAt: Date | string; actorName: string | null; eventHash: string };
type Expansion = { node: Node; neighbors: { edge: Edge; node: Node }[]; documents: { evidenceId: string; documentId: string; title: string; documentType: string; revision: string }[]; supply: { id: string; label: string; state: string }[]; audits: AuditEntry[] };

const TYPE_COLUMNS: Record<string, number> = { system: 0, asset: 1, shipment: 1, gate: 2, schedule_task: 2, requirement: 3, evidence: 4, cx_test: 4, finding: 5 };
const COLUMN_LABELS = ["Systems", "Assets & supply", "Gates & delivery", "Requirements", "Proof", "Exceptions"];
const TYPE_LABELS: Record<string, string> = { system: "System", asset: "Asset", gate: "Gate", requirement: "Requirement", evidence: "Evidence", finding: "Finding", schedule_task: "Schedule task", shipment: "Shipment", cx_test: "Cx test" };
const RELATION_LABELS: Record<string, string> = { AFFECTS: "affects", PROVES: "proves", PRECEDES: "precedes", BLOCKS: "blocks", BELONGS_TO: "belongs to", SUPERSEDES: "supersedes", DUPLICATE_OF: "duplicates", GENERATED_FROM: "generated from" };
const short = (value: string, limit = 23) => value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
const readable = (value: string) => value.replaceAll("_", " ");

function stateTone(state: string) {
  if (["accepted", "approved", "completed", "green", "ready", "proposed_pass"].includes(state)) return "ready";
  if (["rejected", "blocked", "open", "failed", "red", "proposed_fail"].includes(state)) return "blocked";
  if (["pending", "proposed", "in_review", "in_progress", "amber", "needs_human_review", "stale"].includes(state)) return "review";
  return "unknown";
}

function recordHref(node: Node) {
  const routes: Record<string, string> = { system: "/systems", asset: "/systems", gate: "/readiness", requirement: "/requirements", evidence: "/evidence", finding: "/actions", schedule_task: `/schedule?task=${encodeURIComponent(node.id)}`, shipment: "/shipments", cx_test: "/cx" };
  return routes[node.type] ?? "/overview";
}

export function GraphWorkbench({ projectId, nodes, edges, initialFocusId }: { projectId: string; nodes: Node[]; edges: Edge[]; initialFocusId?: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(nodes.some((node) => node.id === initialFocusId) ? initialFocusId! : nodes.find((node) => edges.some((edge) => edge.fromId === node.id || edge.toId === node.id))?.id ?? nodes[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [showContextEdges, setShowContextEdges] = useState(false);
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const connectedIds = useMemo(() => new Set(edges.flatMap((edge) => [edge.fromId, edge.toId])), [edges]);
  const selected = nodeById.get(selectedId);
  const selectedEdges = selected ? edges.filter((edge) => edge.fromId === selected.id || edge.toId === selected.id) : [];
  const neighborIds = new Set(selectedEdges.flatMap((edge) => [edge.fromId, edge.toId]));
  const allTypes = Array.from(new Set(nodes.map((node) => node.type))).sort();
  const visibleNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return nodes.filter((node) => (showAll || connectedIds.has(node.id)) && (typeFilter === "all" || node.type === typeFilter) && (!term || `${node.label} ${node.type} ${node.state}`.toLowerCase().includes(term)));
  }, [connectedIds, nodes, search, showAll, typeFilter]);
  const layout = useMemo(() => {
    const grouped = Array.from({ length: 6 }, () => [] as Node[]);
    visibleNodes.forEach((node) => grouped[TYPE_COLUMNS[node.type] ?? 5].push(node));
    grouped.forEach((group) => group.sort((a, b) => a.label.localeCompare(b.label)));
    const positions = new Map<string, { x: number; y: number }>();
    grouped.forEach((group, column) => group.forEach((node, index) => positions.set(node.id, { x: 34 + column * 184, y: 62 + index * 66 })));
    return { grouped, positions, height: Math.max(520, Math.max(...grouped.map((group) => group.length), 1) * 66 + 90) };
  }, [visibleNodes]);
  const visibleEdges = edges.filter((edge) => layout.positions.has(edge.fromId) && layout.positions.has(edge.toId) && (showContextEdges || !selectedId || edge.fromId === selectedId || edge.toId === selectedId));
  const storedCount = edges.filter((edge) => !edge.derived).length;
  const derivedCount = edges.length - storedCount;

  useEffect(() => {
    if (!selectedId) return; let active = true; setLoading(true);
    fetch(`/api/projects/${projectId}/graph/nodes/${selectedId}`).then((response) => response.ok ? response.json() : null).then((body) => { if (active) { setExpansion(body); setLoading(false); } }).catch(() => { if (active) { setExpansion(null); setLoading(false); } });
    return () => { active = false; };
  }, [projectId, selectedId]);

  function selectNode(id: string) {
    setSelectedId(id);
    window.history.replaceState(null, "", `/graph?focus=${encodeURIComponent(id)}`);
  }

  async function createEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const [fromType, fromId] = String(values.get("from")).split(":"); const [toType, toId] = String(values.get("to")).split(":");
    const response = await fetch(`/api/projects/${projectId}/edges`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromType, fromId, relationshipType: values.get("relationshipType"), toType, toId }) });
    const body = await response.json().catch(() => ({})); setMessage(response.ok ? body.duplicate ? "That relationship already exists." : "Relationship created and written to the audit chain." : body.error ?? "Unable to create relationship."); if (response.ok && !body.duplicate) router.refresh();
  }

  return <div className="traceability-workbench">
    <section className="trace-kpis" aria-label="Traceability coverage">
      <article><Network size={17} /><span><small>Connected entities</small><strong>{connectedIds.size} / {nodes.length}</strong></span></article>
      <article><GitBranch size={17} /><span><small>Relationships</small><strong>{edges.length}</strong></span></article>
      <article><CheckCircle2 size={17} /><span><small>Proof links</small><strong>{edges.filter((edge) => edge.relationshipType === "PROVES").length}</strong></span></article>
      <article><ShieldAlert size={17} /><span><small>Blocking links</small><strong>{edges.filter((edge) => edge.relationshipType === "BLOCKS").length}</strong></span></article>
    </section>

    <section className="trace-studio">
      <div className="trace-canvas-panel">
        <header className="trace-toolbar"><div><p className="eyebrow">Live project provenance</p><h2>Relationship map</h2><small>{storedCount} controlled · {derivedCount} database-derived · select a record to isolate its path</small></div><div className="trace-controls"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an entity" /></label><label><Filter size={14} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All entity types</option>{allTypes.map((type) => <option value={type} key={type}>{TYPE_LABELS[type] ?? readable(type)}</option>)}</select></label><button type="button" className={showContextEdges ? "is-active" : ""} onClick={() => setShowContextEdges((value) => !value)}>{showContextEdges ? "Focus path" : "Show context"}</button><button type="button" className={showAll ? "is-active" : ""} onClick={() => setShowAll((value) => !value)}>{showAll ? "Hide isolated" : "Show all"}</button></div></header>
        <div className="trace-legend"><span><i className="legend-stored" />Controlled relationship</span><span><i className="legend-derived" />Database-derived relationship</span><span><i className="legend-focus" />Selected path</span></div>
        <div className="trace-canvas-scroll" tabIndex={0} aria-label="Scrollable traceability relationship graph">
          <svg className="trace-svg" viewBox={`0 0 1090 ${layout.height}`} role="img" aria-label={`${visibleNodes.length} visible entities and ${visibleEdges.length} visible relationships`}>
            <defs><marker id="trace-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
            {COLUMN_LABELS.map((label, index) => <g className="trace-column" key={label}><rect x={index * 184 + 8} y="8" width="168" height={layout.height - 16} rx="12" /><text x={index * 184 + 22} y="34">{label.toUpperCase()}</text></g>)}
            <g className="trace-edges">{visibleEdges.map((edge) => { const from = layout.positions.get(edge.fromId)!; const to = layout.positions.get(edge.toId)!; const x1 = from.x + 142; const y1 = from.y + 20; const x2 = to.x; const y2 = to.y + 20; const middle = x1 + (x2 - x1) / 2; const related = selectedId === edge.fromId || selectedId === edge.toId; const dimmed = Boolean(selectedId && !related); const path = `M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`; return <g className={`${edge.derived ? "is-derived" : "is-stored"} ${related ? "is-related" : ""} ${dimmed ? "is-dimmed" : ""}`} key={edge.id}><path d={path} markerEnd="url(#trace-arrow)" />{related && <text x={middle} y={Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 7} textAnchor="middle">{RELATION_LABELS[edge.relationshipType] ?? readable(edge.relationshipType)}</text>}</g>; })}</g>
            <g className="trace-nodes">{visibleNodes.map((node) => { const position = layout.positions.get(node.id)!; const selectedNode = selectedId === node.id; const related = neighborIds.has(node.id); const dimmed = Boolean(selectedId && !selectedNode && !related); return <g role="button" tabIndex={0} aria-label={`${TYPE_LABELS[node.type] ?? node.type}: ${node.label}`} className={`trace-node type-${node.type} ${selectedNode ? "is-selected" : ""} ${related ? "is-related" : ""} ${dimmed ? "is-dimmed" : ""}`} transform={`translate(${position.x} ${position.y})`} onClick={() => selectNode(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode(node.id); }} key={node.id}><rect width="142" height="42" rx="9" /><circle cx="13" cy="13" r="4" /><text className="trace-node-label" x="23" y="16">{short(node.label)}</text><text className="trace-node-meta" x="13" y="32">{TYPE_LABELS[node.type] ?? readable(node.type)} · {short(readable(node.state), 14)}</text></g>; })}</g>
          </svg>
        </div>
      </div>

      <aside className="trace-detail-rail">
        {selected ? <><header><div><span className={`status-pill ${stateTone(selected.state)}`}>{readable(selected.state)}</span><small>{TYPE_LABELS[selected.type] ?? readable(selected.type)}</small></div><h2>{selected.label}</h2><p className="trace-selected-explainer">This panel explains what the selected record depends on, proves, blocks, or delivers.</p><a className="trace-open-record" href={recordHref(selected)}>Open owning workspace <ExternalLink size={13} /></a><code>{selected.id}</code></header><section><div className="trace-section-title"><h3>Relationship story</h3><span>{selectedEdges.length}</span></div>{selectedEdges.length ? <div className="trace-story-list">{selectedEdges.map((edge) => { const outgoing = edge.fromId === selected.id; const other = nodeById.get(outgoing ? edge.toId : edge.fromId); return <button type="button" onClick={() => other && selectNode(other.id)} key={edge.id}><span className={`trace-relation-mark relation-${edge.relationshipType.toLowerCase()}`} /><p><b>{outgoing ? "This record" : other?.label ?? "Related record"}</b> {RELATION_LABELS[edge.relationshipType] ?? readable(edge.relationshipType)} <b>{outgoing ? other?.label ?? "related record" : "this record"}</b>.</p><small>{edge.derived ? "Database relationship" : "Controlled relationship"} <ArrowRight size={12} /></small></button>; })}</div> : <p className="trace-empty">This entity has no connected relationship yet.</p>}</section>
          <section><div className="trace-section-title"><h3><FileText size={15} /> Linked documents</h3><span>{expansion?.documents.length ?? 0}</span></div>{loading ? <p className="trace-empty">Loading context…</p> : expansion?.documents.length ? expansion.documents.map((document) => <Link href="/sources" className="trace-document" key={`${document.documentId}-${document.evidenceId}`}><b>{document.title}</b><small>{document.documentType} · revision {document.revision} · open document library</small></Link>) : <p className="trace-empty">No source document resolves through this neighbourhood.</p>}</section>
          <section><div className="trace-section-title"><h3><CircleDot size={15} /> Record activity</h3><span>{expansion?.audits.length ?? 0}</span></div>{expansion?.audits.slice(0, 6).map((event) => <article className="trace-audit" key={event.id}><i /><p><b>{readable(event.action.replaceAll(".", " "))}</b><small>{event.actorName ?? "System"} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</small></p></article>)}{!loading && !expansion?.audits.length && <p className="trace-empty">No direct audit event is recorded for this entity.</p>}</section></> : <div className="trace-empty-state"><Network size={24} /><h2>Select a node</h2><p>Its proof, dependencies, blockers, and history will be explained here.</p></div>}
        <details className="trace-connect"><summary><Plus size={14} /> Connect records</summary><form onSubmit={createEdge}><label>From<select name="from" defaultValue={selected ? `${selected.type}:${selected.id}` : ""} required><option value="">Select entity</option>{nodes.map((node) => <option value={`${node.type}:${node.id}`} key={`from-${node.id}`}>{TYPE_LABELS[node.type]}: {short(node.label, 42)}</option>)}</select></label><label>Relationship<select name="relationshipType" defaultValue="AFFECTS">{Object.keys(RELATION_LABELS).map((relation) => <option value={relation} key={relation}>{readable(relation)}</option>)}</select></label><label>To<select name="to" required><option value="">Select entity</option>{nodes.map((node) => <option value={`${node.type}:${node.id}`} key={`to-${node.id}`}>{TYPE_LABELS[node.type]}: {short(node.label, 42)}</option>)}</select></label><button className="button button-primary">Create relationship</button>{message && <p role="status">{message}</p>}</form></details>
      </aside>
    </section>
  </div>;
}
