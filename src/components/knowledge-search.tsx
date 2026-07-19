"use client";

import { useEffect, useState } from "react";
import { Search, MessageSquareQuote } from "lucide-react";

type Claim = { text: string; content?: string; sourceRegionId: string; documentVersionId: string | null; documentType?: string; contentHash: string; similarity: number };

export function KnowledgeSearch({ projectId, initialQuery = "" }: { projectId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery); const [claims, setClaims] = useState<Claim[]>([]); const [message, setMessage] = useState("Ask about controlled project documents."); const [loading, setLoading] = useState(false);
  async function runQuery(value: string) { setLoading(true); const response = await fetch(`/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: value }) }); const result = await response.json(); setLoading(false); if (!response.ok) return setMessage(result.error ?? "Query failed."); setClaims(result.claims); setMessage(result.noResults ? "No cited project source matched this query." : `${result.claims.length} cited region${result.claims.length === 1 ? "" : "s"} matched.`); }
  async function submit(event: React.FormEvent) { event.preventDefault(); await runQuery(query); }
  useEffect(() => { if (initialQuery.trim().length >= 3) void runQuery(initialQuery); }, [initialQuery]);
  return <div className="workflow-stack"><form className="query-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} required placeholder="What does the controlled procedure require?" /><button className="button button-primary" disabled={loading}><Search size={16} />{loading ? "Searching…" : "Search sources"}</button></form><p className="workflow-hint">{message}</p>{claims.map((claim) => <article className="surface workflow-card" key={claim.sourceRegionId}><span className="mono clause">Cited controlled region · {Math.round(claim.similarity * 100)}% match</span><p>{claim.content ?? claim.text}</p><small>Region {claim.sourceRegionId} · Version {claim.documentVersionId ?? "—"} · SHA {claim.contentHash.slice(0, 12)}…</small></article>)}<RfiSimilarity projectId={projectId} /></div>;
}

export function RfiSimilarity({ projectId }: { projectId: string }) {
  const [text, setText] = useState(""); const [suggestions, setSuggestions] = useState<Claim[]>([]); const [message, setMessage] = useState("Enter RFI text to find previously resolved similar RFIs."); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/knowledge/rfi-similar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const result = await response.json(); setLoading(false);
    if (!response.ok) return setMessage(result.error ?? "Lookup failed.");
    setSuggestions(result.suggestions); setMessage(result.noResults ? "No previously resolved RFI is similar enough." : `${result.suggestions.length} previously resolved RFI${result.suggestions.length === 1 ? "" : "s"} may be relevant.`);
  }
  return <section className="workflow-stack" style={{ marginTop: "1.5rem" }}><h3 className="workflow-subtitle">Similar resolved RFIs</h3><form className="query-form" onSubmit={submit}><input value={text} onChange={(event) => setText(event.target.value)} minLength={3} required placeholder="Paste the RFI you are drafting…" /><button className="button button-secondary" disabled={loading}><MessageSquareQuote size={16} />{loading ? "Matching…" : "Find similar RFIs"}</button></form><p className="workflow-hint">{message}</p>{suggestions.map((suggestion) => <article className="surface workflow-card" key={suggestion.contentHash}><span className="mono clause">Resolved RFI · {Math.round(suggestion.similarity * 100)}% match</span><p>{suggestion.content ?? suggestion.text}</p><small>Region {suggestion.sourceRegionId} · SHA {suggestion.contentHash.slice(0, 12)}…</small></article>)}</section>;
}
