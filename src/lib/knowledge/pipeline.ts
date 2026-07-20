import { z } from "zod";
import { expandWithGraphContext, type GraphContextEntry } from "@/lib/knowledge/expand";
import { retrieveSemanticCitations, type SemanticCitation } from "@/lib/knowledge/query";
import { rerankCitations } from "@/lib/knowledge/rerank";
import { getGenerationProvider } from "@/lib/model/provider";

// Agent 5, Slice 3: the cited-answer pipeline. Two LLM calls only — planning
// (intent + routing + decomposition) and synthesis (the cited answer).
// Retrieval, dedupe, rerank, and graph expansion in between are deterministic,
// no LLM involved. Groundedness is enforced in code (filterGroundedClaims),
// never trusted from the model — mirrors the guard at cx/generation.ts:76,
// except claims citing an out-of-scope region are dropped, not thrown on.

const RETRIEVAL_LIMIT = 8;

const PLAN_SYSTEM_PROMPT = `You are the planning stage of a controlled-document knowledge-query pipeline for an EPC commissioning project. Classify the intent of the user's query, optionally narrow retrieval to exactly one document type if the query is unambiguously about one kind of controlled document (or null to search everything), and decompose the query into up to 4 sub-queries that together cover everything being asked. Plausible document types for this domain include: procedure, standard, submittal, po, shop_drawing, drawing, rfi, spec, client_spec — but do not invent a type outside what a controlled EPC commissioning project would plausibly have, and never fabricate a type just to narrow scope. You may also propose a systemId, assetId, gateId, or revision to narrow retrieval, but ONLY when the query names a specific one you were given as context — never fabricate an id or revision string; leave each null when unsure. When in doubt, prefer null (search everything) and a single sub-query equal to the original. Output JSON only.`;

const SYNTHESIS_SYSTEM_PROMPT = `You are the synthesis stage of a controlled-document knowledge-query pipeline. Answer the user's original query using ONLY the supplied citations — never introduce information, numbers, or clauses that are not present in the supplied citation text. Every claim you make must name which sourceRegionId(s) from the supplied set support it. Never cite a sourceRegionId that was not supplied to you; a fabricated or out-of-scope citation will be discarded by the calling system regardless of what you output, so only cite what you were given. If the supplied citations do not answer part of the query, omit that part rather than guessing. Output JSON only.`;

const planSchema = z.object({
  documentType: z.string().nullable(),
  // ADR-021 scope dimensions the plan may propose narrowing to. These are
  // proposals only — see effectiveSystemId/effectiveAssetId/etc. below, which
  // give the caller's explicit request-body filter absolute precedence over
  // whatever the plan infers, mirroring the pre-existing documentType
  // override rule.
  systemId: z.string().uuid().nullable().default(null),
  assetId: z.string().uuid().nullable().default(null),
  gateId: z.string().uuid().nullable().default(null),
  revision: z.string().nullable().default(null),
  subQueries: z.array(z.string().min(1)).min(1).max(4)
});

const synthesisSchema = z.object({
  claims: z.array(z.object({
    text: z.string().min(1),
    citations: z.array(z.string().uuid()).min(1)
  }))
});

export type SynthesisClaim = z.infer<typeof synthesisSchema>["claims"][number];

export type AnsweredClaim = {
  text: string;
  content: string;
  sourceRegionId: string;
  documentVersionId: string | null;
  documentType: string;
  contentHash: string;
  similarity: number;
  graphContext: GraphContextEntry[];
};

export type AnswerKnowledgeQueryResult = {
  answer: string | null;
  claims: AnsweredClaim[];
  noResults: boolean;
  droppedClaimCount: number;
  planModel: string;
  planProvider: string;
  synthesisModel: string;
  synthesisProvider: string;
};

// Deterministic groundedness filter — the load-bearing part, exported
// standalone so it is independently unit-testable without a live model or
// database. Any claim citing so much as one sourceRegionId outside the
// retrieved set is dropped whole: a claim with even one fabricated citation
// among several real ones can't be trusted piecemeal.
export function filterGroundedClaims(
  claims: SynthesisClaim[],
  allowedRegions: Set<string>
): { grounded: SynthesisClaim[]; droppedCount: number } {
  const grounded = claims.filter((claim) => claim.citations.every((regionId) => allowedRegions.has(regionId)));
  return { grounded, droppedCount: claims.length - grounded.length };
}

