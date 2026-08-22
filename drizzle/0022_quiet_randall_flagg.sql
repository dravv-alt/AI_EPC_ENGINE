ALTER TABLE "evidence" ADD COLUMN "ai_description" text;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "classification_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "classification_provider" varchar(80);--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "classification_confidence" numeric(5, 4);