# Retrieval architecture: controlled commissioning intelligence

This application must not use a generic chatbot-style RAG pipeline. Its retrieval unit is a controlled source region, not an arbitrary text chunk, and every answer must resolve back to a document version, page, bounding box, content hash, tenant, and project.

## Retrieval contract

1. Ingest a source only after storing its immutable SHA-256 version record.
2. Extract page-local, reading-order regions with PyMuPDF. Preserve the original page and bounding box; never overwrite prior regions when a revision changes.
3. Attach tenant/project, document type, revision/status, source-region id, source hash, system/asset and requirement/gate relationships before the region becomes retrievable.
4. At query time, enforce tenant and project filters before ranking. Superseded, rejected, failed, and unauthorised sources cannot become candidates.
5. Return citations alongside every retrieved statement. A model response without a source-region id is rejected by the application layer.

## Scale path

- **Now:** Postgres is authoritative. Source regions, requirements, evidence, relationships and audit history remain transactional tables. The parser service is stateless and can be replicated.
- **Candidate retrieval:** use PostgreSQL full-text search and metadata filters for the first candidate set. Add `pgvector` embeddings after the controlled source workflow is stable; do not add a separate graph database yet because the `edges` table already provides governed relationship traversal.
- **Hybrid rank:** retrieve top 50 lexical candidates and top 50 semantic candidates, deduplicate with reciprocal-rank fusion, then apply a cross-encoder reranker to the top 20. Provide the best 8 source regions to generation, diversified by document version.
- **Large files:** upload directly to object storage in production, publish a durable parse job to Redis, and record `pending → processing → completed | failed`. The synchronous local route exists only for a small, inspectable foundation release; it is deliberately capped at 20 MB.
- **Observability:** record source/version identifiers, parser version, region count, retrieval candidates, reranking score, user, and final citations. Build an evaluation set from accepted/rejected requirement reviews before tuning chunk or reranking parameters.

## Non-negotiable safeguards

- No cross-tenant or cross-project retrieval.
- No auto-approval of requirements, evidence or gates from model output.
- Stale or failed evidence invalidates readiness.
- Requirement edits create an audited review event and cause dependent gate readiness to be recalculated.
