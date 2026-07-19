ALTER TABLE "document_versions" ADD COLUMN "extraction_model" varchar(80);--> statement-breakpoint
ALTER TABLE "document_versions" ADD COLUMN "extraction_provider" varchar(20);--> statement-breakpoint
ALTER TABLE "requirements" ADD COLUMN "comparison_modality" varchar(20);