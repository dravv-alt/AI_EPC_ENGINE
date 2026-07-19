"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Node = { id: string; type: string; label: string; state: string };
type Edge = { id: string; fromType: string; fromId: string; relationshipType: string; toType: string; toId: string };
type Audit = { id: string; action: string; entityType: string; entityId: string; createdAt: Date | string; actorName: string | null; eventHash: string };

export function GraphWorkbench({ projectId, nodes, edges, audit }: { projectId: string; nodes: Node[]; edges: Edge[]; audit: Audit[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(nodes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [expandedNodeDetails, setExpandedNodeDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const selected = nodes.find((node) => node.id === selectedId);
  const labels = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const connected = selected ? edges.filter((edge) => edge.fromId === selected.id || edge.toId === selected.id) : [];

  // Call node expansion API when a new node is selected
  useEffect(() => {
    if (!selectedId) return;
    
    let mounted = true;
    
    const fetchNodeDetails = async () => {
      setLoadingDetails(true);
      setExpandedNodeDetails(null);
      
      try {
        const url = selected ? `/api/projects/${projectId}/graph/nodes/${selectedId}?type=${selected.type}` : `/api/projects/${projectId}/graph/nodes/${selectedId}`;
        const response = await fetch(url);
        if (response.ok && mounted) {
          const data = await response.json();
          setExpandedNodeDetails(data.details);
        }
      } catch (err) {
        console.error("Failed to expand node:", err);
      } finally {
        if (mounted) setLoadingDetails(false);
      }
    };
    
    void fetchNodeDetails();
    
    return () => { mounted = false; };
  }, [selectedId, projectId]);

  async function createEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const [fromType, fromId] = String(values.get("from")).split(":");
    const [toType, toId] = String(values.get("to")).split(":");
    const response = await fetch(`/api/projects/${projectId}/edges`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromType, fromId, relationshipType: values.get("relationshipType"), toType, toId }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? body.duplicate ? "That relationship already exists." : "Relationship created and audited." : body.error ?? "Unable to create relationship.");
    if (response.ok && !body.duplicate) router.refresh();
  }

  return <div className="graph-layout">
    <section className="surface graph-browser">
      <div className="section-heading"><div><p className="eyebrow">Live authority graph</p><h2>{nodes.length} entities · {edges.length} relationships</h2></div></div>
      <div className="graph-node-grid">{nodes.map((node) => <button className={`graph-node ${selectedId === node.id ? "is-selected" : ""}`} onClick={() => setSelectedId(node.id)} key={`${node.type}:${node.id}`}><span>{node.type.replaceAll("_", " ")}</span><b>{node.label}</b><small>{node.state.replaceAll("_", " ")}</small></button>)}</div>
      {!nodes.length && <div className="empty-state"><h2>No graph entities yet</h2><p>Create systems, assets, gates, requirements, or evidence first.</p></div>}
    </section>
    
    <aside className="workflow-stack">
      <section className="surface workflow-card">
        <p className="eyebrow">Selected context</p>
        <h2>{selected?.label ?? "Select an entity"}</h2>
        {selected && <p>{selected.type.replaceAll("_", " ")} · {selected.state.replaceAll("_", " ")}</p>}
        
        {loadingDetails && <p style={{ fontSize: "12px", color: "var(--foreground-muted)" }}>Loading node details...</p>}
        {expandedNodeDetails && (
          <div style={{ padding: "12px", background: "var(--background)", borderRadius: "4px", marginTop: "12px", marginBottom: "12px", fontSize: "13px" }}>
            <span className="mono clause" style={{ display: "block", marginBottom: "4px" }}>Expanded Data:</span>
            {expandedNodeDetails.metadata}
            {expandedNodeDetails.relatedDocument && (
              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <span className="mono clause" style={{ display: "block", marginBottom: "4px" }}>Related Document:</span>
                <div><b>{expandedNodeDetails.relatedDocument.title}</b> (Rev {expandedNodeDetails.relatedDocument.revision})</div>
                <div style={{ color: "var(--foreground-muted)", marginBottom: "8px" }}>Type: {expandedNodeDetails.relatedDocument.documentType}</div>
                {expandedNodeDetails.relatedDocument.extractedText && (
                  <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px", maxHeight: "150px", overflowY: "auto", fontSize: "12px", border: "1px solid var(--border)" }}>
                    {expandedNodeDetails.relatedDocument.extractedText}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="connection-list">
          {connected.map((edge) => { 
            const otherId = edge.fromId === selected?.id ? edge.toId : edge.fromId; 
            const other = labels.get(otherId); 
            return <button className="entity-row" onClick={() => setSelectedId(otherId)} key={edge.id}>
              <div><b>{edge.relationshipType}</b><span>{other?.label ?? otherId}</span></div>
              <small>{other?.type.replaceAll("_", " ")}</small>
            </button>; 
          })}
          {selected && !connected.length && <p className="workflow-hint">No relationships are connected yet.</p>}
        </div>
      </section>
      
      <form className="surface compact-form" onSubmit={createEdge}>
        <div><p className="eyebrow">Typed relationship</p><h2>Connect records</h2></div>
        <label>From<select name="from" required><option value="">Select entity</option>{nodes.map((node) => <option value={`${node.type}:${node.id}`} key={`from-${node.type}-${node.id}`}>{node.type}: {node.label}</option>)}</select></label>
        <label>Relationship<select name="relationshipType" defaultValue="AFFECTS"><option>AFFECTS</option><option>PROVES</option><option>PRECEDES</option><option>BLOCKS</option><option>BELONGS_TO</option><option>SUPERSEDES</option><option>DUPLICATE_OF</option><option>GENERATED_FROM</option></select></label>
        <label>To<select name="to" required><option value="">Select entity</option>{nodes.map((node) => <option value={`${node.type}:${node.id}`} key={`to-${node.type}-${node.id}`}>{node.type}: {node.label}</option>)}</select></label>
        <button className="button button-primary" disabled={nodes.length < 2}>Create relationship</button>{message && <p className="form-message" role="status">{message}</p>}
      </form>
      
      <details className="surface history-panel" open>
        <summary>Audit timeline ({audit.length})</summary>
        {audit.slice(0, 50).map((event) => 
          <article className="entity-row" key={event.id}>
            <div><b>{event.action.replaceAll(".", " ")}</b><span>{event.actorName ?? "System"} · {event.entityType}</span></div>
            <small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}<br />{event.eventHash.slice(0, 10)}…</small>
          </article>
        )}
      </details>
    </aside>
  </div>;
}
