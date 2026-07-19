"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Claim = {
  regionId: string;
  score: number;
  text: string;
  pageNumber: string;
  documentVersionId: string;
};

export function KnowledgeSearch({ projectId, initialQuery = "" }: { projectId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [message, setMessage] = useState("Ask about controlled project documents.");
  const [loading, setLoading] = useState(false);

  async function runQuery(value: string) {
    setLoading(true);
    setAnswer(null);
    setClaims([]);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: value })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setMessage(result.error ?? "Query failed.");
      } else {
        setClaims(result.claims || []);
        setAnswer(result.answer || null);
        setMessage(
          result.noResults
            ? "No cited project source matched this query."
            : `${result.claims?.length || 0} cited region${result.claims?.length === 1 ? "" : "s"} matched.`
        );
      }
    } catch (err) {
      setMessage("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await runQuery(query);
  }

  useEffect(() => {
    if (initialQuery.trim().length >= 3) {
      void runQuery(initialQuery);
    }
  }, [initialQuery]);

  return (
    <div className="workflow-stack">
      <form className="query-form" onSubmit={submit}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={3}
          required
          placeholder="What does the controlled procedure require?"
        />
        <button className="button button-primary" disabled={loading}>
          <Search size={16} />
          {loading ? "Searching…" : "Search sources"}
        </button>
      </form>
      
      <p className="workflow-hint">{message}</p>
      
      {answer && (
        <article className="surface workflow-card synthesis-card" style={{ borderLeft: "4px solid var(--accent)" }}>
          <h3 style={{ margin: "0 0 8px 0" }}>AI Synthesis</h3>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{answer}</p>
        </article>
      )}
      
      {claims.map((claim) => (
        <article className="surface workflow-card" key={claim.regionId}>
          <span className="mono clause">Source: Page {claim.pageNumber}</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{claim.text}</p>
          <small>
            Region {claim.regionId} · Version {claim.documentVersionId} · Score {(claim.score * 100).toFixed(1)}%
          </small>
        </article>
      ))}
    </div>
  );
}
