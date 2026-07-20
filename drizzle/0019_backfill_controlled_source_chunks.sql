-- A controlled source can predate the extraction-to-indexing handoff added
-- after the branch merge. Repair every extracted region that is not yet in
-- semantic retrieval. This is idempotent and leaves embedding generation to
-- the provider-aware knowledge.embed worker.
INSERT INTO "knowledge_chunks" (
  "tenant_id", "project_id", "source_region_id", "document_type",
  "content", "content_hash"
)
SELECT
  p."tenant_id", d."project_id", sr."id", d."document_type",
  sr."extracted_text", sr."content_hash"
FROM "source_regions" sr
INNER JOIN "document_versions" dv ON dv."id" = sr."document_version_id"
INNER JOIN "documents" d ON d."id" = dv."document_id"
INNER JOIN "projects" p ON p."id" = d."project_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "knowledge_chunks" kc
  WHERE kc."project_id" = d."project_id"
    AND kc."source_region_id" = sr."id"
);--> statement-breakpoint
