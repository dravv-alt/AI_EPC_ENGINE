"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type Claim = { text: string; sourceRegionId: string; documentVersionId: string; contentHash: string; score: number };

export function KnowledgeSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState(""); const [claims, setClaims] = useState<Claim[]>([]); const [message, setMessage] = useState("Ask about controlled project documents."); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); const response = await fetch(`/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) }); const result = await response.json(); setLoading(false); if (!response.ok) return setMessage(result.error ?? "Query failed."); setClaims(result.claims); setMessage(result.noResults ? "No cited project source matched this query." : `${result.claims.length} cited region${result.claims.length === 1 ? "" : "s"} matched.`); }
  return <div className="workflow-stack"><form className="query-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} required placeholder="What does the controlled procedure require?" /><button className="button button-primary" disabled={loading}><Search size={16} />{loading ? "Searching…" : "Search sources"}</button></form><p className="workflow-hint">{message}</p>{claims.map((claim) => <article className="surface workflow-card" key={claim.sourceRegionId}><span className="mono clause">Cited controlled region</span><p>{claim.text}</p><small>Region {claim.sourceRegionId} · Version {claim.documentVersionId} · SHA {claim.contentHash.slice(0, 12)}…</small></article>)}</div>;
}
