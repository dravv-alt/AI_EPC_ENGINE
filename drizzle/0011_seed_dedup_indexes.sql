-- Prevent duplicate graph edges on re-seed
CREATE UNIQUE INDEX IF NOT EXISTS "edges_project_edge_unique"
  ON "edges" ("project_id", "from_type", "from_id", "relationship_type", "to_type", "to_id");--> statement-breakpoint

-- Prevent duplicate knowledge chunks on re-seed (scoped per project)
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_project_hash_unique"
  ON "knowledge_chunks" ("project_id", "content_hash");--> statement-breakpoint

-- Enforce alerts dedup_key uniqueness (prevents duplicate alert rows)
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_dedup_key_unique"
  ON "alerts" ("dedup_key");
