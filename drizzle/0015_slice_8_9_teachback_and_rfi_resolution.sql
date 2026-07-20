CREATE TABLE "teachback_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subject_type" varchar(40) NOT NULL,
	"subject_id" uuid NOT NULL,
	"corrected_from" jsonb NOT NULL,
	"corrected_to" jsonb,
	"rationale" text NOT NULL,
	"source_region_id" uuid,
	"created_by" uuid NOT NULL,
	"review_state" "review_state" NOT NULL,
	"embedding" vector(768),
	"embedding_model" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "resolution_state" varchar(20);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teachback_notes" ADD CONSTRAINT "teachback_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachback_notes" ADD CONSTRAINT "teachback_notes_source_region_id_source_regions_id_fk" FOREIGN KEY ("source_region_id") REFERENCES "public"."source_regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachback_notes" ADD CONSTRAINT "teachback_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "teachback_notes_project_subject_idx" ON "teachback_notes" USING btree ("project_id","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "teachback_notes_embedding_idx" ON "teachback_notes" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
-- Slice 9 backfill: resolution_state is only meaningful for documentType =
-- "rfi", but no pre-existing seeded document is typed "rfi" (the existing
-- verify scripts anchor ad-hoc rfi-tagged knowledgeChunks to whatever
-- document already owns a project's first source region, rather than a real
-- rfi-typed document). Backfilling every pre-existing document row to an
-- explicit "resolved" state — instead of leaving it null-as-ambiguous —
-- keeps those pre-existing anchors behaving exactly as before once
-- rfi-similar starts filtering on resolution_state; new rfi documents
-- created after this migration are expected to set an explicit state at
-- creation time.
UPDATE "documents" SET "resolution_state" = 'resolved', "resolved_at" = COALESCE("resolved_at", "updated_at") WHERE "resolution_state" IS NULL;