"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, MessageSquareQuote, BookOpen } from "lucide-react";

type GraphContextEntry = { id: string; type: string; label: string; state: string; relationshipType: string; anchorType: "requirement" | "evidence"; anchorId: string };
type Claim = { text: string; content?: string; sourceRegionId: string; documentVersionId: string | null; documentId?: string | null; documentTitle?: string | null; documentType?: string; contentHash: string; similarity: number; graphContext?: GraphContextEntry[] };
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
          {claim.documentTitle ?? "Controlled source"} · Region {claim.sourceRegionId.slice(0, 8)} · Rev {claim.documentVersionId?.slice(0, 8) ?? "—"} · SHA {claim.contentHash.slice(0, 12)}…
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

type ScopeOption = { id: string; label: string };

function distinguishDuplicateLabels(options: ScopeOption[]) {
  const totals = new Map<string, number>();
  options.forEach((option) => totals.set(option.label, (totals.get(option.label) ?? 0) + 1));
  const seen = new Map<string, number>();
  return options.map((option) => {
    if ((totals.get(option.label) ?? 0) < 2) return option;
    const occurrence = (seen.get(option.label) ?? 0) + 1;
    seen.set(option.label, occurrence);
    return { ...option, label: `${option.label} · record ${occurrence}` };
  });
}

