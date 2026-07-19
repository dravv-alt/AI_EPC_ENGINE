"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Node = { id: string; type: string; label: string; state: string };
type Edge = {
  id: string;
  fromType: string;
  fromId: string;
  relationshipType: string;
  toType: string;
  toId: string;
};
type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date | string;
  actorName: string | null;
  eventHash: string;
};
type LinkedDoc = {
  evidenceId: string;
  documentId: string;
  title: string;
  documentType: string;
  revision: string;
};
type SupplyRecord = { id: string; label: string; state: string };
type Expansion = {
  node: Node;
  neighbors: { edge: Edge; node: Node }[];
  documents: LinkedDoc[];
  supply: SupplyRecord[];
  audits: AuditEntry[];
};

// ── colour helpers ────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  system:        "#2d463e",
  asset:         "#3a5f54",
  gate:          "#b5651d",
  requirement:   "#583935",
  evidence:      "#285d4b",
  finding:       "#be1e2d",
  schedule_task: "#5c4a7a",
  shipment:      "#1a4f72",
  cx_test:       "#6b5c00",
};

const STATE_PILL: Record<string, { bg: string; color: string }> = {
  accepted:             { bg: "#e3eee7", color: "#285d4b" },
  approved:             { bg: "#e3eee7", color: "#285d4b" },
  completed:            { bg: "#e3eee7", color: "#285d4b" },
  green:                { bg: "#e3eee7", color: "#285d4b" },
  pending:              { bg: "#f8eadb", color: "#8d4a0a" },
  proposed:             { bg: "#f8eadb", color: "#8d4a0a" },
  in_review:            { bg: "#f8eadb", color: "#8d4a0a" },
  in_progress:          { bg: "#f8eadb", color: "#8d4a0a" },
  amber:                { bg: "#f8eadb", color: "#8d4a0a" },
  needs_human_review:   { bg: "#f8eadb", color: "#8d4a0a" },
  rejected:             { bg: "#f8e3e5", color: "#971a27" },
  blocked:              { bg: "#f8e3e5", color: "#971a27" },
  open:                 { bg: "#f8e3e5", color: "#971a27" },
  stale:                { bg: "#f3e8d3", color: "#7a4e10" },
  failed:               { bg: "#f8e3e5", color: "#971a27" },
  red:                  { bg: "#f8e3e5", color: "#971a27" },
  edited:               { bg: "#edf3f9", color: "#1a4f72" },
  not_started:          { bg: "#eceeeb", color: "#5f6662" },
  closed:               { bg: "#eceeeb", color: "#5f6662" },
  proposed_pass:        { bg: "#e3eee7", color: "#285d4b" },
  proposed_fail:        { bg: "#f8e3e5", color: "#971a27" },
};

function StatePill({ state }: { state: string }) {
  const style = STATE_PILL[state] ?? { bg: "#eceeeb", color: "#5f6662" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 8px",
      borderRadius: 999, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: ".04em",
      background: style.bg, color: style.color,
    }}>
      {state.replaceAll("_", " ")}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#6d7470";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 7px",
      borderRadius: 4, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: ".05em",
      background: color + "18", color, border: `1px solid ${color}30`,
    }}>
      {type.replaceAll("_", " ")}
    </span>
  );
}

const REL_COLORS: Record<string, string> = {
  AFFECTS:        "#b5651d",
  PROVES:         "#285d4b",
  PRECEDES:       "#1a4f72",
  BLOCKS:         "#be1e2d",
  BELONGS_TO:     "#583935",
  SUPERSEDES:     "#5c4a7a",
  DUPLICATE_OF:   "#6d7470",
  GENERATED_FROM: "#3a5f54",
};

function RelBadge({ rel }: { rel: string }) {
  const color = REL_COLORS[rel] ?? "#6d7470";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 7px",
      borderRadius: 3, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700,
      textTransform: "uppercase", background: color + "18", color,
      border: `1px solid ${color}30`,
    }}>
      {rel}
    </span>
  );
}

