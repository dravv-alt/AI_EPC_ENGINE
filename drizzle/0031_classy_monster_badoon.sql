ALTER TABLE "rack_models" ALTER COLUMN "rackdb_version" SET DEFAULT '0.7';
--> statement-breakpoint
UPDATE "rack_models"
SET "rackdb_version" = '0.7', "updated_at" = now()
WHERE "rackdb_version" = '0.6';