// Slice 10: mandatory-first metadata filter controls (ADR-021: tenant/project
// already enforced server-side; system/asset/gate/doc_type/date/revision are
// the caller-facing dimensions). These are plain selects/inputs — the actual
// filtering happens in SQL, before ranking, on the server; the UI just lets a
// reviewer express the same scope the endpoint already enforces.
function useScopeOptions(projectId: string) {
  const [systems, setSystems] = useState<ScopeOption[]>([]);
  const [assets, setAssets] = useState<ScopeOption[]>([]);
  const [gates, setGates] = useState<ScopeOption[]>([]);
  const [documents, setDocuments] = useState<ScopeOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [systemsRes, assetsRes, gatesRes, documentsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/systems`).then((response) => response.json()).catch(() => ({ items: [] })),
        fetch(`/api/projects/${projectId}/assets`).then((response) => response.json()).catch(() => ({ items: [] })),
        fetch(`/api/projects/${projectId}/gates`).then((response) => response.json()).catch(() => ({ items: [] })),
        fetch(`/api/projects/${projectId}/sources`).then((response) => response.json()).catch(() => ({ items: [] }))
      ]);
      if (cancelled) return;
      setSystems(distinguishDuplicateLabels((systemsRes.items ?? []).map((item: { id: string; name: string }) => ({ id: item.id, label: item.name }))));
      setAssets(distinguishDuplicateLabels((assetsRes.items ?? []).map((item: { id: string; tag: string }) => ({ id: item.id, label: item.tag }))));
      setGates(distinguishDuplicateLabels((gatesRes.items ?? []).map((item: { id: string; name: string }) => ({ id: item.id, label: item.name }))));
      setDocuments(distinguishDuplicateLabels((documentsRes.items ?? []).map((item: { id: string; title: string; revision: string }) => ({ id: item.id, label: `${item.title} · ${item.revision}` }))));
    }
    void load();
    return () => { cancelled = true; };
  }, [projectId]);
  return { systems, assets, gates, documents };
}

export type KnowledgeFilters = { documentId: string; systemId: string; assetId: string; gateId: string; revision: string; dateFrom: string; dateTo: string };

const EMPTY_FILTERS: KnowledgeFilters = { documentId: "", systemId: "", assetId: "", gateId: "", revision: "", dateFrom: "", dateTo: "" };

function KnowledgeFilterControls({ projectId, filters, onChange }: { projectId: string; filters: KnowledgeFilters; onChange: (filters: KnowledgeFilters) => void }) {
  const { systems, assets, gates, documents } = useScopeOptions(projectId);
  function update<K extends keyof KnowledgeFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }
  return (
    <fieldset className="filter-row" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", border: "none", padding: 0, margin: "0.5rem 0" }}>
      <legend style={{ fontSize: "0.8rem", opacity: 0.75 }}>Scope filter (mandatory, applied before ranking)</legend>
      <select aria-label="Document" value={filters.documentId} onChange={(event) => update("documentId", event.target.value)}>
        <option value="">All documents (named documents auto-scope)</option>
        {documents.map((document) => <option key={document.id} value={document.id}>{document.label}</option>)}
      </select>
      <select aria-label="System" value={filters.systemId} onChange={(event) => update("systemId", event.target.value)}>
        <option value="">All systems</option>
        {systems.map((system) => <option key={system.id} value={system.id}>{system.label}</option>)}
      </select>
      <select aria-label="Asset" value={filters.assetId} onChange={(event) => update("assetId", event.target.value)}>
        <option value="">All assets</option>
        {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}
      </select>
      <select aria-label="Gate" value={filters.gateId} onChange={(event) => update("gateId", event.target.value)}>
        <option value="">All gates</option>
        {gates.map((gate) => <option key={gate.id} value={gate.id}>{gate.label}</option>)}
      </select>
      <input aria-label="Revision" placeholder="Revision (e.g. Rev C)" value={filters.revision} onChange={(event) => update("revision", event.target.value)} />
      <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
        From <input aria-label="Date from" type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} />
      </label>
      <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
        To <input aria-label="Date to" type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} />
      </label>
    </fieldset>
  );
}

function filtersToBody(filters: KnowledgeFilters) {
  const body: Record<string, string> = {};
  if (filters.documentId) body.documentId = filters.documentId;
  if (filters.systemId) body.systemId = filters.systemId;
  if (filters.assetId) body.assetId = filters.assetId;
  if (filters.gateId) body.gateId = filters.gateId;
  if (filters.revision) body.revision = filters.revision;
  if (filters.dateFrom) body.dateFrom = new Date(filters.dateFrom).toISOString();
  if (filters.dateTo) body.dateTo = new Date(filters.dateTo).toISOString();
  return body;
}

export function KnowledgeSearch({ projectId, initialQuery = "" }: { projectId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [groups, setGroups] = useState<AnswerGroup[]>([]);
  const [message, setMessage] = useState("Ask about controlled project documents.");
  const [filters, setFilters] = useState<KnowledgeFilters>(EMPTY_FILTERS);

  async function runQuery(value: string) {
    setStatus("loading");
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: value, ...filtersToBody(filters) }), signal: AbortSignal.timeout(45_000) });
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
    } catch {
      setStatus("error");
      setMessage("Search timed out after 45 seconds. Narrow the scope or try again; the page remains usable.");
    }
  }

  async function submit(event: React.FormEvent) { event.preventDefault(); await runQuery(query); }
  useEffect(() => { if (initialQuery.trim().length >= 3) void runQuery(initialQuery); }, [initialQuery]);

  return (
    <div className="workflow-stack">
      <form className="query-form" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} required placeholder="What does the controlled procedure require?" />
        <button className="button button-primary" disabled={status === "loading"}><Search size={16} />{status === "loading" ? "Searching…" : "Search sources"}</button>
      </form>
      <KnowledgeFilterControls projectId={projectId} filters={filters} onChange={setFilters} />

      {status === "idle" && <p className="workflow-hint">{message}</p>}
      {status === "error" && <p className="workflow-hint">{message}</p>}
      {status === "loading" && <p className="workflow-hint" role="status"><span className="operation-progress" aria-hidden="true" />Searching controlled project sources. This can take up to 45 seconds.</p>}

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
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Claim[]>([]);
  // Slice 9: unresolved matches are surfaced separately and must never render
  // under the "resolved" heading — resolutionState distinguishes an open RFI
  // from a resolved one, which documentVersions.status never did.
  const [unresolvedSuggestions, setUnresolvedSuggestions] = useState<Claim[]>([]);
  const [message, setMessage] = useState("Enter RFI text to find previously resolved similar RFIs.");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/rfi-similar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(45_000) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Lookup failed."); return; }
      setSuggestions(result.suggestions);
      setUnresolvedSuggestions(result.unresolvedSuggestions ?? []);
      setMessage(result.noResults ? "No previously resolved RFI is similar enough." : `${result.suggestions.length} previously resolved RFI${result.suggestions.length === 1 ? "" : "s"} may be relevant.`);
    } catch {
      setMessage("RFI matching timed out after 45 seconds. Try again; the page remains usable.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="workflow-stack" style={{ marginTop: "1.5rem" }}>
      <h3 className="workflow-subtitle">Similar resolved RFIs</h3>
      <p className="advisory-note">Advisory only — each suggestion cites its source RFI record. This panel never auto-answers or closes the query.</p>
      <form className="query-form" onSubmit={submit}>
        <input value={text} onChange={(event) => setText(event.target.value)} minLength={3} required placeholder="Paste the RFI you are drafting…" />
        <button className="button button-secondary" disabled={loading} aria-busy={loading}>{loading && <span className="operation-progress" aria-hidden="true" />}<MessageSquareQuote size={16} />{loading ? "Matching…" : "Find similar RFIs"}</button>
      </form>
      <p className="workflow-hint">{message}</p>
      {suggestions.map((suggestion) => (
        <article className="surface workflow-card" key={suggestion.contentHash}>
          <span className="mono clause">Resolved RFI · {Math.round(suggestion.similarity * 100)}% match</span>
          <p>{suggestion.content ?? suggestion.text}</p>
          <CitationChips claims={[suggestion]} />
        </article>
      ))}
      {unresolvedSuggestions.length > 0 && (
        <>
          <h4 className="workflow-subtitle">Similar RFIs still open (not yet resolved)</h4>
          {unresolvedSuggestions.map((suggestion) => (
            <article className="surface workflow-card" key={suggestion.contentHash}>
              <span className="mono clause">Open RFI, unresolved · {Math.round(suggestion.similarity * 100)}% match</span>
              <p>{suggestion.content ?? suggestion.text}</p>
              <CitationChips claims={[suggestion]} />
            </article>
          ))}
        </>
      )}
    </section>
  );
}
