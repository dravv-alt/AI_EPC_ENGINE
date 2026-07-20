# Retrieval architecture: controlled commissioning intelligence

This application must not use a generic chatbot-style RAG pipeline. Its retrieval unit is a controlled source region, not an arbitrary text chunk, and every answer must resolve back to a document version, page, bounding box, content hash, tenant, and project.

## Retrieval contract

1. Ingest a source only after storing its immutable SHA-256 version record.
2. Extract page-local, reading-order regions with PyMuPDF. Preserve the original page and bounding box; never overwrite prior regions when a revision changes.
3. Attach tenant/project, document type, revision/status, source-region id, source hash, system/asset and requirement/gate relationships before the region becomes retrievable.
4. At query time, enforce tenant and project filters before ranking. Superseded, rejected, failed, and unauthorised sources cannot become candidates.
5. Return citations alongside every retrieved statement. A model response without a source-region id is rejected by the application layer.

## Scale path

- **Now:** Postgres is authoritative. Source regions, requirements, evidence, relationships and audit history remain transactional tables. The parser service is stateless and can be replicated. Ingestion accepts PDF, CSV, and XLSX.
- **Candidate retrieval — built.** `pgvector` embeddings over `knowledge_chunks` are in place alongside metadata filters. Mandatory filters (project and doc-type, plus system/asset/gate/revision/date when supplied) are enforced **in SQL before ranking**, never as a post-filter. No separate graph database was introduced; the `edges` table provides governed relationship traversal, and `src/lib/knowledge/expand.ts` uses it for deterministic graph-context expansion.
- **Hybrid rank — built.** Cross-encoder reranking runs in the stateless `services/retrieval` Python service (port 8003), swappable against a deterministic mock via `EMBEDDING_PROVIDER`. Generation is a two-call plan-then-synthesize pipeline (`src/lib/knowledge/pipeline.ts`) with a **code-enforced** groundedness filter: a claim without a resolvable source-region id is dropped by the application layer, not trusted from the model.
- **Large files:** upload publishes a durable parse job (`durable_jobs` + BullMQ) recording `pending → processing → completed | failed`. The synchronous local route remains capped at 20 MB.
- **Observability:** source/version identifiers, parser version, region count, retrieval candidates, reranking score, user, and final citations are recorded. Named accuracy targets live in `src/lib/config/targets.ts`, validated through `src/lib/env.ts` so an out-of-range override is rejected at startup. A golden-set evaluation harness is still outstanding — the targets are declared but not yet measured against a curated set.

## Non-negotiable safeguards

- No cross-tenant or cross-project retrieval.
- No auto-approval of requirements, evidence or gates from model output.
- Stale or failed evidence invalidates readiness.
- Requirement edits create an audited review event and cause dependent gate readiness to be recalculated.
