ALTER TABLE "requirements" ADD COLUMN "display_title" varchar(180);--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "display_summary" varchar(280);--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "presentation_provider" varchar(80);
--> statement-breakpoint
-- Existing controlled statements stay authoritative. Backfill compact review
-- aids deterministically so historic records are immediately scannable; newly
-- extracted records receive provider-tagged summaries from the proposal flow.
UPDATE "requirements"
SET
  "display_title" = array_to_string((regexp_split_to_array(regexp_replace("statement", E'\\s+', ' ', 'g'), ' '))[1:9], ' '),
  "display_summary" = array_to_string((regexp_split_to_array(regexp_replace("statement", E'\\s+', ' ', 'g'), ' '))[1:28], ' '),
  "presentation_provider" = 'source-derived-v1'
WHERE "display_title" IS NULL OR "display_summary" IS NULL;
