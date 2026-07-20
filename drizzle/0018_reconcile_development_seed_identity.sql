-- The original Refinement demo project used project/system/asset UUIDs that
-- predate the expanded Updated-Refinement fixture. Keep the old records as
-- labelled history and restore the expanded fixture's canonical labels. This
-- affects only the documented deterministic development UUIDs.
UPDATE "systems" SET "name" = 'Chilled Water · legacy demo', "updated_at" = now()
WHERE "id" = '10000000-0000-4000-8000-000000000004'
  AND "project_id" = '10000000-0000-4000-8000-000000000003'
  AND "name" = 'Chilled Water';--> statement-breakpoint
UPDATE "systems" SET "name" = 'Chilled Water', "updated_at" = now()
WHERE "id" = '10000000-0000-4000-8000-000000000020'
  AND "project_id" = '10000000-0000-4000-8000-000000000003'
  AND "name" LIKE 'Chilled Water · duplicate %';--> statement-breakpoint
UPDATE "assets" SET "tag" = 'CHWP-02-LEGACY', "updated_at" = now()
WHERE "id" = '10000000-0000-4000-8000-000000000005'
  AND "project_id" = '10000000-0000-4000-8000-000000000003'
  AND "tag" = 'CHWP-02';
