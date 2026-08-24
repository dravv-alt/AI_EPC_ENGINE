/**
 * OWNED BY: A2-6 (Slice 6) — renders citations (e.g. from knowledge.search) as a citation list.
 * Placeholder until that agent replaces this body with a real component. Keep the
 * prop shape ({ data: unknown }) — do not import CopilotRendererProps from
 * "./index" here, that would create a circular import with the registry file.
 *
 * Shape note: at the time this was written, A2-5's knowledge.search tool had
 * not landed yet (src/lib/copilot/registry/read-cx-compliance.ts was still a
 * stub). The underlying `answerKnowledgeQuery` (src/lib/knowledge/pipeline.ts)
 * returns `AnswerKnowledgeQueryResult`:
 *   { answer, claims: AnsweredClaim[], noResults, droppedClaimCount, ... }
 * where AnsweredClaim = { text, content, sourceRegionId, documentTitle,
 * documentType, similarity, ... } — notably NO `revision` or `pageNumber`
 * field, unlike the `CopilotCitation` shape declared in
 * src/lib/copilot/types.ts ({ sourceRegionId, documentTitle, revision,
 * pageNumber, excerpt }). This component tolerates BOTH: a raw
 * AnswerKnowledgeQueryResult-shaped object (claims[]) and a plain
 * CopilotCitation[] array, defaulting any missing revision/pageNumber/excerpt
 * field to an honest placeholder rather than inventing one.
 *
 * Rule 6 (no uncited claims): when the underlying tool reports
 * `noResults: true`, this renders that fact explicitly — never an empty list
 * that could be misread as "there are citations, just none listed."
 *
 * Found via live testing: `knowledge.similar_rfi` also renders "citationList"
 * (no dedicated key exists — read-cx-compliance.ts's own comment says so) but
 * returns a THIRD shape, `{ suggestions, unresolvedSuggestions, noResults }`
 * (POST .../knowledge/rfi-similar) — neither a plain array nor
 * `{ claims }`, so it always fell through to "No citation data available.",
 * even with real suggestions. Handled below, explicitly separating resolved
 * (`suggestions`) from unresolved (`unresolvedSuggestions`) — per that
 * route's own comment, an unresolved match must never render under a
 * "resolved" heading.
 */
import type { CSSProperties } from "react";

interface RawCitation {
  sourceRegionId?: string;
  documentTitle?: string | null;
  revision?: string | null;
  pageNumber?: number | null;
  excerpt?: string | null;
  text?: string | null;
  content?: string | null;
  similarity?: number | null;
}

interface KnowledgeQueryResultShape {
  claims?: RawCitation[];
  noResults?: boolean;
  answer?: string | null;
}

interface RfiSimilarResultShape {
  suggestions?: RawCitation[];
  unresolvedSuggestions?: RawCitation[];
  noResults?: boolean;
}

function isRfiSimilarShape(value: unknown): value is RfiSimilarResultShape {
  return !!value && typeof value === "object" && (Array.isArray((value as RfiSimilarResultShape).suggestions) || Array.isArray((value as RfiSimilarResultShape).unresolvedSuggestions));
}

const itemStyle: CSSProperties = { borderBottom: "1px solid var(--line)", paddingBottom: 8 };
const labelStyle: CSSProperties = { color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" };
const excerptStyle: CSSProperties = { margin: "4px 0 0", color: "var(--ink)", fontSize: 12 };

function renderCitation(citation: RawCitation, key: string) {
  const excerpt = citation.excerpt ?? citation.text ?? citation.content ?? null;
  return (
    <li key={key} style={itemStyle}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--ink)", fontSize: 12 }}>{citation.documentTitle ?? "Untitled source"}</strong>
        {citation.revision && <span style={labelStyle}>rev {citation.revision}</span>}
        {citation.pageNumber != null && <span style={labelStyle}>p.{citation.pageNumber}</span>}
      </div>
      {excerpt && <p style={excerptStyle}>&ldquo;{excerpt}&rdquo;</p>}
    </li>
  );
}

export function CitationList({ data }: { data: unknown }) {
  // Plain CopilotCitation[] (or any raw citation array).
  if (Array.isArray(data)) {
    if (!data.length) {
      return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No results found.</p>;
    }
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {(data as RawCitation[]).map((citation, index) => renderCitation(citation, citation.sourceRegionId ?? String(index)))}
      </ul>
    );
  }

  if (isRfiSimilarShape(data)) {
    const resolved = data.suggestions ?? [];
    const unresolved = data.unresolvedSuggestions ?? [];
    if (!resolved.length && !unresolved.length) {
      return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No results found.</p>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {resolved.length > 0 && (
          <div>
            <p style={{ ...labelStyle, margin: "0 0 6px" }}>Previously resolved</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {resolved.map((citation, index) => renderCitation(citation, `resolved-${citation.sourceRegionId ?? index}`))}
            </ul>
          </div>
        )}
        {unresolved.length > 0 && (
          <div>
            <p style={{ ...labelStyle, margin: "0 0 6px" }}>Similar, not yet resolved</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {unresolved.map((citation, index) => renderCitation(citation, `unresolved-${citation.sourceRegionId ?? index}`))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (data && typeof data === "object") {
    const result = data as KnowledgeQueryResultShape;
    if (result.noResults === true) {
      return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No results found.</p>;
    }
    if (Array.isArray(result.claims)) {
      if (!result.claims.length) {
        return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No results found.</p>;
      }
      return (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {result.claims.map((claim, index) => renderCitation(claim, claim.sourceRegionId ?? String(index)))}
        </ul>
      );
    }
  }

  return <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No citation data available.</p>;
}
