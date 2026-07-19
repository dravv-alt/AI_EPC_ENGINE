"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, MessageSquareQuote, BookOpen } from "lucide-react";

type GraphContextEntry = { id: string; type: string; label: string; state: string; relationshipType: string; anchorType: "requirement" | "evidence"; anchorId: string };
type Claim = { text: string; content?: string; sourceRegionId: string; documentVersionId: string | null; documentType?: string; contentHash: string; similarity: number; graphContext?: GraphContextEntry[] };
type AnswerGroup = { text: string; claims: Claim[] };
type SearchStatus = "idle" | "loading" | "empty" | "results" | "error";

function groupClaimsByText(claims: Claim[]): AnswerGroup[] {
  const order: string[] = [];
  const byText = new Map<string, Claim[]>();
  for (const claim of claims) {
    if (!byText.has(claim.text)) { byText.set(claim.text, []); order.push(claim.text); }
    byText.get(claim.text)!.push(claim);
  }
  return order.map((text) => ({ text, claims: byText.get(text)! }));
}

function CitationChips({ claims }: { claims: Claim[] }) {
  return (
    <div className="citation-strip">
      {claims.map((claim) => (
        <Link href={`/sources/regions/${claim.sourceRegionId}`} key={`${claim.sourceRegionId}-${claim.contentHash}`}>
          <BookOpen size={13} />
          Region {claim.sourceRegionId.slice(0, 8)} · Rev {claim.documentVersionId?.slice(0, 8) ?? "—"} · SHA {claim.contentHash.slice(0, 12)}…
          <span>{Math.round(claim.similarity * 100)}%</span>
        </Link>
      ))}
    </div>
  );
}

function GraphContextNote({ claims }: { claims: Claim[] }) {
  const seen = new Set<string>();
  const entries: GraphContextEntry[] = [];
  for (const claim of claims) {
    for (const entry of claim.graphContext ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  if (!entries.length) return null;
  return (
    <small className="mono">
      Also {entries.map((entry) => `${entry.relationshipType.toLowerCase().replaceAll("_", " ")}: ${entry.label} (${entry.state})`).join(" · ")}
    </small>
  );
}

export function KnowledgeSearch({ projectId, initialQuery = "" }: { projectId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [groups, setGroups] = useState<AnswerGroup[]>([]);
  const [message, setMessage] = useState("Ask about controlled project documents.");

  async function runQuery(value: string) {
    setStatus("loading");
    const response = await fetch(`/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: value }) });
    const result = await response.json();
    if (!response.ok) { setStatus("error"); setMessage(result.error ?? "Query failed."); return; }
    const claims: Claim[] = result.claims ?? [];
    if (result.noResults || claims.length === 0) {
      setStatus("empty");
      setAnswer(null);
      setGroups([]);
      return;
    }
    setAnswer(result.answer ?? null);
    setGroups(groupClaimsByText(claims));
    setStatus("results");
  }

  async function submit(event: React.FormEvent) { event.preventDefault(); await runQuery(query); }
  useEffect(() => { if (initialQuery.trim().length >= 3) void runQuery(initialQuery); }, [initialQuery]);

  return (
    <div className="workflow-stack">
      <form className="query-form" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} required placeholder="What does the controlled procedure require?" />
        <button className="button button-primary" disabled={status === "loading"}><Search size={16} />{status === "loading" ? "Searching…" : "Search sources"}</button>
      </form>

      {status === "idle" && <p className="workflow-hint">{message}</p>}
      {status === "error" && <p className="workflow-hint">{message}</p>}
      {status === "loading" && <p className="workflow-hint">Searching controlled project sources…</p>}

      {status === "empty" && (
        <section className="surface empty-state">
          <h2>No results in scope</h2>
          <p>No controlled project source answers this query within scope. Try broadening your query or check a different document type.</p>
        </section>
      )}

      {status === "results" && (
        <>
          <p className="workflow-hint">{groups.length} cited answer{groups.length === 1 ? "" : "s"} matched.</p>
          {answer && (
            <article className="surface workflow-card">
              <span className="mono clause">Synthesized answer</span>
              <p>{answer}</p>
            </article>
          )}
          {groups.map((group) => (
            <article className="surface workflow-card" key={group.text}>
              <span className="mono clause">Cited claim</span>
              <p>{group.text}</p>
              <CitationChips claims={group.claims} />
              <GraphContextNote claims={group.claims} />
            </article>
          ))}
        </>
      )}

      <RfiSimilarity projectId={projectId} />
    </div>
  );
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
  return (
    <section className="workflow-stack" style={{ marginTop: "1.5rem" }}>
      <h3 className="workflow-subtitle">Similar resolved RFIs</h3>
      <p className="advisory-note">Advisory only — each suggestion cites its source RFI record. This panel never auto-answers or closes the query.</p>
      <form className="query-form" onSubmit={submit}>
        <input value={text} onChange={(event) => setText(event.target.value)} minLength={3} required placeholder="Paste the RFI you are drafting…" />
        <button className="button button-secondary" disabled={loading}><MessageSquareQuote size={16} />{loading ? "Matching…" : "Find similar RFIs"}</button>
      </form>
      <p className="workflow-hint">{message}</p>
      {suggestions.map((suggestion) => (
        <article className="surface workflow-card" key={suggestion.contentHash}>
          <span className="mono clause">Resolved RFI · {Math.round(suggestion.similarity * 100)}% match</span>
          <p>{suggestion.content ?? suggestion.text}</p>
          <CitationChips claims={[suggestion]} />
        </article>
      ))}
    </section>
  );
}