export async function answerKnowledgeQuery(input: {
  projectId: string;
  query: string;
  documentType?: string;
  systemId?: string;
  assetId?: string;
  gateId?: string;
  revision?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<AnswerKnowledgeQueryResult> {
  const generation = getGenerationProvider();

  // 1. Planning call. Mock reduces to exactly today's single-query,
  // no-routing behaviour: { documentType: null, subQueries: [query] }.
  const plan = await generation.generateStructured({
    system: PLAN_SYSTEM_PROMPT,
    prompt: JSON.stringify({ query: input.query }),
    schema: planSchema,
    mock: { documentType: null, systemId: null, assetId: null, gateId: null, revision: null, subQueries: [input.query] }
  });

  // An explicit caller-supplied filter (the pre-existing request-body
  // documentType filter, plus the new systemId/assetId/gateId/revision
  // dimensions) always overrides the plan's inferred narrowing — this
  // preserves the existing HTTP contract, which the plan (all null in mock
  // mode) must not silently override. Date range is caller-only: it is not
  // threaded through the plan schema since an LLM-proposed date range is not
  // a narrowing a caller can meaningfully be overridden on.
  const effectiveDocumentType = input.documentType ?? plan.data.documentType ?? undefined;
  const effectiveSystemId = input.systemId ?? plan.data.systemId ?? undefined;
  const effectiveAssetId = input.assetId ?? plan.data.assetId ?? undefined;
  const effectiveGateId = input.gateId ?? plan.data.gateId ?? undefined;
  const effectiveRevision = input.revision ?? plan.data.revision ?? undefined;

  // 2. Retrieval: run each sub-query, union, dedupe by chunkId (keep the
  // highest-similarity instance), rerank the deduped set against the
  // ORIGINAL query, then graph-expand. In mock mode there is exactly one
  // sub-query (the original), so this reduces to the pre-existing single
  // retrieval pass.
  const perSubQuery = await Promise.all(
    plan.data.subQueries.map((subQuery) =>
      retrieveSemanticCitations({
        projectId: input.projectId,
        query: subQuery,
        documentType: effectiveDocumentType,
        systemId: effectiveSystemId,
        assetId: effectiveAssetId,
        gateId: effectiveGateId,
        revision: effectiveRevision,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: RETRIEVAL_LIMIT
      })
    )
  );
  const byChunkId = new Map<string, SemanticCitation>();
  for (const citations of perSubQuery) {
    for (const citation of citations) {
      const existing = byChunkId.get(citation.chunkId);
      if (!existing || citation.similarity > existing.similarity) byChunkId.set(citation.chunkId, citation);
    }
  }
  const deduped = [...byChunkId.values()];
  const reranked = await rerankCitations(input.query, deduped, RETRIEVAL_LIMIT);

  if (!reranked.length) {
    return {
      answer: null,
      claims: [],
      noResults: true,
      droppedClaimCount: 0,
      planModel: plan.model,
      planProvider: plan.provider,
      synthesisModel: "n/a",
      synthesisProvider: "n/a"
    };
  }

  const graphContextByChunk = await expandWithGraphContext(input.projectId, reranked);

  // 3. Synthesis call. Mock reproduces one claim per retrieved chunk, citing
  // its own region — today's raw-concatenation output.
  const synthesis = await generation.generateStructured({
    system: SYNTHESIS_SYSTEM_PROMPT,
    prompt: JSON.stringify({
      query: input.query,
      citations: reranked.map((citation) => ({
        sourceRegionId: citation.sourceRegionId,
        documentType: citation.documentType,
        text: citation.text,
        graphContext: graphContextByChunk.get(citation.chunkId) ?? []
      }))
    }),
    schema: synthesisSchema,
    mock: { claims: reranked.map((citation) => ({ text: citation.text, citations: [citation.sourceRegionId] })) }
  });

  // 4. Deterministic groundedness filter — never trust a model-returned
  // region id. Drop (do not throw) any claim citing a region outside the
  // retrieved set; a partial cited answer is still useful.
  const allowedRegions = new Set(reranked.map((citation) => citation.sourceRegionId));
  const { grounded, droppedCount } = filterGroundedClaims(synthesis.data.claims, allowedRegions);

  const citationByRegion = new Map(reranked.map((citation) => [citation.sourceRegionId, citation]));
  const claims: AnsweredClaim[] = grounded.flatMap((claim) =>
    claim.citations.map((regionId) => {
      const citation = citationByRegion.get(regionId);
      // Every citation here passed filterGroundedClaims, so it is guaranteed
      // present in citationByRegion; the fallback keeps this total.
      if (!citation) return null;
      return {
        text: claim.text,
        content: citation.content,
        sourceRegionId: regionId,
        documentVersionId: citation.documentVersionId,
        documentType: citation.documentType,
        contentHash: citation.contentHash,
        similarity: citation.similarity,
        graphContext: graphContextByChunk.get(citation.chunkId) ?? []
      };
    }).filter((claim): claim is AnsweredClaim => claim !== null)
  );

  return {
    answer: grounded.length ? grounded.map((claim) => claim.text).join("\n\n") : null,
    claims,
    noResults: grounded.length === 0,
    droppedClaimCount: droppedCount,
    planModel: plan.model,
    planProvider: plan.provider,
    synthesisModel: synthesis.model,
    synthesisProvider: synthesis.provider
  };
}
