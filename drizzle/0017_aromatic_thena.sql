-- Older development seeds used the same business labels under a different set
-- of deterministic UUIDs. Preserve those historical records (and everything
-- that references them) while making their legacy status explicit, so the
-- merged seed can be applied idempotently without hiding data behind a unique
-- conflict. These UUIDs belong only to the built-in development project.
UPDATE "systems" SET "name" = 'Chilled Water · legacy demo', "updated_at" = now()
WHERE "id" = '10000000-0000-4000-8000-000000000004'
  AND "project_id" = '10000000-0000-4000-8000-000000000010'
  AND "name" = 'Chilled Water';--> statement-breakpoint
UPDATE "assets" SET "tag" = 'CHWP-02-LEGACY', "updated_at" = now()
WHERE "id" = '10000000-0000-4000-8000-000000000005'
  AND "project_id" = '10000000-0000-4000-8000-000000000010'
  AND "tag" = 'CHWP-02';--> statement-breakpoint

-- Some databases recorded migration 0011 in the journal before its indexes
-- were actually present. Repair the data first, then recreate every missing
-- deduplication constraint. The earliest row remains as the stable record.
DELETE FROM "edges" newer USING "edges" older
WHERE newer."project_id" = older."project_id"
  AND newer."from_type" = older."from_type"
  AND newer."from_id" = older."from_id"
  AND newer."relationship_type" = older."relationship_type"
  AND newer."to_type" = older."to_type"
  AND newer."to_id" = older."to_id"
  AND (newer."created_at", newer."id") > (older."created_at", older."id");--> statement-breakpoint
DELETE FROM "knowledge_chunks" newer USING "knowledge_chunks" older
WHERE newer."project_id" = older."project_id"
  AND newer."content_hash" = older."content_hash"
  AND (newer."created_at", newer."id") > (older."created_at", older."id");--> statement-breakpoint
DELETE FROM "alerts" newer USING "alerts" older
WHERE newer."dedup_key" = older."dedup_key"
  AND (newer."created_at", newer."id") > (older."created_at", older."id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "edges_project_edge_unique" ON "edges" USING btree ("project_id","from_type","from_id","relationship_type","to_type","to_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_project_hash_unique" ON "knowledge_chunks" USING btree ("project_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_dedup_key_unique" ON "alerts" USING btree ("dedup_key");--> statement-breakpoint
-- Preserve every pre-existing record and relationship while making invalid
-- duplicate business labels explicit. This is preferable to deleting or
-- silently merging records whose downstream meaning may differ.
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "project_id", "name" ORDER BY "created_at", "id") AS ordinal
  FROM "systems"
)
UPDATE "systems" target
SET "name" = left(target."name", 160) || ' · duplicate ' || substring(target."id"::text, 1, 8), "updated_at" = now()
FROM ranked
WHERE target."id" = ranked."id" AND ranked.ordinal > 1;--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "project_id", "system_id", "name" ORDER BY "created_at", "id") AS ordinal
  FROM "gates"
)
UPDATE "gates" target
SET "name" = left(target."name", 80) || ' · duplicate ' || substring(target."id"::text, 1, 8), "updated_at" = now()
FROM ranked
WHERE target."id" = ranked."id" AND ranked.ordinal > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "gates_project_system_name_unique" ON "gates" USING btree ("project_id","system_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "systems_project_name_unique" ON "systems" USING btree ("project_id","name");
