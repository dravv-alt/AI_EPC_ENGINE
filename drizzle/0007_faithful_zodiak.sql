ALTER TABLE "cx_checklists" ALTER COLUMN "generation_model_version" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "cx_checklist_steps" ADD COLUMN "review_state" "review_state" DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE "cx_checklist_steps" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD COLUMN "standard_version_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD COLUMN "generation_status" varchar(24) DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD COLUMN "generation_job_id" uuid;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD COLUMN "generation_error" text;--> statement-breakpoint
ALTER TABLE "cx_checklists" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "cx_clause_citations" ADD COLUMN "verification_reason" text;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_generation_status" varchar(24) DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_generation_job_id" uuid;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_generation_error" text;--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_model_version" varchar(80);--> statement-breakpoint
ALTER TABLE "cx_test_records" ADD COLUMN "report_review_note" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "standard_set" varchar(120);--> statement-breakpoint
UPDATE "cx_checklists" SET "generation_status" = 'completed' WHERE EXISTS (SELECT 1 FROM "cx_checklist_steps" WHERE "cx_checklist_steps"."checklist_id" = "cx_checklists"."id");--> statement-breakpoint
UPDATE "cx_checklist_steps" SET "review_state" = 'accepted', "review_note" = 'Migrated from previously accepted checklist.' WHERE "checklist_id" IN (SELECT "id" FROM "cx_checklists" WHERE "status" = 'accepted');--> statement-breakpoint
UPDATE "cx_clause_citations" SET "verification_reason" = 'Legacy citation was verified against its persisted source region.' WHERE "verification_status" = 'verified' AND "source_region_id" IS NOT NULL;--> statement-breakpoint
UPDATE "cx_test_records" SET "report_generation_status" = 'completed' WHERE "report_content" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cx_test_records_checklist_executor_unique" ON "cx_test_records" USING btree ("checklist_id","executed_by");
