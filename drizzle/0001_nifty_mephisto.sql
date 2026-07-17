CREATE TYPE "public"."extraction_state" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "extraction_status" "extraction_state" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;