// ── detail panel sections ─────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "20px 0 10px", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".055em" }}>
      {children}
    </p>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function GraphWorkbench({
  projectId, nodes, edges, audit,
}: {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  audit: AuditEntry[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(nodes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"neighbors" | "docs" | "supply" | "audit">("neighbors");

  const selected = nodes.find((n) => n.id === selectedId);
  const labels = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const connected = selected
    ? edges.filter((e) => e.fromId === selected.id || e.toId === selected.id)
    : [];

  // Filter + search
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const allTypes = useMemo(() => Array.from(new Set(nodes.map((n) => n.type))).sort(), [nodes]);
  const visibleNodes = useMemo(() => {
    let list = nodes;
    if (typeFilter !== "all") list = list.filter((n) => n.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q));
    }
    return list;
  }, [nodes, typeFilter, search]);

  useEffect(() => {
    if (!selectedId) { setExpansion(null); return; }
    setLoading(true);
    let active = true;
    fetch(`/api/projects/${projectId}/graph/nodes/${selectedId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (active) { setExpansion(body); setLoading(false); } })
      .catch(() => { if (active) { setExpansion(null); setLoading(false); } });
    return () => { active = false; };
  }, [projectId, selectedId]);

  // Reset to neighbors tab when node changes
  useEffect(() => { setActiveTab("neighbors"); }, [selectedId]);

  async function createEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const [fromType, fromId] = String(values.get("from")).split(":");
    const [toType, toId] = String(values.get("to")).split(":");
    const response = await fetch(`/api/projects/${projectId}/edges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromType, fromId, relationshipType: values.get("relationshipType"), toType, toId }),
    });
    const body = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? body.duplicate ? "That relationship already exists." : "Relationship created and audited."
        : body.error ?? "Unable to create relationship."
    );
    if (response.ok && !body.duplicate) router.refresh();
  }

  const tabCounts = expansion
    ? {
        neighbors: expansion.neighbors.length,
        docs:      expansion.documents.length,
        supply:    expansion.supply.length,
        audit:     expansion.audits.length,
      }
    : { neighbors: connected.length, docs: 0, supply: 0, audit: 0 };

  return (
    <div className="graph-layout">
      {/* ── LEFT: node browser ── */}
      <section className="surface graph-browser">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live authority graph</p>
            <h2>{nodes.length} entities · {edges.length} relationships</h2>
          </div>
          {/* filters */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes…"
              style={{ minHeight: 34, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 5, background: "#fffefa", fontSize: 12, width: 160 }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ minHeight: 34, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "#fffefa", fontSize: 11 }}
            >
              <option value="all">All types</option>
              {allTypes.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        </div>

        {visibleNodes.length === 0 && (
          <div className="empty-state">
            <h2>No matching entities</h2>
            <p>Adjust your search or type filter.</p>
          </div>
        )}

        <div className="graph-node-grid">
          {visibleNodes.map((node) => {
            const color = TYPE_COLORS[node.type] ?? "#6d7470";
            const isSelected = selectedId === node.id;
            const edgeCount = edges.filter((e) => e.fromId === node.id || e.toId === node.id).length;
            return (
              <button
                key={`${node.type}:${node.id}`}
                className={`graph-node ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedId(node.id)}
                style={{ borderTopColor: isSelected ? color : undefined, borderTopWidth: isSelected ? 3 : 1 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <span style={{ color }}>{node.type.replaceAll("_", " ")}</span>
                  {edgeCount > 0 && (
                    <span style={{ display: "grid", placeItems: "center", minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: color + "18", color, fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700 }}>
                      {edgeCount}
                    </span>
                  )}
                </div>
                <b>{node.label}</b>
                <StatePill state={node.state} />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── RIGHT: detail + create ── */}
      <aside className="workflow-stack">

        {/* node detail card */}
        <section className="surface" style={{ padding: 0, overflow: "hidden" }}>
          {/* header */}
          <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid var(--line)" }}>
            {selected ? (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                  <TypeBadge type={selected.type} />
                  <StatePill state={selected.state} />
                </div>
                <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>{selected.label}</h2>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9 }}>
                  {selected.id}
                </p>
              </>
            ) : (
              <h2 style={{ margin: 0 }}>Select an entity</h2>
            )}
          </div>

          {/* tabs */}
          {selected && (
            <>
              <div style={{ display: "flex", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
                {(["neighbors", "docs", "supply", "audit"] as const).map((tab) => {
                  const labels = { neighbors: "Neighbors", docs: "Documents", supply: "Supply", audit: "Audit" };
                  const count = tabCounts[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        flex: "0 0 auto", padding: "10px 16px", border: 0, borderBottom: activeTab === tab ? "2px solid var(--secondary)" : "2px solid transparent",
                        background: "transparent", color: activeTab === tab ? "var(--secondary)" : "var(--muted)",
                        fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {labels[tab]}
                      {count > 0 && (
                        <span style={{ display: "grid", placeItems: "center", minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: activeTab === tab ? "#f8eadb" : "#eceeeb", color: activeTab === tab ? "#8d4a0a" : "#5f6662", fontSize: 8 }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: "4px 22px 22px", maxHeight: 480, overflowY: "auto" }}>
                {loading && (
                  <p style={{ marginTop: 20, color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>Loading expansion…</p>
                )}

                {/* NEIGHBORS tab */}
                {!loading && activeTab === "neighbors" && (
                  <>
                    {/* from expansion (if loaded) */}
                    {expansion && expansion.node.id === selectedId ? (
                      expansion.neighbors.length > 0 ? (
                        expansion.neighbors.map((entry) => (
                          <button
                            key={entry.edge.id}
                            className="entity-row"
                            onClick={() => setSelectedId(entry.node.id)}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                                <RelBadge rel={entry.edge.relationshipType} />
                                <TypeBadge type={entry.node.type} />
                              </div>
                              <b style={{ display: "block", fontSize: 12 }}>{entry.node.label}</b>
                            </div>
                            <StatePill state={entry.node.state} />
                          </button>
                        ))
                      ) : (
                        <p className="workflow-hint" style={{ marginTop: 16 }}>No relationships connected yet.</p>
                      )
                    ) : (
                      /* fallback to local edge list */
                      connected.length > 0 ? (
                        connected.map((edge) => {
                          const otherId = edge.fromId === selected.id ? edge.toId : edge.fromId;
                          const other = labels.get(otherId);
                          return (
                            <button key={edge.id} className="entity-row" onClick={() => setSelectedId(otherId)}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                                  <RelBadge rel={edge.relationshipType} />
                                  {other && <TypeBadge type={other.type} />}
                                </div>
                                <b style={{ display: "block", fontSize: 12 }}>{other?.label ?? otherId}</b>
                              </div>
                              {other && <StatePill state={other.state} />}
                            </button>
                          );
                        })
                      ) : (
                        <p className="workflow-hint" style={{ marginTop: 16 }}>No relationships connected yet.</p>
                      )
                    )}
                  </>
                )}

                {/* DOCUMENTS tab */}
                {!loading && activeTab === "docs" && (
                  <>
                    {expansion && expansion.documents.length > 0 ? (
                      expansion.documents.map((doc) => (
                        <div key={`${doc.evidenceId}-${doc.documentId}`} style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700, textTransform: "uppercase", background: "#e3eee7", color: "#285d4b" }}>
                              {doc.documentType}
                            </span>
                            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 9, fontFamily: "var(--mono)", fontWeight: 700, background: "#edf3f9", color: "#1a4f72" }}>
                              {doc.revision}
                            </span>
                          </div>
                          <b style={{ display: "block", fontSize: 12 }}>{doc.title}</b>
                          <small style={{ marginTop: 3, color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9 }}>
                            via evidence {doc.evidenceId.slice(0, 8)}…
                          </small>
                        </div>
                      ))
                    ) : (
                      <p className="workflow-hint" style={{ marginTop: 16 }}>
                        No linked documents — evidence in this node&apos;s neighbourhood must reference a source region to appear here.
                      </p>
                    )}
                  </>
                )}

                {/* SUPPLY tab */}
                {!loading && activeTab === "supply" && (
                  <>
                    {expansion && expansion.supply.length > 0 ? (
                      expansion.supply.map((item) => (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0", borderTop: "1px solid var(--line)" }}>
                          <div>
                            <b style={{ display: "block", fontSize: 12 }}>{item.label}</b>
                            <small style={{ marginTop: 3, color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9 }}>{item.id.slice(0, 8)}…</small>
                          </div>
                          <StatePill state={item.state} />
                        </div>
                      ))
                    ) : (
                      <p className="workflow-hint" style={{ marginTop: 16 }}>No shipment records linked to this node&apos;s neighbourhood.</p>
                    )}
                  </>
                )}

                {/* AUDIT tab */}
                {!loading && activeTab === "audit" && (
                  <>
                    {expansion && expansion.audits.length > 0 ? (
                      expansion.audits.slice(0, 40).map((ev) => (
                        <article key={ev.id} style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div>
                              <b style={{ display: "block", fontSize: 12 }}>{ev.action.replaceAll(".", " ")}</b>
                              <span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 10 }}>
                                {ev.actorName ?? "System"} · {ev.entityType}
                              </span>
                            </div>
                            <small style={{ textAlign: "right", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 9, whiteSpace: "nowrap" }}>
                              {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ev.createdAt))}
                            </small>
                          </div>
                          <div style={{ marginTop: 6, padding: "5px 8px", background: "#f5f3ee", borderRadius: 4 }}>
                            <code style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)" }}>
                              {ev.eventHash.slice(0, 16)}…
                            </code>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="workflow-hint" style={{ marginTop: 16 }}>No audit events recorded for this node yet.</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {!selected && (
            <p style={{ padding: "20px 22px", color: "var(--muted)", fontSize: 12 }}>
              Click any entity card on the left to inspect its relationships, linked documents, supply records, and audit history.
            </p>
          )}
        </section>

        {/* create relationship form */}
        <form className="surface compact-form" onSubmit={createEdge} style={{ gridTemplateColumns: "1fr" }}>
          <div><p className="eyebrow">Typed relationship</p><h2>Connect records</h2></div>
          <label>
            From
            <select name="from" required>
              <option value="">Select entity</option>
              {nodes.map((n) => (
                <option key={`from-${n.type}-${n.id}`} value={`${n.type}:${n.id}`}>
                  {n.type.replaceAll("_", " ")}: {n.label.slice(0, 50)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relationship
            <select name="relationshipType" defaultValue="AFFECTS">
              {["AFFECTS", "PROVES", "PRECEDES", "BLOCKS", "BELONGS_TO", "SUPERSEDES", "DUPLICATE_OF", "GENERATED_FROM"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            To
            <select name="to" required>
              <option value="">Select entity</option>
              {nodes.map((n) => (
                <option key={`to-${n.type}-${n.id}`} value={`${n.type}:${n.id}`}>
                  {n.type.replaceAll("_", " ")}: {n.label.slice(0, 50)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button className="button button-primary" disabled={nodes.length < 2}>
              Create relationship
            </button>
            {message && <p className="form-message" role="status" style={{ marginTop: 8 }}>{message}</p>}
          </div>
        </form>

        {/* global audit timeline */}
        <details className="surface history-panel" open>
          <summary>Project audit timeline ({audit.length})</summary>
          {audit.slice(0, 60).map((ev) => (
            <article className="entity-row" key={ev.id}>
              <div>
                <b>{ev.action.replaceAll(".", " ")}</b>
                <span>{ev.actorName ?? "System"} · {ev.entityType}</span>
              </div>
              <small style={{ textAlign: "right" }}>
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ev.createdAt))}
                <br />{ev.eventHash.slice(0, 10)}…
              </small>
            </article>
          ))}
        </details>
      </aside>
    </div>
  );
}
